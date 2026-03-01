import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { id } = req.query;
    const supabase = createClient(req, res);
    
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user ?? null;

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get asset details
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
      return res.status(404).json({ error: 'Asset not found' });
    }

    // Calculate health score
    const healthScore = await calculateHealthScore(asset);
    
    // Generate maintenance predictions
    const maintenancePredictions = await generateMaintenancePredictions(asset);

    // Get lifecycle events
    const lifecycleEvents = await getLifecycleEvents(asset);

    // Calculate total cost of ownership
    const totalCostOfOwnership = calculateTotalCostOfOwnership(asset);
  res.setHeader('Cache-Control', 'private, max-age=60, stale-while-revalidate=30');


    return res.status(200).json({
      healthScore: {
        score: healthScore.score,
        factors: healthScore.factors,
      },
      maintenancePredictions,
      lifecycleEvents,
      totalCostOfOwnership,
    });
  } catch (error) {
    console.error('Error fetching asset health:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function calculateHealthScore(asset: any) {
  try {
    // Default factors
    let ageScore = 100;
    let maintenanceScore = 100;
    let usageScore = 100;
    let conditionScore = 100;

    // Age factor calculation
    if (asset.purchaseDate) {
      try {
        console.log(`Calculating age for asset ${asset.id} with purchase date: ${asset.purchaseDate}`);
        
        const ageInMonths = getAgeInMonths(asset.purchaseDate);
        console.log(`Age in months: ${ageInMonths}`);
        
        // Assume different asset types have different expected lifespans
        let expectedLifespanMonths = 60; // Default 5 years
        
        if (asset.type === 'FURNITURE') {
          expectedLifespanMonths = 120; // 10 years
        } else if (asset.type === 'ELECTRONICS') {
          expectedLifespanMonths = 36; // 3 years
        }
        
        // Calculate age score (newer = better)
        ageScore = Math.max(0, Math.min(100, 100 - (ageInMonths / expectedLifespanMonths) * 100));
        console.log(`Calculated age score: ${ageScore}`);
      } catch (error) {
        console.error('Error calculating age score:', error);
        // Keep default age score
      }
    } else {
      console.log(`No purchase date for asset ${asset.id}, using default age score: ${ageScore}`);
    }

    // Maintenance factor calculation
    if (asset.tickets && asset.tickets.length > 0) {
      // Count resolved vs. unresolved tickets
      const totalTickets = asset.tickets.length;
      const resolvedTickets = asset.tickets.filter(
        (ticket: any) => ticket.status === 'RESOLVED' || ticket.status === 'CLOSED'
      ).length;
      
      // Calculate maintenance score based on ticket resolution rate
      const resolutionRate = totalTickets > 0 ? resolvedTickets / totalTickets : 1;
      maintenanceScore = Math.round(resolutionRate * 100);
      
      // Adjust for critical unresolved tickets
      const unresolvedCriticalTickets = asset.tickets.filter(
        (ticket: any) => 
          (ticket.status === 'OPEN' || ticket.status === 'IN_PROGRESS') && 
          ticket.priority === 'CRITICAL'
      ).length;
      
      if (unresolvedCriticalTickets > 0) {
        maintenanceScore = Math.max(0, maintenanceScore - (unresolvedCriticalTickets * 20));
      }
    }

    // Usage factor calculation
    if (asset.movements && asset.movements.length > 0) {
      // More movements = more wear and tear
      const movementCount = asset.movements.length;
      
      // Calculate usage score (fewer movements = better condition)
      usageScore = Math.max(0, Math.min(100, 100 - (movementCount * 5)));
      
      // Adjust for recent movements
      const recentMovements = asset.movements.filter(
        (movement: any) => {
          try {
            const movementDate = new Date(movement.movedAt);
            if (isNaN(movementDate.getTime())) {
              return false;
            }
            const threeMonthsAgo = new Date();
            threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
            return movementDate > threeMonthsAgo;
          } catch (error) {
            console.error('Error processing movement date:', error);
            return false;
          }
        }
      ).length;
      
      if (recentMovements > 0) {
        usageScore = Math.max(0, usageScore - (recentMovements * 10));
      }
    }

    // Condition factor calculation based on asset status
    switch (asset.status) {
      case 'DISPOSED':
        conditionScore = 0; // Asset is no longer usable
        break;
      case 'CRITICAL':
        conditionScore = 10; // Asset is in critical condition, needs immediate attention
        break;
      case 'DAMAGED':
        conditionScore = 30; // Asset is damaged but still usable with limitations
        break;
      case 'MAINTENANCE':
        conditionScore = 50; // Asset is under maintenance, temporarily not at full capacity
        break;
      case 'IN_TRANSIT':
        conditionScore = 70; // Slightly reduced during transit
        break;
      case 'ACTIVE':
        conditionScore = 90; // Normal operational condition
        break;
      case 'LIKE_NEW':
        conditionScore = 100; // Asset is in excellent condition
        break;
      default:
        conditionScore = 90; // Default to active if status is unknown
    }
    
    // Adjust condition based on ticket history
    if (asset.tickets && asset.tickets.length > 0) {
      const recentTickets = asset.tickets.filter((ticket: any) => {
        try {
          const ticketDate = new Date(ticket.createdAt);
          if (isNaN(ticketDate.getTime())) {
            return false;
          }
          const sixMonthsAgo = new Date();
          sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
          return ticketDate > sixMonthsAgo;
        } catch (error) {
          console.error('Error processing ticket date:', error);
          return false;
        }
      }).length;
      
      conditionScore = Math.max(0, conditionScore - (recentTickets * 5));
    }
    
    // Adjust condition based on status change history
    if (asset.history && asset.history.length > 0) {
      try {
        // Count status changes in the last 3 months
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        
        // Filter for STATUS_CHANGED actions in the last 3 months
        const recentStatusChanges = asset.history.filter((historyItem: any) => {
          if (!historyItem || historyItem.action !== 'STATUS_CHANGED') return false;
          
          try {
            const changeDate = new Date(historyItem.createdAt);
            if (isNaN(changeDate.getTime())) return false;
            return changeDate > threeMonthsAgo;
          } catch (error) {
            console.error('Error processing history date:', error);
            return false;
          }
        });
        
        // Count transitions to MAINTENANCE status
        const maintenanceTransitions = recentStatusChanges.filter((historyItem: any) => {
          try {
            return historyItem.details && 
                  historyItem.details.toStatus === 'MAINTENANCE';
          } catch (error) {
            return false;
          }
        }).length;
        
        // Count transitions from MAINTENANCE to ACTIVE (repairs)
        const repairTransitions = recentStatusChanges.filter((historyItem: any) => {
          try {
            return historyItem.details && 
                  historyItem.details.fromStatus === 'MAINTENANCE' && 
                  historyItem.details.toStatus === 'ACTIVE';
          } catch (error) {
            return false;
          }
        }).length;
        
        // Frequent transitions to maintenance indicate potential issues
        if (maintenanceTransitions > 0) {
          // Each maintenance transition reduces score by 10%
          conditionScore = Math.max(0, conditionScore - (maintenanceTransitions * 10));
          console.log(`Adjusted condition score for maintenance transitions: -${maintenanceTransitions * 10}`);
        }
        
        // Successful repairs (MAINTENANCE -> ACTIVE) slightly improve the score
        if (repairTransitions > 0) {
          // Each successful repair adds back 5% (but doesn't exceed the base status score)
          const baseStatusScore = asset.status === 'ACTIVE' ? 90 : 
                                 (asset.status === 'LIKE_NEW' ? 100 : conditionScore);
          const repairBonus = repairTransitions * 5;
          conditionScore = Math.min(baseStatusScore, conditionScore + repairBonus);
          console.log(`Adjusted condition score for repair transitions: +${repairBonus}`);
        }
      } catch (error) {
        console.error('Error processing status change history:', error);
      }
    }

    // Calculate overall health score (weighted average)
    const overallScore = Math.round(
      (ageScore * 0.25) + 
      (maintenanceScore * 0.3) + 
      (usageScore * 0.2) + 
      (conditionScore * 0.25)
    );

    return {
      score: overallScore,
      factors: {
        age: Math.round(ageScore),
        maintenance: Math.round(maintenanceScore),
        usage: Math.round(usageScore),
        condition: Math.round(conditionScore),
      },
    };
  } catch (error) {
    console.error('Error calculating health score:', error);
    // Return default values in case of error
    return {
      score: 50,
      factors: {
        age: 50,
        maintenance: 50,
        usage: 50,
        condition: 50,
      },
    };
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
    
    return predictions;
  } catch (error) {
    console.error('Error generating maintenance predictions:', error);
    return []; // Return empty array in case of error
  }
}

async function getLifecycleEvents(asset: any) {
  try {
    const events = [];
    
    // Generate unique IDs for events
    const generateId = () => `event_${Math.random().toString(36).substring(2, 15)}`;
    
    // 1. Add movements as lifecycle events
    if (asset.movements && asset.movements.length > 0) {
      try {
        asset.movements.forEach((movement: any) => {
          if (!movement) return;
          
          events.push({
            id: generateId(),
            type: 'MOVEMENT',
            date: movement.movedAt,
            description: `Moved from Floor ${movement.fromFloor || 'Unknown'}, Room ${movement.fromRoom || 'Unknown'} to Floor ${movement.toFloor || 'Unknown'}, Room ${movement.toRoom || 'Unknown'}`,
            performedBy: 'System User',
          });
        });
      } catch (error) {
        console.error('Error processing movements:', error);
      }
    }
    
    // 2. Add ticket-related events
    if (asset.tickets && asset.tickets.length > 0) {
      try {
        asset.tickets.forEach((ticket: any) => {
          if (!ticket) return;
          
          // Add ticket creation as maintenance event
          events.push({
            id: generateId(),
            type: ticket.priority === 'CRITICAL' || ticket.priority === 'HIGH' ? 'REPAIR' : 'MAINTENANCE',
            date: ticket.createdAt,
            description: ticket.title || 'Maintenance ticket',
            performedBy: ticket.user?.email || 'System User',
          });
          
          // Add ticket resolution as maintenance event if resolved
          if (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') {
            const resolutionHistory = ticket.history?.find((h: any) => 
              h && (h.status === 'RESOLVED' || h.status === 'CLOSED')
            );
            
            if (resolutionHistory) {
              events.push({
                id: generateId(),
                type: 'MAINTENANCE',
                date: resolutionHistory.createdAt,
                description: `Resolved: ${ticket.title || 'Maintenance ticket'}`,
                performedBy: resolutionHistory.user?.email || 'System User',
              });
            }
          }
        });
      } catch (error) {
        console.error('Error processing tickets:', error);
      }
    }
    
    // 3. Add disposal event if applicable
    if (asset.status === 'DISPOSED' && asset.disposedAt) {
      try {
        events.push({
          id: generateId(),
          type: 'DISPOSAL',
          date: asset.disposedAt,
          description: 'Asset disposed from inventory',
          performedBy: 'System User',
        });
      } catch (error) {
        console.error('Error processing disposal event:', error);
      }
    }
    
    // 4. Add other history events
    if (asset.history && asset.history.length > 0) {
      try {
        asset.history.forEach((historyItem: any) => {
          if (!historyItem) return;
          
          if (historyItem.action === 'UPDATED') {
            events.push({
              id: generateId(),
              type: 'INSPECTION',
              date: historyItem.createdAt,
              description: 'Asset information updated',
              performedBy: historyItem.user?.email || 'System User',
            });
          } else if (historyItem.action === 'STATUS_CHANGED') {
            // Extract status change details from the history item
            let eventType = 'STATUS_CHANGE';
            let description = 'Asset status changed';
            
            try {
              if (historyItem.details && typeof historyItem.details === 'object') {
                const details = historyItem.details;
                const fromStatus = details.fromStatus || 'Unknown';
                const toStatus = details.toStatus || 'Unknown';
                
                description = `Status changed from ${fromStatus} to ${toStatus}`;
                
                // Assign specific event types based on the new status
                if (toStatus === 'MAINTENANCE') {
                  eventType = 'MAINTENANCE';
                } else if (toStatus === 'DAMAGED' || toStatus === 'CRITICAL') {
                  eventType = 'ISSUE';
                } else if (toStatus === 'LIKE_NEW') {
                  eventType = 'REFURBISHMENT';
                }
              }
            } catch (detailsError) {
              console.error('Error processing status change details:', detailsError);
            }
            
            events.push({
              id: generateId(),
              type: eventType,
              date: historyItem.createdAt,
              description: description,
              performedBy: historyItem.user?.email || 'System User',
            });
          }
        });
      } catch (error) {
        console.error('Error processing history events:', error);
      }
    }
    
    return events;
  } catch (error) {
    console.error('Error generating lifecycle events:', error);
    return []; // Return empty array in case of error
  }
}

// Helper function to calculate age in months
function getAgeInMonths(dateString: string | Date | null) {
  try {
    // Handle invalid date strings
    if (!dateString) {
      console.warn('Invalid date provided to getAgeInMonths:', dateString);
      return 0;
    }
    
    // Log the input date for debugging
    console.log(`getAgeInMonths input: ${dateString}, type: ${typeof dateString}`);
    
    let purchaseDate: Date;
    
    // Handle different date formats
    if (typeof dateString === 'string') {
      // Check for null or empty string values
      if (dateString === 'null' || dateString === '') {
        console.warn('Empty or null string provided to getAgeInMonths');
        return 0;
      }
      
      // Try to parse ISO format first
      purchaseDate = new Date(dateString);
      
      // If that fails, try to parse other common formats
      if (isNaN(purchaseDate.getTime())) {
        console.log(`Failed to parse date in standard format: ${dateString}`);
        
        // Try DD/MM/YYYY format
        if (dateString.includes('/')) {
          const parts = dateString.split('/');
          if (parts.length === 3) {
            purchaseDate = new Date(
              parseInt(parts[2]), // year
              parseInt(parts[1]) - 1, // month (0-indexed)
              parseInt(parts[0]) // day
            );
            console.log(`Parsed as DD/MM/YYYY: ${purchaseDate.toISOString()}`);
          }
        }
        // Try YYYY-MM-DD format
        else if (dateString.includes('-')) {
          purchaseDate = new Date(dateString + 'T00:00:00Z');
          console.log(`Parsed as YYYY-MM-DD: ${purchaseDate.toISOString()}`);
        }
      } else {
        console.log(`Successfully parsed date in standard format: ${purchaseDate.toISOString()}`);
      }
    } else if (dateString instanceof Date) {
      // If it's already a Date object
      purchaseDate = dateString;
      
      // Ensure the Date object is valid
      if (isNaN(purchaseDate.getTime())) {
        console.warn('Invalid Date object provided to getAgeInMonths');
        return 0;
      }
      
      console.log(`Date object provided: ${purchaseDate.toISOString()}`);
    } else {
      // Handle BigInt or other non-standard date formats from database
      try {
        console.log(`Attempting to convert non-standard date type: ${typeof dateString}`);
        const dateStr = String(dateString);
        purchaseDate = new Date(dateStr);
        
        if (isNaN(purchaseDate.getTime())) {
          // Try to extract date parts if it's a non-standard format
          const matches = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
          if (matches) {
            purchaseDate = new Date(
              parseInt(matches[1]), // year
              parseInt(matches[2]) - 1, // month (0-indexed)
              parseInt(matches[3]) // day
            );
            console.log(`Extracted date parts: ${purchaseDate.toISOString()}`);
          } else {
            console.warn(`Could not parse non-standard date: ${dateStr}`);
            return 0;
          }
        }
      } catch (conversionError) {
        console.error('Error converting non-standard date:', conversionError);
        return 0;
      }
    }
    
    // Check if date is valid
    if (isNaN(purchaseDate.getTime())) {
      console.warn('Invalid date conversion in getAgeInMonths:', dateString);
      return 0;
    }
    
    const now = new Date();
    
    // Calculate difference in months
    const months = (now.getFullYear() - purchaseDate.getFullYear()) * 12 + 
                  (now.getMonth() - purchaseDate.getMonth());
    
    console.log(`Age calculation: Current date: ${now.toISOString()}, Purchase date: ${purchaseDate.toISOString()}, Age in months: ${months}`);
    
    return months;
  } catch (error) {
    console.error('Error calculating age in months:', error, 'for date:', dateString);
    return 0; // Return 0 as a fallback
  }
}

// Calculate total cost of ownership
function calculateTotalCostOfOwnership(asset: any) {
  try {
    let totalCost = 0;
    
    // Add initial purchase amount
    if (asset.purchaseAmount && !isNaN(Number(asset.purchaseAmount))) {
      totalCost += Number(asset.purchaseAmount);
    }
    
    // Add maintenance costs from tickets
    if (asset.tickets && asset.tickets.length > 0) {
      asset.tickets.forEach((ticket: any) => {
        // Estimate maintenance costs based on ticket priority
        if (ticket.priority === 'CRITICAL') {
          totalCost += 1000; // High cost for critical issues
        } else if (ticket.priority === 'HIGH') {
          totalCost += 500; // Medium cost for high priority
        } else if (ticket.priority === 'MEDIUM') {
          totalCost += 250; // Lower cost for medium priority
        } else {
          totalCost += 100; // Minimal cost for low priority
        }
      });
    }
    
    // Add estimated depreciation
    if (asset.purchaseAmount && asset.purchaseDate) {
      try {
        const purchaseAmount = Number(asset.purchaseAmount);
        if (!isNaN(purchaseAmount)) {
          // Calculate depreciation based on asset type and age
          const ageInMonths = getAgeInMonths(asset.purchaseDate);
          let depreciationRate = 0.1; // Default 10% annual depreciation
          
          if (asset.type === 'ELECTRONICS') {
            depreciationRate = 0.25; // 25% annual depreciation for electronics
          } else if (asset.type === 'FURNITURE') {
            depreciationRate = 0.05; // 5% annual depreciation for furniture
          } else if (asset.type === 'EQUIPMENT') {
            depreciationRate = 0.15; // 15% annual depreciation for equipment
          }
          
          // Calculate monthly depreciation rate
          const monthlyDepreciationRate = depreciationRate / 12;
          
          // Calculate total depreciation (but don't exceed purchase amount)
          const totalDepreciation = Math.min(
            purchaseAmount, 
            purchaseAmount * monthlyDepreciationRate * ageInMonths
          );
          
          // Add depreciation to total cost
          totalCost += totalDepreciation;
        }
      } catch (error) {
        console.error('Error calculating depreciation:', error);
      }
    }
    
    // Add estimated operational costs (e.g., electricity for electronics)
    if (asset.type === 'ELECTRONICS' && asset.purchaseDate) {
      try {
        const ageInMonths = getAgeInMonths(asset.purchaseDate);
        // Estimate monthly operational cost as 2% of purchase amount
        const monthlyOperationalCost = asset.purchaseAmount ? Number(asset.purchaseAmount) * 0.02 : 20;
        totalCost += monthlyOperationalCost * ageInMonths;
      } catch (error) {
        console.error('Error calculating operational costs:', error);
      }
    }
    
    return {
      totalCost: Math.round(totalCost), // Round to nearest integer
      currency: 'QAR',
      breakdown: {
        initialCost: asset.purchaseAmount ? Number(asset.purchaseAmount) : 0,
        maintenanceCosts: asset.tickets ? asset.tickets.length * 200 : 0, // Simplified estimate
        operationalCosts: asset.type === 'ELECTRONICS' && asset.purchaseDate ? 
          Math.round(getAgeInMonths(asset.purchaseDate) * (asset.purchaseAmount ? Number(asset.purchaseAmount) * 0.02 : 20)) : 0
      }
    };
  } catch (error) {
    console.error('Error calculating total cost of ownership:', error);
    return {
      totalCost: 0,
      currency: 'QAR',
      breakdown: {
        initialCost: 0,
        maintenanceCosts: 0,
        operationalCosts: 0
      }
    };
  }
}