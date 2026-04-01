import { Resend } from 'resend';

let resendClient: Resend | null = null;

export function getResendClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!resendClient) resendClient = new Resend(key);
  return resendClient;
}

export const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'AssetAI <noreply@assetxai.live>';
