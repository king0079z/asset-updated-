import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import prisma from '@/lib/prisma';
import { analyzePossibleSolutions } from '@/lib/errorLogger';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  // Get the Supabase client
  const supabase = createClient(req, res);
  
  // Get user from session
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user || null;
  
  if (!user) {
    console.warn('Unauthorized access attempt to error logs analyze API');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // First try to get user data from the 'users' table
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('role, isAdmin')
    .eq('id', user.id)
    .single();
  
  // If that fails, try the 'User' table (note the capital 'U')
  const { data: userDataCapital, error: userErrorCapital } = await supabase
    .from('User')
    .select('role, isAdmin')
    .eq('id', user.id)
    .single();
  
  // Use whichever data we found
  const finalUserData = userData || userDataCapital;
  
  // Check if user is admin or manager by role OR has isAdmin flag set to true
  if (!finalUserData || ((finalUserData.role !== 'ADMIN' && finalUserData.role !== 'MANAGER') && !finalUserData.isAdmin)) {
    // Special case for admin@example.com - automatically grant access
    if (user.email === 'admin@example.com') {
      console.log(`Granting access to admin@example.com despite role/flag issues`);
    } else {
      console.log(`Access denied for user ${user.id}. Role: ${finalUserData?.role}, isAdmin: ${finalUserData?.isAdmin}`);
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }
  }

  try {
    const { errorId } = req.body;
    
    if (!errorId) {
      return res.status(400).json({ error: 'Error ID is required' });
    }
    
    // Get the error log
    const errorLog = await prisma.errorLog.findUnique({
      where: { id: errorId },
    });
    
    if (!errorLog) {
      return res.status(404).json({ error: 'Error log not found' });
    }
    
    // Analyze the error and suggest a solution
    let solution = analyzePossibleSolutions({
      message: errorLog.message,
      stack: errorLog.stack || undefined,
    });
    
    // Enhanced analysis for specific error types
    if (errorLog.context) {
      // Check if it's a movement detector error
      if (
        (errorLog.message.includes('Movement') || errorLog.message.includes('motion')) ||
        (errorLog.context.componentName === 'useMovementTypeDetection') ||
        (errorLog.context.additionalInfo?.errorSource === 'MovementDetector') ||
        (errorLog.context.functionName && errorLog.context.functionName.includes('movement'))
      ) {
        solution = await analyzeMovementDetectorError(errorLog);
      }
      // Check if it's a sensor-related error
      else if (
        errorLog.message.includes('sensor') ||
        errorLog.message.includes('DeviceMotion') ||
        errorLog.message.includes('DeviceOrientation') ||
        (errorLog.context.sensorData && Object.keys(errorLog.context.sensorData).length > 0)
      ) {
        solution = await analyzeSensorError(errorLog);
      }
      // Check if it's a performance-related error
      else if (
        errorLog.message.includes('memory') ||
        errorLog.message.includes('performance') ||
        errorLog.message.includes('timeout') ||
        errorLog.message.includes('slow') ||
        (errorLog.context.performanceMetrics && Object.keys(errorLog.context.performanceMetrics).length > 0)
      ) {
        solution = await analyzePerformanceError(errorLog);
      }
    }
    
    return res.status(200).json({ solution });
  } catch (error) {
    console.error('Error analyzing error log:', error);
    return res.status(500).json({ error: 'Failed to analyze error log' });
  }
}

/**
 * Specialized analysis for movement detector errors
 */
async function analyzeMovementDetectorError(errorLog: any): Promise<string> {
  let solution = "This appears to be an issue with the movement detection system. ";
  const context = errorLog.context || {};
  const sensorData = context.sensorData || {};
  const message = errorLog.message;
  const stack = errorLog.stack || '';
  
  // Check for device support issues
  if (!sensorData.accelerometer || message.includes('not supported') || stack.includes('not supported')) {
    solution += "The device doesn't support the required motion sensors. Consider implementing a fallback mechanism that doesn't rely on motion detection for this device. ";
    solution += "You can detect sensor support early and provide an alternative user experience.";
    return solution;
  }
  
  // Check for permission issues
  if (message.includes('permission') || stack.includes('permission')) {
    solution += "The app doesn't have permission to access motion sensors. Ensure you're requesting the appropriate permissions and providing clear explanations to users about why these permissions are needed. ";
    solution += "Consider implementing a more user-friendly permission request flow with clear instructions.";
    return solution;
  }
  
  // Check for calibration issues
  if (message.includes('calibration') || stack.includes('calibration') || context.functionName === 'calibrateDevice') {
    solution += "There was an error during sensor calibration. This could be due to unusual sensor readings or device-specific issues. ";
    solution += "Consider making the calibration process more robust by:\n";
    solution += "1. Increasing the sample size for calibration\n";
    solution += "2. Implementing more aggressive outlier rejection\n";
    solution += "3. Adding a manual calibration option for problematic devices\n";
    solution += "4. Using more conservative default thresholds when calibration fails";
    return solution;
  }
  
  // Check for classification issues
  if (message.includes('classification') || stack.includes('classification') || 
      context.functionName === 'simpleClassifyMovement' || context.functionName === 'enhancedClassifyMovement') {
    solution += "The movement classification algorithm is encountering issues. This could be due to unusual movement patterns or sensor noise. ";
    solution += "Consider:\n";
    solution += "1. Simplifying the classification algorithm for more reliability\n";
    solution += "2. Adding more robust error handling around the classification logic\n";
    solution += "3. Implementing a confidence threshold to only report high-confidence classifications\n";
    solution += "4. Adding more extensive logging to identify the specific patterns causing issues";
    return solution;
  }
  
  // Check for sample processing issues
  if (message.includes('sample') || stack.includes('sample') || context.functionName === 'filterSamples') {
    solution += "There's an issue with processing sensor samples. This could be due to unexpected data formats or values. ";
    solution += "Consider:\n";
    solution += "1. Adding more defensive checks for sample validity\n";
    solution += "2. Implementing more robust filtering to handle outliers\n";
    solution += "3. Adding bounds checking for all sample values\n";
    solution += "4. Limiting the sample buffer size to prevent memory issues";
    return solution;
  }
  
  // General movement detector solution
  solution += "To improve reliability, consider:\n";
  solution += "1. Implementing more robust error boundaries around the movement detection hook\n";
  solution += "2. Adding a 'safe mode' with simplified detection for problematic devices\n";
  solution += "3. Implementing graceful degradation when sensors are unreliable\n";
  solution += "4. Adding more detailed logging to identify the specific conditions causing errors\n";
  solution += "5. Consider using a simpler detection algorithm with fewer dependencies on device-specific sensor behavior";
  
  return solution;
}

/**
 * Specialized analysis for sensor-related errors
 */
async function analyzeSensorError(errorLog: any): Promise<string> {
  let solution = "This appears to be an issue with device sensors. ";
  const context = errorLog.context || {};
  const sensorData = context.sensorData || {};
  const message = errorLog.message;
  const stack = errorLog.stack || '';
  
  // Check for specific sensor issues
  if (message.includes('accelerometer') || stack.includes('accelerometer')) {
    solution += "The accelerometer sensor is causing issues. This could be due to device-specific implementations or permission problems. ";
    solution += "Consider implementing a fallback mechanism that doesn't rely on accelerometer data for affected devices.";
  } else if (message.includes('gyroscope') || stack.includes('gyroscope')) {
    solution += "The gyroscope sensor is causing issues. Not all devices have a gyroscope, so you should implement detection and fallbacks. ";
    solution += "Consider making gyroscope usage optional and providing alternative functionality.";
  } else if (message.includes('orientation') || stack.includes('orientation')) {
    solution += "The device orientation API is causing issues. This API has inconsistent implementation across browsers and devices. ";
    solution += "Consider using a more reliable approach or implementing extensive browser/device detection with appropriate fallbacks.";
  }
  
  // General sensor advice
  solution += "\n\nGeneral recommendations for sensor usage:\n";
  solution += "1. Always check for sensor availability before attempting to use it\n";
  solution += "2. Implement graceful fallbacks for devices without required sensors\n";
  solution += "3. Handle permission requests clearly and provide good UX when permissions are denied\n";
  solution += "4. Consider using sensor.js or similar libraries that normalize sensor behavior across devices\n";
  solution += "5. Implement aggressive error handling around all sensor code";
  
  return solution;
}

/**
 * Specialized analysis for performance-related errors
 */
async function analyzePerformanceError(errorLog: any): Promise<string> {
  let solution = "This appears to be a performance-related issue. ";
  const context = errorLog.context || {};
  const performanceMetrics = context.performanceMetrics || {};
  const message = errorLog.message;
  const stack = errorLog.stack || '';
  
  // Check for memory issues
  if (message.includes('memory') || stack.includes('memory') || 
      (performanceMetrics.memoryUsage && performanceMetrics.memoryUsage > 0.8)) {
    solution += "The application is experiencing memory issues. This could be due to memory leaks or excessive resource usage. ";
    solution += "Consider:\n";
    solution += "1. Checking for uncleared intervals, event listeners, or observers\n";
    solution += "2. Implementing memory monitoring and cleanup for long-running processes\n";
    solution += "3. Reducing the size of cached data or implementing better cache management\n";
    solution += "4. Using React.memo, useMemo, and useCallback to prevent unnecessary re-renders\n";
    solution += "5. Implementing pagination or virtualization for large data sets";
    return solution;
  }
  
  // Check for timeout issues
  if (message.includes('timeout') || stack.includes('timeout')) {
    solution += "The application is experiencing timeout issues. This could be due to long-running operations blocking the main thread. ";
    solution += "Consider:\n";
    solution += "1. Moving intensive operations to Web Workers\n";
    solution += "2. Implementing request timeouts and retry mechanisms\n";
    solution += "3. Breaking up long-running tasks into smaller chunks using setTimeout\n";
    solution += "4. Adding loading states and feedback for operations that might take time\n";
    solution += "5. Implementing progressive loading for large data sets";
    return solution;
  }
  
  // General performance advice
  solution += "To improve performance, consider:\n";
  solution += "1. Implementing code splitting to reduce initial bundle size\n";
  solution += "2. Using performance monitoring tools to identify bottlenecks\n";
  solution += "3. Optimizing expensive renders with React.memo, useMemo, and useCallback\n";
  solution += "4. Reducing unnecessary re-renders by optimizing state management\n";
  solution += "5. Implementing proper error boundaries to prevent cascading failures";
  
  return solution;
}