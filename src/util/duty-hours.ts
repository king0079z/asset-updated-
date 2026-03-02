/**
 * Utility functions for checking duty hours
 */

/**
 * Checks if the current time is within duty hours
 * Duty hours: Sunday to Thursday, 8:00 AM to 2:30 PM
 * 
 * @param date Optional date to check (defaults to current time)
 * @returns boolean indicating if within duty hours
 */
export function isWithinDutyHours(date: Date = new Date()): boolean {
  const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const hour = date.getHours();
  const minute = date.getMinutes();
  const currentTime = hour * 60 + minute; // Convert to minutes since midnight
  
  // Duty hours: Sunday to Thursday, 8:00 AM to 2:30 PM
  const isDutyDay = dayOfWeek >= 0 && dayOfWeek <= 4; // Sunday to Thursday
  const dutyStartTime = 8 * 60; // 8:00 AM in minutes
  const dutyEndTime = 14 * 60 + 30; // 2:30 PM in minutes
  
  return isDutyDay && currentTime >= dutyStartTime && currentTime <= dutyEndTime;
}

/**
 * Checks if the current time is at the end of duty hours
 * End of duty hours is defined as 2:30 PM on duty days
 * 
 * @param date Optional date to check (defaults to current time)
 * @param marginMinutes Minutes before end time to consider as "end of duty" (default: 5)
 * @returns boolean indicating if at end of duty hours
 */
export function isEndOfDutyHours(date: Date = new Date(), marginMinutes: number = 5): boolean {
  const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const hour = date.getHours();
  const minute = date.getMinutes();
  const currentTime = hour * 60 + minute; // Convert to minutes since midnight
  
  // Duty hours: Sunday to Thursday, 8:00 AM to 2:30 PM
  const isDutyDay = dayOfWeek >= 0 && dayOfWeek <= 4; // Sunday to Thursday
  const dutyEndTime = 14 * 60 + 30; // 2:30 PM in minutes
  
  // Check if within margin minutes of end time
  return isDutyDay && 
         currentTime >= (dutyEndTime - marginMinutes) && 
         currentTime <= dutyEndTime;
}

/**
 * Gets the time remaining until the end of duty hours
 * 
 * @param date Optional date to check (defaults to current time)
 * @returns Minutes remaining until end of duty hours, or 0 if outside duty hours
 */
export function getMinutesUntilEndOfDuty(date: Date = new Date()): number {
  if (!isWithinDutyHours(date)) {
    return 0;
  }
  
  const hour = date.getHours();
  const minute = date.getMinutes();
  const currentTime = hour * 60 + minute; // Convert to minutes since midnight
  const dutyEndTime = 14 * 60 + 30; // 2:30 PM in minutes
  
  return Math.max(0, dutyEndTime - currentTime);
}