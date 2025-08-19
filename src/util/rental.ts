/**
 * Formats a rental ID in the standard format: RNT-YYYYMMDD-XXXX
 * 
 * @param startDate The start date of the rental
 * @param id The rental ID (used to generate the last 4 characters)
 * @param displayId Optional existing display ID
 * @returns Formatted rental ID string
 */
export function formatRentalId(
  startDate: string | Date,
  id: string,
  displayId?: string | null
): string {
  // If a valid display ID already exists, use it
  if (displayId && typeof displayId === 'string' && displayId.startsWith('RNT-')) {
    return displayId;
  }
  
  // Handle missing or invalid ID
  if (!id || typeof id !== 'string') {
    console.error('Invalid id provided to formatRentalId:', id);
    return 'RNT-INVALID-ID';
  }
  
  try {
    // Handle missing startDate
    if (!startDate) {
      console.error('Missing startDate in formatRentalId');
      return `RNT-NODATE-${id.substring(0, 4).toUpperCase()}`;
    }
    
    // Otherwise, generate a new display ID in the format RNT-YYYYMMDD-XXXX
    const date = new Date(startDate);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      console.error('Invalid date provided to formatRentalId:', startDate);
      return `RNT-INVALID-${id.substring(0, 4).toUpperCase()}`;
    }
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    // Ensure we have at least 4 characters from the ID, padding if necessary
    const idPart = id.length >= 4 
      ? id.substring(0, 4).toUpperCase() 
      : id.toUpperCase().padEnd(4, '0');
    
    return `RNT-${year}${month}${day}-${idPart}`;
  } catch (error) {
    console.error('Error formatting rental ID:', error);
    return `RNT-ERROR-${id.substring(0, 4).toUpperCase()}`;
  }
}

/**
 * Calculates the duration in days between two dates
 * 
 * @param startDate The start date
 * @param endDate The end date (defaults to current date if not provided)
 * @returns Number of days or 'N/A' if calculation fails
 */
export function calculateRentalDuration(
  startDate: string | Date,
  endDate?: string | Date | null
): number | string {
  try {
    // Handle null or undefined startDate
    if (!startDate) {
      console.error('Null or undefined startDate in calculateRentalDuration');
      return 'N/A';
    }
    
    // Parse dates safely
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : new Date();
    
    // Check if dates are valid
    if (isNaN(start.getTime())) {
      console.error('Invalid startDate in calculateRentalDuration:', { startDate });
      return 'N/A';
    }
    
    if (isNaN(end.getTime())) {
      console.error('Invalid endDate in calculateRentalDuration:', { endDate });
      // If end date is invalid but start date is valid, use current date
      const currentDate = new Date();
      const diffTime = Math.abs(currentDate.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays;
    }
    
    // Calculate duration
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // Ensure we return at least 1 day for same-day rentals
    return Math.max(1, diffDays);
  } catch (error) {
    console.error('Error calculating rental duration:', error);
    return 'N/A';
  }
}

/**
 * Formats a date string in a consistent format
 * 
 * @param dateString The date string to format
 * @param format The format to use (defaults to 'MMM dd, yyyy')
 * @returns Formatted date string or 'Invalid date' if formatting fails
 */
export function formatRentalDate(
  dateString: string | Date | null | undefined,
  format: string = 'MMM dd, yyyy'
): string {
  // Handle null, undefined or empty string
  if (!dateString) {
    return 'N/A';
  }
  
  try {
    // Handle string dates that might be in ISO format or other formats
    let date: Date;
    
    if (typeof dateString === 'string') {
      // Try to parse the date string
      if (dateString.includes('T')) {
        // ISO format with time
        date = new Date(dateString);
      } else if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // YYYY-MM-DD format
        const [year, month, day] = dateString.split('-').map(Number);
        date = new Date(year, month - 1, day);
      } else {
        // Other string format, let JavaScript try to parse it
        date = new Date(dateString);
      }
    } else {
      // Already a Date object
      date = dateString;
    }
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      console.error('Invalid date in formatRentalDate:', dateString);
      return 'Invalid date';
    }
    
    // Simple formatting for common formats
    if (format === 'MMM dd, yyyy') {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = months[date.getMonth()];
      const day = String(date.getDate()).padStart(2, '0');
      const year = date.getFullYear();
      
      return `${month} ${day}, ${year}`;
    } else if (format === 'yyyy-MM-dd') {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      
      return `${year}-${month}-${day}`;
    }
    
    // Default to ISO format without time
    return date.toISOString().split('T')[0];
  } catch (error) {
    console.error('Error formatting rental date:', error);
    return 'Error formatting date';
  }
}