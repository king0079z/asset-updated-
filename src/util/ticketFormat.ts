/**
 * Utility functions for consistent ticket ID formatting
 */

/**
 * Formats a ticket ID consistently across the application
 * @param displayId The display ID from the database (e.g., TKT-20250326-0001)
 * @param ticketId The raw ticket ID (used as fallback)
 * @returns Properly formatted ticket ID string
 */
export const formatTicketId = (displayId: string | null | undefined, ticketId: string): string => {
  // If we have a valid displayId in the correct format, use it as is
  if (displayId && /^TKT-\d{8}-\d{4}$/.test(displayId)) {
    return displayId;
  }
  
  // If we have a displayId but it's not in the expected format, still use it
  // This handles any legacy or custom format IDs
  if (displayId) {
    return displayId;
  }
  
  // Fallback: create a shortened ID from the ticket's cuid
  return `TKT-${ticketId.substring(0, 8)}`;
};