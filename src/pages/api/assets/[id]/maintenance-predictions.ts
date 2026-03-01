import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.info('Path: /api/assets/[id]/maintenance-predictions Starting maintenance predictions generation');
    
    const { id } = req.query;
    const supabase = createClient(req, res);
    
    const {
      data: { user },
    } = await supabase.auth.getSession();

    if (!user) {
      console.error('Path: /api/assets/[id]/maintenance-predictions Unauthorized access attempt');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    console.info(`Path: /api/assets/[id]/maintenance-predictions Fetching asset: ${id}`);

    // Get asset details with related data for prediction generation
    const asset = await prisma.asset.findUnique({
      where: { id: id as string },
      include: {
        tickets: {
          include: {
            history: true,
          },
        },
        movements: true,
        history: true,
      },
    });

    if (!asset) {
      console.error(`Path: /api/assets/[id]/maintenance-predictions Asset not found: ${id}`);
      return res.status(404).json({ error: 'Asset not found' });
    }

    console.info(`Path: /api/assets/[id]/maintenance-predictions Found asset: ${asset.name} (${asset.id})`);
    
    // Generate maintenance predictions
    const maintenancePredictions = await generateMaintenancePredictions(asset);
    
    console.info(`Path: /api/assets/[id]/maintenance-predictions Generated ${maintenancePredictions.length} predictions for asset: ${asset.id}`);

    return res.status(200).json({
      maintenancePredictions
    });
  } catch (error) {
    console.error('Error generating maintenance predictions:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function generateMaintenancePredictions(asset: any) {
  try {
    const predictions = [];
    const now = new Date();
    
    // Generate unique IDs for predictions
    const generateId = () => `pred_${Math.random().toString(36).substring(2, 15)}`;
    
    // 1. Age-based routine maintenance
    if (asset.purchaseDate) {
      const ageInMonths = getAgeInMonths(asset.purchaseDate);
      
      // Different maintenance schedules based on asset type
      if (asset.type === 'ELECTRONICS' && ageInMonths >= 12) {
        try {
          // Annual checkup for electronics
          const nextCheckupDate = new Date(asset.purchaseDate);
          nextCheckupDate.setFullYear(nextCheckupDate.getFullYear() + Math.ceil(ageInMonths / 12));
          
          predictions.push({
            id: generateId(),
            assetId: asset.id,
            type: 'ROUTINE',
            description: 'Annual electronic equipment inspection and maintenance',
            recommendedDate: nextCheckupDate.toISOString(),
            confidence: 90,
            status: 'PENDING',
          });
        } catch (error) {
          console.error('Error creating electronics maintenance prediction:', error);
        }
      }
      
      if (asset.type === 'EQUIPMENT' && ageInMonths >= 6) {
        try {
          // Bi-annual checkup for equipment
          const nextCheckupDate = new Date(asset.purchaseDate);
          nextCheckupDate.setMonth(nextCheckupDate.getMonth() + (Math.ceil(ageInMonths / 6) * 6));
          
          predictions.push({
            id: generateId(),
            assetId: asset.id,
            type: 'ROUTINE',
            description: 'Bi-annual equipment inspection and lubrication',
            recommendedDate: nextCheckupDate.toISOString(),
            confidence: 85,
            status: 'PENDING',
          });
        } catch (error) {
          console.error('Error creating equipment maintenance prediction:', error);
        }
      }
      
      if (asset.type === 'FURNITURE' && ageInMonths >= 24) {
        try {
          // Every 2 years for furniture
          const nextCheckupDate = new Date(asset.purchaseDate);
          nextCheckupDate.setFullYear(nextCheckupDate.getFullYear() + (Math.ceil(ageInMonths / 24) * 2));
          
          predictions.push({
            id: generateId(),
            assetId: asset.id,
            type: 'ROUTINE',
            description: 'Furniture condition assessment and maintenance',
            recommendedDate: nextCheckupDate.toISOString(),
            confidence: 80,
            status: 'PENDING',
          });
        } catch (error) {
          console.error('Error creating furniture maintenance prediction:', error);
        }
      }
    }
    
    // 2. Ticket-based preventive maintenance
    if (asset.tickets && asset.tickets.length > 0) {
      try {
        // Check for recurring issues
        const issueTypes = asset.tickets.map((ticket: any) => 
          ticket.title ? ticket.title.toLowerCase() : 'unknown issue'
        );
        const issueFrequency: Record<string, number> = {};
        
        issueTypes.forEach((issue: string) => {
          issueFrequency[issue] = (issueFrequency[issue] || 0) + 1;
        });
        
        // Find recurring issues (mentioned more than once)
        Object.entries(issueFrequency).forEach(([issue, count]) => {
          if (count >= 2) {
            const preventiveDate = new Date();
            preventiveDate.setMonth(preventiveDate.getMonth() + 1); // Schedule 1 month from now
            
            predictions.push({
              id: generateId(),
              assetId: asset.id,
              type: 'PREVENTIVE',
              description: `Preventive maintenance to address recurring "${issue}" issues`,
              recommendedDate: preventiveDate.toISOString(),
              confidence: 75,
              status: 'PENDING',
            });
          }
        });
      } catch (error) {
        console.error('Error processing ticket-based maintenance:', error);
      }
      
      try {
        // 3. Critical maintenance for unresolved high-priority tickets or critical status
        const criticalTickets = asset.tickets.filter(
          (ticket: any) => 
            (ticket.status === 'OPEN' || ticket.status === 'IN_PROGRESS') && 
            (ticket.priority === 'CRITICAL' || ticket.priority === 'HIGH')
        );
        
        // Generate urgent maintenance prediction for critical tickets or critical asset status
        if (criticalTickets.length > 0 || asset.status === 'CRITICAL' || asset.status === 'DAMAGED') {
          const urgentDate = new Date();
          urgentDate.setDate(urgentDate.getDate() + 3); // Schedule within 3 days
          
          let description = '';
          let confidence = 95;
          
          if (asset.status === 'CRITICAL') {
            description = 'Immediate maintenance required - Asset in critical condition';
            confidence = 99;
          } else if (asset.status === 'DAMAGED') {
            description = 'Urgent repair needed - Asset is damaged';
            confidence = 90;
          } else {
            description = `Urgent maintenance required for ${criticalTickets.length} critical issue(s)`;
          }
          
          predictions.push({
            id: generateId(),
            assetId: asset.id,
            type: 'CRITICAL',
            description: description,
            recommendedDate: urgentDate.toISOString(),
            confidence: confidence,
            status: 'PENDING',
          });
        }
      } catch (error) {
        console.error('Error processing critical maintenance:', error);
      }
    }
    
    // 4. End-of-life prediction for old assets
    if (asset.purchaseDate) {
      try {
        const ageInMonths = getAgeInMonths(asset.purchaseDate);
        let expectedLifespanMonths = 60; // Default 5 years
        
        if (asset.type === 'FURNITURE') {
          expectedLifespanMonths = 120; // 10 years
        } else if (asset.type === 'ELECTRONICS') {
          expectedLifespanMonths = 36; // 3 years
        } else if (asset.type === 'EQUIPMENT') {
          expectedLifespanMonths = 60; // 5 years
        }
        
        // If asset is approaching end of life (>80% of expected lifespan)
        if (ageInMonths > expectedLifespanMonths * 0.8) {
          const replacementDate = new Date(asset.purchaseDate);
          replacementDate.setMonth(replacementDate.getMonth() + expectedLifespanMonths);
          
          predictions.push({
            id: generateId(),
            assetId: asset.id,
            type: 'PREVENTIVE',
            description: `Asset approaching end of life, consider replacement planning`,
            recommendedDate: replacementDate.toISOString(),
            confidence: 70,
            status: 'PENDING',
          });
        }
      } catch (error) {
        console.error('Error processing end-of-life prediction:', error);
      }
    }
    
    // 5. Usage-based maintenance predictions
    if (asset.movements && asset.movements.length > 0) {
      try {
        // More movements indicate higher usage and potential wear
        const movementCount = asset.movements.length;
        
        // If asset has been moved frequently (more than 5 times)
        if (movementCount > 5) {
          const maintenanceDate = new Date();
          maintenanceDate.setMonth(maintenanceDate.getMonth() + 2); // Schedule 2 months from now
          
          predictions.push({
            id: generateId(),
            assetId: asset.id,
            type: 'PREVENTIVE',
            description: `Preventive maintenance due to frequent relocation (${movementCount} moves)`,
            recommendedDate: maintenanceDate.toISOString(),
            confidence: 65,
            status: 'PENDING',
          });
        }
      } catch (error) {
        console.error('Error processing usage-based maintenance:', error);
      }
    }
    
    // Always generate at least one prediction for testing purposes
    if (predictions.length === 0) {
      const defaultDate = new Date();
      defaultDate.setMonth(defaultDate.getMonth() + 3); // Default 3 months from now
      
      predictions.push({
        id: generateId(),
        assetId: asset.id,
        type: 'ROUTINE',
        description: 'Regular maintenance check',
        recommendedDate: defaultDate.toISOString(),
        confidence: 60,
        status: 'PENDING',
      });
    }
    
    return predictions;
  } catch (error) {
    console.error('Error generating maintenance predictions:', error);
    return []; // Return empty array in case of error
  }
}

// Helper function to calculate age in months
function getAgeInMonths(dateString: string | Date) {
  try {
    // Handle invalid date strings
    if (!dateString) {
      console.warn('Invalid date provided to getAgeInMonths:', dateString);
      return 0;
    }
    
    const purchaseDate = new Date(dateString);
    
    // Check if date is valid
    if (isNaN(purchaseDate.getTime())) {
      console.warn('Invalid date conversion in getAgeInMonths:', dateString);
      return 0;
    }
    
    const now = new Date();
    
    return (now.getFullYear() - purchaseDate.getFullYear()) * 12 + 
           (now.getMonth() - purchaseDate.getMonth());
  } catch (error) {
    console.error('Error calculating age in months:', error);
    return 0; // Return 0 as a fallback
  }
}