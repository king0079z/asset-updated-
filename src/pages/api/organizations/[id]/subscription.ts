import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';
import { logDataModification } from "@/lib/audit";
import crypto from 'crypto';

// Define plan limits
const PLAN_LIMITS = {
  FREE: {
    maxUsers: 5,
    maxKitchens: 2,
    maxRecipes: 50,
    maxAssets: 100,
    features: {},
  },
  BASIC: {
    maxUsers: 10,
    maxKitchens: 5,
    maxRecipes: 100,
    maxAssets: 250,
    features: {
      aiAnalysis: true,
      barcodeScanning: true,
    },
  },
  PROFESSIONAL: {
    maxUsers: 25,
    maxKitchens: 15,
    maxRecipes: 500,
    maxAssets: 1000,
    features: {
      aiAnalysis: true,
      barcodeScanning: true,
      advancedReporting: true,
      apiAccess: true,
    },
  },
  ENTERPRISE: {
    maxUsers: 100,
    maxKitchens: 50,
    maxRecipes: 2000,
    maxAssets: 5000,
    features: {
      aiAnalysis: true,
      barcodeScanning: true,
      advancedReporting: true,
      apiAccess: true,
      customIntegrations: true,
      dedicatedSupport: true,
    },
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const supabase = createClient(req, res);
  const { data: { session }, error: authError } = await supabase.auth.getSession();
    const user = session?.user ?? null;

  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { id: organizationId } = req.query;

  if (!organizationId || typeof organizationId !== 'string') {
    return res.status(400).json({ error: 'Organization ID is required' });
  }

  // Check if the user is an owner of the organization or an admin
  const userData = await prisma.user.findUnique({
    where: { id: user.id },
    select: { isAdmin: true },
  });

  const membership = await prisma.organizationMember.findFirst({
    where: {
      organizationId,
      userId: user.id,
    },
  });

  // Allow if user is an admin or an owner of the organization
  const isAdmin = userData?.isAdmin === true;
  const isOwner = membership?.role === 'OWNER';

  if (!isAdmin && !isOwner) {
    return res.status(403).json({ error: 'Only organization owners can manage subscriptions' });
  }

  // GET - Get the organization's subscription
  if (req.method === 'GET') {
    try {
      const subscription = await prisma.subscription.findUnique({
        where: { organizationId },
      });

      if (!subscription) {
        return res.status(404).json({ error: 'Subscription not found' });
      }

      return res.status(200).json(subscription);
    } catch (error) {
      console.error('Error fetching subscription:', error);
      return res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Internal Server Error' 
      });
    }
  }
  
  // PATCH - Update the organization's subscription
  else if (req.method === 'PATCH') {
    try {
      const { plan, durationMonths = 12 } = req.body;
      
      if (!plan || !['FREE', 'BASIC', 'PROFESSIONAL', 'ENTERPRISE'].includes(plan)) {
        return res.status(400).json({ 
          error: 'Valid plan is required (FREE, BASIC, PROFESSIONAL, or ENTERPRISE)' 
        });
      }

      if (durationMonths < 1) {
        return res.status(400).json({ 
          error: 'Duration must be at least 1 month' 
        });
      }
      
      // Get the current subscription
      const currentSubscription = await prisma.subscription.findUnique({
        where: { organizationId },
      });
      
      if (!currentSubscription) {
        return res.status(404).json({ error: 'Subscription not found' });
      }
      
      // If downgrading, check if the organization exceeds the new plan's limits
      if (plan !== 'ENTERPRISE' && currentSubscription.plan !== plan) {
        const planLimits = PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS];
        
        // Check user count
        const memberCount = await prisma.organizationMember.count({
          where: { organizationId },
        });
        
        if (memberCount > planLimits.maxUsers) {
          return res.status(400).json({ 
            error: `Cannot downgrade: Organization has ${memberCount} members, but ${plan} plan only allows ${planLimits.maxUsers}` 
          });
        }
        
        // Check kitchen count
        const kitchenCount = await prisma.kitchen.count({
          where: { organizationId },
        });
        
        if (kitchenCount > planLimits.maxKitchens) {
          return res.status(400).json({ 
            error: `Cannot downgrade: Organization has ${kitchenCount} kitchens, but ${plan} plan only allows ${planLimits.maxKitchens}` 
          });
        }
        
        // Check recipe count
        const recipeCount = await prisma.recipe.count({
          where: { organizationId },
        });
        
        if (recipeCount > planLimits.maxRecipes) {
          return res.status(400).json({ 
            error: `Cannot downgrade: Organization has ${recipeCount} recipes, but ${plan} plan only allows ${planLimits.maxRecipes}` 
          });
        }
        
        // Check asset count
        const assetCount = await prisma.asset.count({
          where: { organizationId },
        });
        
        if (assetCount > planLimits.maxAssets) {
          return res.status(400).json({ 
            error: `Cannot downgrade: Organization has ${assetCount} assets, but ${plan} plan only allows ${planLimits.maxAssets}` 
          });
        }
      }
      
      // Calculate end date based on duration (if not FREE plan)
      const now = new Date();
      let endDate: Date | null = null;
      
      if (plan !== 'FREE') {
        endDate = new Date();
        endDate.setMonth(endDate.getMonth() + durationMonths);
      }
      
      // Generate a license key (except for FREE plan)
      let licenseKey: string | null = null;
      if (plan !== 'FREE') {
        licenseKey = generateLicenseKey(organizationId, plan, endDate!);
      }
      
      // Update the subscription
      const updatedSubscription = await prisma.subscription.update({
        where: { organizationId },
        data: {
          plan: plan as any,
          ...PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS],
          startDate: now,
          endDate: endDate,
          isActive: true,
          licenseKey: licenseKey,
          licenseKeyCreatedAt: licenseKey ? now : null,
        },
      });
      
      // Create billing history record
      await prisma.billingHistory.create({
        data: {
          organizationId,
          amount: calculateAmount(plan, durationMonths),
          currency: 'USD',
          status: 'SUCCESS',
          description: `Subscription updated to ${plan} plan for ${durationMonths} months`,
        },
      });
      
      // Create audit log
      await logDataModification(
        'SUBSCRIPTION',
        updatedSubscription.id,
        'UPDATE',
        { 
          oldPlan: currentSubscription.plan, 
          newPlan: plan 
        },
        {
          action: 'Subscription Update',
          userId: user.id,
          userEmail: user.email
        }
      );
      
      return res.status(200).json(updatedSubscription);
    } catch (error) {
      console.error('Error updating subscription:', error);
      return res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Internal Server Error' 
      });
    }
  }
  
  // Method not allowed
  else {
    res.setHeader('Allow', ['GET', 'PATCH']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

// Generate a license key based on organization ID, plan, and expiration date
function generateLicenseKey(organizationId: string, plan: string, expirationDate: Date): string {
  const expirationTimestamp = Math.floor(expirationDate.getTime() / 1000);
  const dataToHash = `${organizationId}-${plan}-${expirationTimestamp}-${process.env.NEXT_PUBLIC_SITE_URL || 'kitchenmanagement'}`;
  
  // Create a hash of the data
  const hash = crypto.createHash('sha256').update(dataToHash).digest('hex');
  
  // Format the license key in a readable format (XXXX-XXXX-XXXX-XXXX)
  const formattedKey = [
    hash.substring(0, 4),
    hash.substring(4, 8),
    hash.substring(8, 12),
    hash.substring(12, 16)
  ].join('-').toUpperCase();
  
  return `${plan.substring(0, 3)}-${formattedKey}`;
}

// Calculate subscription amount based on plan and duration
function calculateAmount(plan: string, durationMonths: number): number {
  const monthlyRates: Record<string, number> = {
    'FREE': 0,
    'BASIC': 29,
    'PROFESSIONAL': 99,
    'ENTERPRISE': 299
  };
  
  const rate = monthlyRates[plan] || 0;
  return rate * durationMonths;
}