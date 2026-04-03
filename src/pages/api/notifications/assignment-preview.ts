import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM || 'AssetXAI <noreply@assetxai.live>';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabase = createClient(req, res);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return res.status(401).json({ error: 'Unauthorized' });

  const { assigneeEmail, assigneeName, assetName, assetType, ticketId, ticketTitle } = req.body;

  if (!assigneeEmail) return res.status(400).json({ error: 'assigneeEmail is required' });

  try {
    await resend.emails.send({
      from: FROM,
      to: assigneeEmail,
      subject: `Asset Assignment Notification: ${assetName || 'Asset'}`,
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:system-ui,-apple-system,sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#4f46e5,#0284c7);padding:32px;text-align:center;">
      <div style="width:56px;height:56px;background:rgba(255,255,255,0.15);border-radius:14px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;">
        <span style="font-size:28px;">📦</span>
      </div>
      <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">Asset Assignment Notice</h1>
      <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">You have been selected to receive an asset</p>
    </div>
    <div style="padding:32px;">
      <p style="color:#374151;margin:0 0 20px;">Hello <strong>${assigneeName || assigneeEmail}</strong>,</p>
      <p style="color:#374151;margin:0 0 20px;">You have been identified as the recipient for the following asset. Please review the details below and be prepared to sign the digital assignment agreement.</p>

      <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:12px;padding:20px;margin-bottom:20px;">
        <h3 style="margin:0 0 12px;color:#0c4a6e;font-size:14px;text-transform:uppercase;letter-spacing:0.05em;">Asset Details</h3>
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:6px 0;color:#6b7280;font-size:13px;width:120px;">Asset Name</td>
            <td style="padding:6px 0;color:#111827;font-size:13px;font-weight:600;">${assetName || '—'}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#6b7280;font-size:13px;">Asset Type</td>
            <td style="padding:6px 0;color:#111827;font-size:13px;">${assetType || '—'}</td>
          </tr>
          ${ticketTitle ? `
          <tr>
            <td style="padding:6px 0;color:#6b7280;font-size:13px;">Linked Ticket</td>
            <td style="padding:6px 0;color:#7c3aed;font-size:13px;font-weight:600;">${ticketTitle}</td>
          </tr>` : ''}
        </table>
      </div>

      <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:12px;padding:16px;margin-bottom:24px;">
        <p style="margin:0;color:#92400e;font-size:13px;">
          ⚠️ <strong>Action Required:</strong> Your supervisor will present a digital signature form for your review. You will need to draw your signature to confirm receipt of this asset.
        </p>
      </div>

      <p style="color:#6b7280;font-size:13px;margin:0;">If you have any questions or concerns about this assignment, please contact your asset manager immediately.</p>
    </div>
    <div style="background:#f8fafc;border-top:1px solid #e5e7eb;padding:20px;text-align:center;">
      <p style="margin:0;color:#9ca3af;font-size:12px;">AssetXAI Asset Management Platform</p>
      <p style="margin:4px 0 0;color:#9ca3af;font-size:11px;">This is an automated notification. Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>`,
    });
    return res.status(200).json({ sent: true });
  } catch (err: any) {
    // Email failure is non-critical
    console.error('Assignment preview email error:', err);
    return res.status(200).json({ sent: false, error: err?.message });
  }
}
