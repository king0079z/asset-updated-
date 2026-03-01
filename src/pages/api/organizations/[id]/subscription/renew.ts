// @ts-nocheck
import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';
import { logDataModification } from "@/lib/audit";
import crypto from 'crypto';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const supabase = createClient(req, res);
  const { data: { user }, error: authError } = await supabase.auth.getSession();

  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { id: organizationId } = req.query;

  if (!organizationId || typeof organizationId !== 'string') {
    return res.status(400).json({ error: 'Organization ID is required' });
  }

  // Check if the user is an owner of the organization
  const membership = await prisma.organizationMember.findFirst({
    where: {
      organizationId,
      userId: user.id,
      role: 'OWNER',
    },
  });

  if (!membership) {
    return res.status(403).json({ error: 'Only organization owners can manage subscriptions' });
  }

  // POST - Renew the organization's subscription
  if (req.method === 'POST') {
    try {
      const { durationMonths = 12 } = req.body;
      
      if (!durationMonths || durationMonths < 1) {
        return res.status(400).json({ 
          error: 'Valid duration in months is required (minimum 1 month)' 
        });
      }
      
      // Get the current subscription
      const currentSubscription = await prisma.subscription.findUnique({
        where: { organizationId },
      });
      
      if (!currentSubscription) {
        return res.status(404).json({ error: 'Subscription not found' });
      }
      
      // Calculate new end date
      const now = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + durationMonths);
      
      // Generate a new license key
      const licenseKey = generateLicenseKey(organizationId, currentSubscription.plan, endDate);
      
      // Update the subscription
      const updatedSubscription = await prisma.subscription.update({
        where: { organizationId },
        data: {
          isActive: true,
          startDate: now,
          endDate: endDate,
          licenseKey: licenseKey,
          licenseKeyCreatedAt: now,
        },
      });
      
      // Create billing history record
      await prisma.billingHistory.create({
        data: {
          organizationId,
          amount: calculateAmount(currentSubscription.plan, durationMonths),
          currency: 'USD',
          status: 'SUCCESS',
          description: `Subscription renewed for ${durationMonths} months`,
        },
      });
      
      // Create audit log
      await logDataModification(
        'SUBSCRIPTION',
        updatedSubscription.id,
        'RENEW',
        { 
          oldEndDate: currentSubscription.endDate, 
          newEndDate: endDate,
          durationMonths
        },
        {
          action: 'Subscription Renewal',
          userId: user.id,
          userEmail: user.email
        }
      );
      
      return res.status(200).json(updatedSubscription);
    } catch (error) {
      console.error('Error renewing subscription:', error);
      return res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Internal Server Error' 
      });
    }
  }
  
  // Method not allowed
  else {
    res.setHeader('Allow', ['POST']);
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