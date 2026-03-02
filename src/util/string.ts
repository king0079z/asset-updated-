/**
 * Truncates a string to a specified maximum length and adds an ellipsis if truncated
 * @param str The string to truncate
 * @param maxLength The maximum length of the string
 * @returns The truncated string
 */
export function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
      return str;
  }
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Converts a string to a URL-friendly slug
 * @param str The string to convert to a slug
 * @returns The slugified string
 */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove non-word chars
    .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Capitalizes the first letter of each word in a string
 * @param str The string to capitalize
 * @returns The capitalized string
 */
export function capitalizeWords(str: string): string {
  return str
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Formats a number as a currency string
 * @param amount The amount to format
 * @param currency The currency code (default: 'USD')
 * @param locale The locale to use for formatting (default: 'en-US')
 * @returns The formatted currency string
 */
export function formatCurrency(amount: number, currency = 'USD', locale = 'en-US'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(amount);
}

/**
 * Generates a random string of specified length
 * @param length The length of the random string
 * @returns A random string
 */
export function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Extracts the initials from a name (first letter of first and last name)
 * @param name The name to extract initials from
 * @returns The initials
 */
export function getInitials(name: string): string {
  if (!name) return '';
  
  const parts = name.split(' ').filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/**
 * Removes HTML tags from a string
 * @param html The HTML string to clean
 * @returns The string without HTML tags
 */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

/**
 * Checks if a string is a valid email address
 * @param email The email address to validate
 * @returns True if the email is valid, false otherwise
 */
export function isValidEmail(email: string): boolean {
  const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(String(email).toLowerCase());
}

/**
 * Formats a date string to a localized date string
 * @param dateString The date string to format
 * @param locale The locale to use for formatting (default: 'en-US')
 * @returns The formatted date string
 */
export function formatDate(dateString: string, locale = 'en-US'): string {
  const date = new Date(dateString);
  return date.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}