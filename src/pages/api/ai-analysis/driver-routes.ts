import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import prisma from '@/lib/prisma';
import { logDataAccess } from '@/lib/audit';

interface RouteAnalysisResult {
  driverId: string;
  driverEmail: string;
  totalTrips: number;
  totalDistance: number;
  totalHours: number;
  averageSpeed: number;
  irregularStops: number;
  inefficientRoutes: number;
  fuelConsumptionEstimate: number;
  costSavingOpportunities: number;
  driverPerformance?: {
    safetyScore: number;
    efficiencyScore: number;
    consistencyScore: number;
    overallScore: number;
  };
  recommendations: {
    type: string;
    severity: 'high' | 'medium' | 'low' | 'info';
    message: string;
  }[];
  anomalies: {
    tripId: string;
    type: string;
    severity: 'high' | 'medium' | 'low';
    details: string;
    timestamp: string;
    location?: {
      latitude: number;
      longitude: number;
    };
  }[];
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Authenticate the user
    const supabase = createClient(req, res);
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      console.error('Authentication error:', error);
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get driver ID from query params
    const { driverId } = req.query;
    
    // If driverId is provided, get analysis for specific driver
    // Otherwise, get analysis for all drivers
    let analysisResults: RouteAnalysisResult[] = [];
    
    if (driverId && typeof driverId === 'string') {
      const driverAnalysis = await analyzeDriverRoutes(driverId);
      if (driverAnalysis) {
        analysisResults = [driverAnalysis];
      }
    } else {
      // Get all drivers who have trips
      const drivers = await prisma.user.findMany({
        where: {
          vehicles: {
            some: {} // Users who have at least one vehicle rental
          }
        },
        select: {
          id: true,
          email: true
        }
      });
      
      // Analyze routes for each driver
      const analysisPromises = drivers.map(driver => analyzeDriverRoutes(driver.id));
      const results = await Promise.all(analysisPromises);
      analysisResults = results.filter(Boolean) as RouteAnalysisResult[];
    }

    // Log the access
    try {
      await logDataAccess(
        'user',
        user.id,
        { 
          action: 'DRIVER_ROUTES_ANALYSIS', 
          description: `User accessed AI analysis for driver routes${driverId ? ` for driver ${driverId}` : ''}` 
        }
      );
    } catch (logError) {
      console.error('Error creating audit log:', logError);
      // Continue execution even if logging fails
    }

    return res.status(200).json({ 
      success: true,
      analysisResults
    });
  } catch (error) {
    console.error('Error analyzing driver routes:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

async function analyzeDriverRoutes(driverId: string): Promise<RouteAnalysisResult | null> {
  try {
    // Get driver information
    const driver = await prisma.user.findUnique({
      where: {
        id: driverId
      },
      select: {
        id: true,
        email: true
      }
    });

    if (!driver) {
      console.error(`Driver with ID ${driverId} not found`);
      return null;
    }

    // Get all trips for this driver
    const trips = await prisma.vehicleTrip.findMany({
      where: {
        userId: driverId,
        endTime: {
          not: null // Only completed trips
        }
      },
      orderBy: {
        startTime: 'desc'
      }
    });

    if (trips.length === 0) {
      // No trips to analyze
      return {
        driverId: driver.id,
        driverEmail: driver.email,
        totalTrips: 0,
        totalDistance: 0,
        totalHours: 0,
        averageSpeed: 0,
        irregularStops: 0,
        inefficientRoutes: 0,
        fuelConsumptionEstimate: 0,
        costSavingOpportunities: 0,
        driverPerformance: {
          safetyScore: 0,
          efficiencyScore: 0,
          consistencyScore: 0,
          overallScore: 0
        },
        recommendations: [
          {
            type: 'no_data',
            severity: 'info',
            message: 'No trip data available for analysis.'
          }
        ],
        anomalies: []
      };
    }

    // Calculate basic statistics
    let totalDistance = 0;
    let totalHours = 0;
    let totalFuelEstimate = 0;
    let irregularStops = 0;
    let inefficientRoutes = 0;

    // Analyze each trip
    const anomalies = [];
    
    for (const trip of trips) {
      totalDistance += trip.distance || 0;
      
      if (trip.endTime && trip.startTime) {
        const durationMs = new Date(trip.endTime).getTime() - new Date(trip.startTime).getTime();
        const durationHours = durationMs / (1000 * 60 * 60);
        totalHours += durationHours;
        
        // Estimate fuel consumption (simplified calculation)
        // Assuming average consumption of 10L/100km
        const fuelConsumption = (trip.distance / 100) * 10;
        totalFuelEstimate += fuelConsumption;
        
        // Analyze route efficiency if route points are available
        if (trip.routePoints) {
          try {
            const routePoints = typeof trip.routePoints === 'string' 
              ? JSON.parse(trip.routePoints) 
              : trip.routePoints;
            
            // Check for irregular stops (simplified)
            // In a real implementation, this would use more sophisticated algorithms
            if (Array.isArray(routePoints) && routePoints.length > 10) {
              // Detect potential stops by looking for clusters of points
              let potentialStops = 0;
              let lastPoint = null;
              let stationaryPoints = 0;
              
              for (const point of routePoints) {
                if (lastPoint && 
                    Math.abs(point.latitude - lastPoint.latitude) < 0.0001 && 
                    Math.abs(point.longitude - lastPoint.longitude) < 0.0001) {
                  stationaryPoints++;
                } else if (stationaryPoints > 5) { // If stationary for more than 5 consecutive points
                  potentialStops++;
                  stationaryPoints = 0;
                } else {
                  stationaryPoints = 0;
                }
                
                lastPoint = point;
              }
              
              // Add anomaly if there are too many stops
              if (potentialStops > 3) {
                irregularStops++;
                anomalies.push({
                  tripId: trip.id,
                  type: 'irregular_stops',
                  severity: 'medium',
                  details: `Trip has ${potentialStops} potential unscheduled stops`,
                  timestamp: trip.startTime,
                  location: {
                    latitude: trip.startLatitude,
                    longitude: trip.startLongitude
                  }
                });
              }
              
              // Check for inefficient routes (simplified)
              // In a real implementation, this would compare with optimal routes
              const directDistance = calculateHaversineDistance(
                trip.startLatitude, 
                trip.startLongitude, 
                trip.endLatitude || 0, 
                trip.endLongitude || 0
              );
              
              const efficiencyRatio = directDistance / trip.distance;
              
              // If actual route is much longer than direct distance
              if (efficiencyRatio < 0.7) {
                inefficientRoutes++;
                anomalies.push({
                  tripId: trip.id,
                  type: 'inefficient_route',
                  severity: 'medium',
                  details: `Route efficiency is ${(efficiencyRatio * 100).toFixed(1)}%. Consider more direct routes.`,
                  timestamp: trip.startTime
                });
              }
            }
          } catch (error) {
            console.error('Error analyzing route points:', error);
          }
        }
      }
    }

    // Calculate derived metrics
    const averageSpeed = totalHours > 0 ? totalDistance / totalHours : 0;
    
    // Estimate cost saving opportunities
    // Simplified calculation based on inefficient routes and irregular stops
    const costSavingOpportunities = (inefficientRoutes * 50) + (irregularStops * 30);

    // Generate recommendations based on analysis
    const recommendations = [];
    
    if (inefficientRoutes > 0) {
      recommendations.push({
        type: 'route_optimization',
        severity: inefficientRoutes > 3 ? 'high' : 'medium',
        message: `${inefficientRoutes} trips show inefficient routes. Optimizing these routes could save approximately ${(inefficientRoutes * 50).toFixed(2)} QAR in fuel costs.`
      });
    }
    
    if (irregularStops > 0) {
      recommendations.push({
        type: 'stop_reduction',
        severity: irregularStops > 3 ? 'high' : 'medium',
        message: `${irregularStops} trips have irregular or unscheduled stops. Reducing these could improve efficiency and save approximately ${(irregularStops * 30).toFixed(2)} QAR.`
      });
    }
    
    if (averageSpeed > 80) {
      recommendations.push({
        type: 'speed_management',
        severity: 'high',
        message: `Average speed of ${averageSpeed.toFixed(1)} km/h is high. Reducing speed can improve fuel efficiency and safety.`
      });
    } else if (averageSpeed < 20) {
      recommendations.push({
        type: 'traffic_management',
        severity: 'medium',
        message: `Average speed of ${averageSpeed.toFixed(1)} km/h is low. Consider route planning to avoid traffic congestion.`
      });
    }
    
    // Add general recommendation if no specific issues found
    if (recommendations.length === 0) {
      recommendations.push({
        type: 'general',
        severity: 'info',
        message: 'No significant issues detected. Continue monitoring for optimal performance.'
      });
    }

    // Calculate driver performance scores
    // Safety score - based on average speed and irregular stops
    const safetyScore = calculateSafetyScore(averageSpeed, irregularStops, trips.length);
    
    // Efficiency score - based on fuel consumption and inefficient routes
    const efficiencyScore = calculateEfficiencyScore(totalFuelEstimate, totalDistance, inefficientRoutes, trips.length);
    
    // Consistency score - based on trip patterns and anomalies
    const consistencyScore = calculateConsistencyScore(trips, anomalies);
    
    // Overall score - weighted average of all scores
    const overallScore = Math.round((safetyScore * 0.4) + (efficiencyScore * 0.4) + (consistencyScore * 0.2));

    return {
      driverId: driver.id,
      driverEmail: driver.email,
      totalTrips: trips.length,
      totalDistance,
      totalHours,
      averageSpeed,
      irregularStops,
      inefficientRoutes,
      fuelConsumptionEstimate: totalFuelEstimate,
      costSavingOpportunities,
      driverPerformance: {
        safetyScore,
        efficiencyScore,
        consistencyScore,
        overallScore
      },
      recommendations,
      anomalies
    };
  } catch (error) {
    console.error(`Error analyzing routes for driver ${driverId}:`, error);
    return null;
  }
}

// Haversine formula to calculate distance between two coordinates
function calculateHaversineDistance(
  lat1: number, 
  lon1: number, 
  lat2: number, 
  lon2: number
): number {
  const R = 6371; // Radius of the Earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c; // Distance in km
  
  return distance;
}

function deg2rad(deg: number): number {
  return deg * (Math.PI/180);
}

// Calculate safety score based on average speed and irregular stops
function calculateSafetyScore(averageSpeed: number, irregularStops: number, totalTrips: number): number {
  // Base score starts at 100
  let score = 100;
  
  // Penalize for high average speed
  if (averageSpeed > 90) {
    score -= 30; // Severe penalty for very high speed
  } else if (averageSpeed > 80) {
    score -= 20; // High penalty for high speed
  } else if (averageSpeed > 70) {
    score -= 10; // Moderate penalty for moderately high speed
  }
  
  // Penalize for irregular stops
  if (totalTrips > 0) {
    const stopsPerTrip = irregularStops / totalTrips;
    if (stopsPerTrip > 2) {
      score -= 30; // Severe penalty for many irregular stops per trip
    } else if (stopsPerTrip > 1) {
      score -= 15; // Moderate penalty for some irregular stops per trip
    } else if (stopsPerTrip > 0.5) {
      score -= 5; // Small penalty for few irregular stops per trip
    }
  }
  
  // Ensure score is between 0 and 100
  return Math.max(0, Math.min(100, Math.round(score)));
}

// Calculate efficiency score based on fuel consumption and inefficient routes
function calculateEfficiencyScore(
  fuelConsumption: number, 
  totalDistance: number, 
  inefficientRoutes: number, 
  totalTrips: number
): number {
  // Base score starts at 100
  let score = 100;
  
  // Penalize for high fuel consumption per distance
  if (totalDistance > 0) {
    const fuelPer100km = (fuelConsumption / totalDistance) * 100;
    if (fuelPer100km > 15) {
      score -= 30; // Severe penalty for very high consumption
    } else if (fuelPer100km > 12) {
      score -= 20; // High penalty for high consumption
    } else if (fuelPer100km > 10) {
      score -= 10; // Moderate penalty for moderately high consumption
    }
  }
  
  // Penalize for inefficient routes
  if (totalTrips > 0) {
    const inefficientRoutesPerTrip = inefficientRoutes / totalTrips;
    if (inefficientRoutesPerTrip > 0.5) {
      score -= 30; // Severe penalty for many inefficient routes
    } else if (inefficientRoutesPerTrip > 0.3) {
      score -= 15; // Moderate penalty for some inefficient routes
    } else if (inefficientRoutesPerTrip > 0.1) {
      score -= 5; // Small penalty for few inefficient routes
    }
  }
  
  // Ensure score is between 0 and 100
  return Math.max(0, Math.min(100, Math.round(score)));
}

// Calculate consistency score based on trip patterns and anomalies
function calculateConsistencyScore(
  trips: any[], 
  anomalies: { tripId: string; type: string; severity: string; details: string; timestamp: string; }[]
): number {
  // Base score starts at 100
  let score = 100;
  
  // Penalize for anomalies
  if (trips.length > 0) {
    const anomaliesPerTrip = anomalies.length / trips.length;
    if (anomaliesPerTrip > 0.5) {
      score -= 30; // Severe penalty for many anomalies per trip
    } else if (anomaliesPerTrip > 0.3) {
      score -= 15; // Moderate penalty for some anomalies per trip
    } else if (anomaliesPerTrip > 0.1) {
      score -= 5; // Small penalty for few anomalies per trip
    }
  }
  
  // Penalize for high severity anomalies
  const highSeverityAnomalies = anomalies.filter(a => a.severity === 'high').length;
  if (highSeverityAnomalies > 3) {
    score -= 20; // Severe penalty for many high severity anomalies
  } else if (highSeverityAnomalies > 1) {
    score -= 10; // Moderate penalty for some high severity anomalies
  } else if (highSeverityAnomalies > 0) {
    score -= 5; // Small penalty for few high severity anomalies
  }
  
  // Ensure score is between 0 and 100
  return Math.max(0, Math.min(100, Math.round(score)));
}