/**
 * Formats a user ID in a standardized format: USR-XXXX-XXXX
 * 
 * @param id The raw user ID
 * @returns Formatted user ID string
 */
export function formatUserId(id: string): string {
  if (!id) return 'USR-UNKNOWN';
  
  // Extract first 4 and last 4 characters from the ID
  const firstPart = id.substring(0, 4).toUpperCase();
  const lastPart = id.substring(Math.max(0, id.length - 4)).toUpperCase();
  
  return `USR-${firstPart}-${lastPart}`;
}