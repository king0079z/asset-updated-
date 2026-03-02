import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import prisma from '@/lib/prisma';
import { differenceInHours } from 'date-fns';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Improved logging with consistent format
  const requestId = req.headers['x-vercel-id'] || 'unknown';
  console.log(`Path: ${req.url} START RequestId: ${requestId}`);
  
  try {
    // Create Supabase client
    const supabase = createClient(req, res);
    
    // Check if user is authenticated
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    const user = session?.user ?? null;
    
    if (authError) {
      console.error(`Path: ${req.url} Authentication error:`, authError);
      return res.status(401).json({ error: 'Authentication failed', details: authError.message });
    }
    
    if (!user) {
      console.log(`Path: ${req.url} Unauthorized access attempt`);
      return res.status(401).json({ error: 'Unauthorized' });
    }

    console.log(`Path: ${req.url} User authenticated: ${user.id}`);
    
    // GET - Retrieve KPI data
    if (req.method === 'GET') {
      console.log(`Path: ${req.url} Fetching KPI data for user: ${user.id}`);
      
      try {
        console.log(`Path: ${req.url} Querying database for tasks`);
        
        // Get all tasks
        const tasks = await prisma.plannerTask.findMany({
          include: {
            assignedToUser: {
              select: {
                id: true,
                email: true,
              },
            },
          },
        });
        
        console.log(`Path: ${req.url} Successfully retrieved ${tasks.length} tasks from database`);
        
        // Calculate KPIs
        const totalTasks = tasks.length;
        const completedTasks = tasks.filter(task => task.status === 'COMPLETED').length;
        const inProgressTasks = tasks.filter(task => task.status === 'IN_PROGRESS').length;
        
        // Calculate overdue tasks (tasks where endDate is in the past and status is not COMPLETED or CANCELLED)
        const now = new Date();
        const overdueTasks = tasks.filter(task => {
          try {
            return task.endDate && 
              new Date(task.endDate) < now && 
              task.status !== 'COMPLETED' && 
              task.status !== 'CANCELLED';
          } catch (error) {
            console.error(`Path: ${req.url} Error processing endDate for task ${task.id}:`, error);
            return false;
          }
        }).length;
        
        // Calculate completion rate
        const completionRate = totalTasks > 0 ? completedTasks / totalTasks : 0;
        
        // Calculate average completion time (in hours) for completed tasks with completedAt
        let totalCompletionTime = 0;
        let tasksWithCompletionTime = 0;
        
        tasks.forEach(task => {
          try {
            if (task.status === 'COMPLETED' && task.completedAt && task.startDate) {
              const completedAt = new Date(task.completedAt);
              const startDate = new Date(task.startDate);
              
              if (!isNaN(completedAt.getTime()) && !isNaN(startDate.getTime())) {
                const completionTime = differenceInHours(completedAt, startDate);
                if (completionTime >= 0) {
                  totalCompletionTime += completionTime;
                  tasksWithCompletionTime++;
                }
              }
            }
          } catch (error) {
            console.error(`Path: ${req.url} Error calculating completion time for task ${task.id}:`, error);
          }
        });
        
        const averageCompletionTime = tasksWithCompletionTime > 0 
          ? totalCompletionTime / tasksWithCompletionTime 
          : 0;
        
        // Calculate estimation accuracy
        let totalEstimationAccuracy = 0;
        let tasksWithEstimation = 0;
        
        tasks.forEach(task => {
          try {
            if (
              task.status === 'COMPLETED' && 
              task.estimatedHours !== null && 
              task.actualHours !== null &&
              task.estimatedHours > 0 && 
              task.actualHours > 0
            ) {
              // Calculate how close the estimate was to actual (1.0 means perfect, >1 means underestimated, <1 means overestimated)
              const accuracy = task.estimatedHours / task.actualHours;
              // Normalize to 0-1 range where 1 is perfect
              const normalizedAccuracy = accuracy > 1 
                ? 1 / accuracy  // If underestimated (e.g., estimated 2h but took 4h), accuracy is 0.5
                : accuracy;     // If overestimated (e.g., estimated 4h but took 2h), accuracy is 0.5
              
              totalEstimationAccuracy += normalizedAccuracy;
              tasksWithEstimation++;
            }
          } catch (error) {
            console.error(`Path: ${req.url} Error calculating estimation accuracy for task ${task.id}:`, error);
          }
        });
        
        const estimationAccuracy = tasksWithEstimation > 0 
          ? totalEstimationAccuracy / tasksWithEstimation 
          : 0;
        
        // Count tasks by priority
        const tasksByPriority = {
          LOW: tasks.filter(task => task.priority === 'LOW').length,
          MEDIUM: tasks.filter(task => task.priority === 'MEDIUM').length,
          HIGH: tasks.filter(task => task.priority === 'HIGH').length,
          URGENT: tasks.filter(task => task.priority === 'URGENT').length,
        };
        
        // Group tasks by assigned user
        const userMap = new Map();
        
        tasks.forEach(task => {
          if (task.assignedToUserId) {
            if (!userMap.has(task.assignedToUserId)) {
              userMap.set(task.assignedToUserId, {
                userId: task.assignedToUserId,
                userEmail: task.assignedToUser?.email || 'Unknown',
                totalTasks: 0,
                completedTasks: 0,
                overdueTasks: 0,
                totalCompletionTime: 0,
                tasksWithCompletionTime: 0,
              });
            }
            
            const userData = userMap.get(task.assignedToUserId);
            userData.totalTasks++;
            
            if (task.status === 'COMPLETED') {
              userData.completedTasks++;
              
              try {
                if (task.completedAt && task.startDate) {
                  const completedAt = new Date(task.completedAt);
                  const startDate = new Date(task.startDate);
                  
                  if (!isNaN(completedAt.getTime()) && !isNaN(startDate.getTime())) {
                    const completionTime = differenceInHours(completedAt, startDate);
                    if (completionTime >= 0) {
                      userData.totalCompletionTime += completionTime;
                      userData.tasksWithCompletionTime++;
                    }
                  }
                }
              } catch (error) {
                console.error(`Path: ${req.url} Error calculating user completion time for task ${task.id}:`, error);
              }
            }
            
            try {
              if (
                task.endDate && 
                new Date(task.endDate) < now && 
                task.status !== 'COMPLETED' && 
                task.status !== 'CANCELLED'
              ) {
                userData.overdueTasks++;
              }
            } catch (error) {
              console.error(`Path: ${req.url} Error checking if task ${task.id} is overdue:`, error);
            }
          }
        });
        
        // Convert user map to array and calculate average completion time
        const tasksByUser = Array.from(userMap.values()).map(userData => ({
          userId: userData.userId,
          userEmail: userData.userEmail,
          totalTasks: userData.totalTasks,
          completedTasks: userData.completedTasks,
          overdueTasks: userData.overdueTasks,
          averageCompletionTime: userData.tasksWithCompletionTime > 0 
            ? userData.totalCompletionTime / userData.tasksWithCompletionTime 
            : 0,
        }));
        
        // Get recent completions (last 5 completed tasks)
        const recentCompletions = tasks
          .filter(task => {
            try {
              return task.status === 'COMPLETED' && task.completedAt && !isNaN(new Date(task.completedAt).getTime());
            } catch (error) {
              console.error(`Path: ${req.url} Error filtering completed task ${task.id}:`, error);
              return false;
            }
          })
          .sort((a, b) => {
            try {
              const dateA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
              const dateB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
              return dateB - dateA; // Sort in descending order (newest first)
            } catch (error) {
              console.error(`Path: ${req.url} Error sorting completed tasks:`, error);
              return 0;
            }
          })
          .slice(0, 5)
          .map(task => {
            try {
              // Calculate efficiency (estimated vs actual hours)
              let efficiency = null;
              if (task.estimatedHours !== null && task.actualHours !== null && task.actualHours > 0) {
                efficiency = task.estimatedHours / task.actualHours;
              }
              
              return {
                id: task.id,
                title: task.title,
                completedAt: task.completedAt?.toISOString() || '',
                estimatedHours: task.estimatedHours,
                actualHours: task.actualHours,
                efficiency,
              };
            } catch (error) {
              console.error(`Path: ${req.url} Error mapping completed task ${task.id}:`, error);
              return {
                id: task.id,
                title: task.title || 'Unknown task',
                completedAt: '',
                estimatedHours: null,
                actualHours: null,
                efficiency: null,
              };
            }
          });
        
        // Generate AI insights based on the data
        const aiInsights = generateAiInsights({
          totalTasks,
          completedTasks,
          overdueTasks,
          inProgressTasks,
          completionRate,
          averageCompletionTime,
          estimationAccuracy,
          tasksByPriority,
          tasksByUser,
          recentCompletions,
        });
        
        // Compile KPI data
        const kpiData = {
          totalTasks,
          completedTasks,
          overdueTasks,
          inProgressTasks,
          completionRate,
          averageCompletionTime,
          estimationAccuracy,
          tasksByPriority,
          tasksByUser,
          recentCompletions,
          aiInsights,
        };
        
        console.log(`Path: ${req.url} Successfully generated KPI data`);
  res.setHeader('Cache-Control', 'private, max-age=60, stale-while-revalidate=30');

        return res.status(200).json(kpiData);
      } catch (error) {
        console.error(`Path: ${req.url} Error generating KPI data:`, error);
        return res.status(500).json({ error: 'Failed to generate KPI data', details: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
    
    console.log(`Path: ${req.url} Method not allowed: ${req.method}`);
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error(`Path: ${req.url} Error in KPI API:`, error);
    return res.status(500).json({ error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' });
  } finally {
    console.log(`Path: ${req.url} END RequestId: ${req.headers['x-vercel-id'] || 'unknown'}`);
  }
}

// Function to generate AI insights based on the KPI data
function generateAiInsights(data: any): string[] {
  const insights: string[] = [];
  
  // Insight 1: Completion rate
  if (data.totalTasks > 0) {
    const completionRatePercent = Math.round(data.completionRate * 100);
    if (completionRatePercent < 50) {
      insights.push(`Task completion rate is low at ${completionRatePercent}%. Consider reviewing task assignments and priorities to improve completion rates.`);
    } else if (completionRatePercent >= 80) {
      insights.push(`Excellent task completion rate of ${completionRatePercent}%. The team is effectively completing assigned tasks.`);
    }
  }
  
  // Insight 2: Overdue tasks
  if (data.overdueTasks > 0) {
    const overduePercent = Math.round((data.overdueTasks / data.totalTasks) * 100);
    if (overduePercent > 20) {
      insights.push(`${data.overdueTasks} tasks (${overduePercent}%) are currently overdue. Consider reassigning or reprioritizing these tasks to improve on-time completion.`);
    }
  }
  
  // Insight 3: Estimation accuracy
  if (data.estimationAccuracy > 0) {
    const accuracyPercent = Math.round(data.estimationAccuracy * 100);
    if (accuracyPercent < 70) {
      insights.push(`Task time estimation accuracy is ${accuracyPercent}%, which indicates room for improvement. Consider reviewing how tasks are estimated to improve planning.`);
    } else if (accuracyPercent >= 90) {
      insights.push(`Task time estimation accuracy is excellent at ${accuracyPercent}%. The team is effectively estimating task durations.`);
    }
  }
  
  // Insight 4: Priority distribution
  const highUrgentTasks = data.tasksByPriority.HIGH + data.tasksByPriority.URGENT;
  const totalPriorityTasks = data.tasksByPriority.LOW + data.tasksByPriority.MEDIUM + highUrgentTasks;
  
  if (totalPriorityTasks > 0) {
    const highUrgentPercent = Math.round((highUrgentTasks / totalPriorityTasks) * 100);
    if (highUrgentPercent > 50) {
      insights.push(`${highUrgentPercent}% of tasks are marked as high or urgent priority. This may indicate a need to better distribute priorities or address resource constraints.`);
    }
  }
  
  // Insight 5: User workload distribution
  if (data.tasksByUser.length > 1) {
    const maxUserTasks = Math.max(...data.tasksByUser.map((u: any) => u.totalTasks));
    const minUserTasks = Math.min(...data.tasksByUser.map((u: any) => u.totalTasks));
    
    if (maxUserTasks > minUserTasks * 2 && maxUserTasks > 5) {
      const busyUser = data.tasksByUser.find((u: any) => u.totalTasks === maxUserTasks);
      insights.push(`Workload appears unevenly distributed. ${busyUser.userEmail} has ${maxUserTasks} tasks assigned, which is significantly more than other team members.`);
    }
  }
  
  // Insight 6: Completion time trends
  if (data.recentCompletions.length >= 3) {
    const efficiencyValues = data.recentCompletions
      .filter((t: any) => t.efficiency !== null)
      .map((t: any) => t.efficiency);
    
    if (efficiencyValues.length >= 3) {
      const avgEfficiency = efficiencyValues.reduce((sum: number, val: number) => sum + val, 0) / efficiencyValues.length;
      if (avgEfficiency < 0.7) {
        insights.push(`Recent tasks are taking longer than estimated (average efficiency: ${Math.round(avgEfficiency * 100)}%). Consider adjusting time estimates for upcoming tasks.`);
      } else if (avgEfficiency > 1.3) {
        insights.push(`Recent tasks are being completed faster than estimated. This could indicate over-estimation or increased team efficiency.`);
      }
    }
  }
  
  // If no insights were generated, add a default one
  if (insights.length === 0) {
    insights.push("Insufficient data to generate meaningful insights. Continue tracking task completions to receive AI-powered recommendations.");
  }
  
  return insights;
}