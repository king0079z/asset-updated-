// @ts-nocheck
import prisma from '@/lib/prisma';
import { ErrorSeverity } from '@prisma/client';

export type ErrorContext = {
  componentName?: string;
  functionName?: string;
  params?: Record<string, any>;
  additionalInfo?: Record<string, any>;
  userAction?: string;
  deviceInfo?: {
    platform?: string;
    browser?: string;
    screenSize?: string;
    orientation?: string;
    memoryInfo?: string;
    connectionType?: string;
  };
  appState?: Record<string, any>;
  sensorData?: {
    accelerometer?: boolean;
    gyroscope?: boolean;
    magnetometer?: boolean;
    lastReadings?: Record<string, any>;
  };
  performanceMetrics?: {
    memoryUsage?: number;
    cpuUsage?: number;
    loadTime?: number;
    networkLatency?: number;
  };
};

export type ErrorLogInput = {
  message: string;
  stack?: string;
  context?: ErrorContext;
  url?: string;
  userAgent?: string;
  userId?: string;
  userEmail?: string;
  severity?: ErrorSeverity;
};

/**
 * Logs an error to the database
 */
export async function logError(error: ErrorLogInput): Promise<void> {
  try {
    // Check if a similar error already exists
    const existingError = await prisma.errorLog.findFirst({
      where: {
        message: error.message,
        // Only match errors from the last 24 hours
        lastOccurredAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      },
    });

    if (existingError) {
      // Update the existing error
      await prisma.errorLog.update({
        where: { id: existingError.id },
        data: {
          occurrences: { increment: 1 },
          lastOccurredAt: new Date(),
          // Update context if new context is provided
          context: error.context ? { ...existingError.context, ...error.context } : existingError.context,
          // Update user info if not previously available
          userId: existingError.userId || error.userId,
          userEmail: existingError.userEmail || error.userEmail,
        },
      });
    } else {
      // Create a new error log
      await prisma.errorLog.create({
        data: {
          message: error.message,
          stack: error.stack,
          context: error.context,
          url: error.url,
          userAgent: error.userAgent,
          userId: error.userId,
          userEmail: error.userEmail,
          severity: error.severity || 'MEDIUM',
        },
      });
    }
  } catch (loggingError) {
    // If we can't log to the database, log to console as fallback
    console.error('Failed to log error to database:', loggingError);
    console.error('Original error:', error);
  }
}

/**
 * Analyzes an error and suggests possible solutions
 */
export function analyzePossibleSolutions(error: { message: string; stack?: string }): string {
  // Common error patterns and their solutions
  const errorPatterns = [
    {
      pattern: /TypeError: Cannot read properties? of (null|undefined)/i,
      solution: "This is likely a null reference error. Check that all objects are properly initialized before accessing their properties."
    },
    {
      pattern: /Network Error|Failed to fetch|ECONNREFUSED|ENOTFOUND/i,
      solution: "This appears to be a network connectivity issue. Check internet connection, API endpoint URLs, or server availability."
    },
    {
      pattern: /Unexpected token/i,
      solution: "This is likely a syntax error in your JSON data or code. Check the format of your data."
    },
    {
      pattern: /Permission denied|Unauthorized|401|403/i,
      solution: "This is an authentication or authorization error. Check user permissions or authentication tokens."
    },
    {
      pattern: /Not found|404/i,
      solution: "The requested resource was not found. Verify that the URL or resource ID is correct."
    },
    {
      pattern: /Maximum update depth exceeded/i,
      solution: "This is likely caused by an infinite loop in a React component. Check your useEffect dependencies or state updates."
    },
    {
      pattern: /memory leak|memory exhausted/i,
      solution: "There may be a memory leak in your application. Check for uncleared intervals, event listeners, or large data structures."
    },
    {
      pattern: /Sensor|DeviceMotionEvent|DeviceOrientationEvent/i,
      solution: "This is related to device motion sensors. Check sensor permissions or implement fallback mechanisms for unsupported devices."
    },
    {
      pattern: /Geolocation|getCurrentPosition|watchPosition/i,
      solution: "This is related to geolocation functionality. Verify that location permissions are granted and implement proper error handling."
    },
    {
      pattern: /Database|SQL|query|prisma/i,
      solution: "This appears to be a database-related error. Check your database connection, schema, or query syntax."
    }
  ];

  // Check if the error matches any known patterns
  for (const { pattern, solution } of errorPatterns) {
    if (pattern.test(error.message) || (error.stack && pattern.test(error.stack))) {
      return solution;
    }
  }

  // Default solution if no pattern matches
  return "No specific solution identified. Review the error details and context for more information.";
}

/**
 * Updates an error log with a solution
 */
export async function updateErrorWithSolution(errorId: string, solution: string, userId: string): Promise<void> {
  await prisma.errorLog.update({
    where: { id: errorId },
    data: {
      solution,
      status: 'RESOLVED',
      resolvedAt: new Date(),
      resolvedBy: userId,
    },
  });
}