/**
 * Public site origin for email confirmation, OAuth, and magic links.
 *
 * Production: set NEXT_PUBLIC_SITE_URL=https://assetxai.live (no trailing slash)
 * in Vercel env. If unset, VERCEL_URL is used on the server so preview deploys work.
 */
export function getPublicSiteUrl(): string {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '');
  if (explicit) return explicit;
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//, '');
    return `https://${host}`;
  }
  return '';
}
