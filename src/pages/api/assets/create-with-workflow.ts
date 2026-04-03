// @ts-nocheck
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';
import { logDataModification, logUserActivity } from '@/lib/audit';
import { getUserRoleData } from '@/util/roleCheck';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM || 'AssetXAI <noreply@assetxai.live>';

function generateAssetId(type: string) {
  const prefix = type.substring(0, 2).toUpperCase();
  return `${prefix}${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
}
function generateBarcode(assetId: string) {
  const clean = assetId.replace(/[^A-Z0-9]/g, '');
  return clean.length < 8 ? clean + '0'.repeat(8 - clean.length) : clean;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  try {
    const supabase = createClient(req, res);
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    const user = session?.user ?? null;
    if (authError || !user) return res.status(401).json({ message: 'Unauthorized' });

    const roleData = await getUserRoleData(user.id);
    const organizationId = roleData?.organizationId ?? null;

    const {
      // Asset fields (same as create.ts)
      name, description, type, vendorId, departmentId,
      floorNumber, roomNumber, imageUrl,
      latitude, longitude, locationAccuracy, locationSource,
      purchaseAmount, purchaseDate,
      batchNumber, serialNumber, donorName, nextServiceDate, isProvisional,
      isSparePart,
      assignedToId, assignedToEmail, assignedToName,
      // Workflow fields
      ticketId,           // ID of linked ticket (null if none)
      signatureDataUrl,   // base64 PNG of signature canvas
      pdfDataUrl,         // base64 PNG of full signed form
      signedAt,           // ISO timestamp
    } = req.body;

    if (!name || !type) return res.status(400).json({ message: 'name and type are required' });

    const assetId = generateAssetId(type);
    const barcode = generateBarcode(assetId);

    let parsedPurchaseDate: Date | null = null;
    if (purchaseDate) {
      try { const d = new Date(purchaseDate); if (!isNaN(d.getTime())) parsedPurchaseDate = d; } catch { /* ignore */ }
    }

    const isSpare = type === 'SPARE_PART' || isSparePart === true || isSparePart === 'true';

    const asset = await prisma.$transaction(async (tx) => {
      // 1. Create asset
      const newAsset = await tx.asset.create({
        data: {
          assetId, name, barcode, type,
          description: description || '',
          imageUrl: imageUrl || null,
          floorNumber: floorNumber || null,
          roomNumber: roomNumber || null,
          status: 'ACTIVE',
          userId: user.id,
          vendorId: vendorId || null,
          organizationId: organizationId || null,
          departmentId: departmentId || null,
          purchaseAmount: purchaseAmount ? parseFloat(purchaseAmount) : null,
          purchaseDate: parsedPurchaseDate,
          isSparePart: isSpare,
          assignedToId: isSpare ? null : (assignedToId || null),
          assignedToEmail: isSpare ? null : (assignedToEmail || null),
          assignedToName: isSpare ? null : (assignedToName || null),
          assignedAt: (!isSpare && assignedToId) ? new Date() : null,
          location: latitude && longitude ? {
            create: {
              latitude: parseFloat(latitude),
              longitude: parseFloat(longitude),
              accuracy: locationAccuracy ? parseFloat(locationAccuracy) : null,
              source: locationSource || null,
            },
          } : undefined,
        },
        include: { vendor: { select: { name: true } }, location: true },
      });

      // 2. REGISTERED history
      await tx.assetHistory.create({
        data: {
          assetId: newAsset.id,
          userId: user.id,
          action: 'REGISTERED',
          details: { type, floorNumber, roomNumber, assignedToEmail: assignedToEmail || null },
        },
      });

      // 3. ASSIGNMENT_SIGNED history (with signature)
      if (signatureDataUrl) {
        await tx.assetHistory.create({
          data: {
            assetId: newAsset.id,
            userId: user.id,
            action: 'ASSIGNMENT_SIGNED',
            details: {
              signedByEmail: assignedToEmail,
              signedByName: assignedToName,
              signedAt: signedAt || new Date().toISOString(),
              ticketId: ticketId || null,
              signatureDataUrl: signatureDataUrl,         // stored for viewing in history
              pdfDataUrl: pdfDataUrl || null,             // full signed form PNG
              assetName: name,
              assetType: type,
            },
          },
        });
      }

      // 4. ASSIGNED history (asset given to user)
      if (!isSpare && assignedToId) {
        await tx.assetHistory.create({
          data: {
            assetId: newAsset.id,
            userId: user.id,
            action: 'ASSIGNED',
            details: {
              assignedToEmail,
              assignedToName,
              assignedToId,
              via: 'workflow-signature',
              ticketId: ticketId || null,
            },
          },
        });
      }

      // 5. Link & close ticket
      if (ticketId) {
        const ticket = await tx.ticket.findUnique({
          where: { id: ticketId },
          select: { id: true, userId: true, displayId: true, title: true },
        });
        if (ticket) {
          await tx.ticket.update({
            where: { id: ticketId },
            data: { assetId: newAsset.id, status: 'CLOSED' },
          });
          await tx.ticketHistory.create({
            data: {
              ticketId,
              userId: user.id,
              comment: `Asset "${newAsset.name}" (${newAsset.assetId}) has been assigned to ${assignedToName || assignedToEmail}. Digital signature collected. Ticket closed automatically.`,
            },
          });
          await tx.notification.create({
            data: {
              userId: ticket.userId,
              ticketId,
              type: 'ASSET_ASSIGNED',
              title: 'Asset assigned & ticket closed',
              message: `"${newAsset.name}" has been assigned to ${assignedToName || assignedToEmail}. The ticket has been closed.`,
            },
          });
        }
      }

      return newAsset;
    });

    // 6. Send confirmation email (non-blocking, with PDF attachment)
    if (assignedToEmail) {
      setImmediate(async () => {
        try {
          const attachments: any[] = [];
          if (pdfDataUrl) {
            const base64Data = pdfDataUrl.replace(/^data:image\/png;base64,/, '');
            attachments.push({ filename: 'asset-assignment-signed-form.png', content: base64Data, contentType: 'image/png' });
          }
          await resend.emails.send({
            from: FROM,
            to: assignedToEmail,
            subject: `Asset Assignment Confirmed & Signed: ${name}`,
            attachments,
            html: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:system-ui,-apple-system,sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#059669,#0284c7);padding:32px;text-align:center;">
      <div style="font-size:42px;margin-bottom:12px;">✅</div>
      <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">Assignment Confirmed</h1>
      <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">Your digital signature has been recorded</p>
    </div>
    <div style="padding:32px;">
      <p style="color:#374151;margin:0 0 20px;">Hello <strong>${assignedToName || assignedToEmail}</strong>,</p>
      <p style="color:#374151;margin:0 0 20px;">Your digital signature has been successfully recorded. The following asset has been officially assigned to you. A signed copy of the assignment agreement is attached to this email.</p>
      <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:12px;padding:20px;margin-bottom:20px;">
        <h3 style="margin:0 0 12px;color:#14532d;font-size:14px;font-weight:700;">✅ Asset Assignment Details</h3>
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:6px 0;color:#6b7280;font-size:13px;width:140px;">Asset Name</td><td style="padding:6px 0;color:#111827;font-size:13px;font-weight:600;">${name}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;font-size:13px;">Asset ID</td><td style="padding:6px 0;color:#111827;font-size:13px;font-family:monospace;">${asset.assetId}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;font-size:13px;">Asset Type</td><td style="padding:6px 0;color:#111827;font-size:13px;">${type}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;font-size:13px;">Location</td><td style="padding:6px 0;color:#111827;font-size:13px;">Floor ${floorNumber || '—'}, Room ${roomNumber || '—'}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;font-size:13px;">Signed At</td><td style="padding:6px 0;color:#111827;font-size:13px;">${new Date(signedAt || Date.now()).toLocaleString()}</td></tr>
          ${ticketId ? `<tr><td style="padding:6px 0;color:#6b7280;font-size:13px;">Ticket Closed</td><td style="padding:6px 0;color:#7c3aed;font-size:13px;font-weight:600;">✓ Ticket has been closed</td></tr>` : ''}
        </table>
      </div>
      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:16px;margin-bottom:24px;">
        <p style="margin:0;color:#1e40af;font-size:13px;">📎 <strong>Signed Form Attached:</strong> The signed assignment agreement is attached as an image file for your records. Please keep this for reference.</p>
      </div>
      <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:12px;padding:16px;">
        <p style="margin:0;color:#92400e;font-size:13px;font-weight:600;">⚠️ Your Responsibilities:</p>
        <ul style="margin:8px 0 0;padding-left:20px;color:#92400e;font-size:13px;">
          <li>Keep the asset in good working condition</li>
          <li>Report any damage or loss immediately</li>
          <li>Return the asset when requested</li>
          <li>Use the asset only for authorized purposes</li>
        </ul>
      </div>
    </div>
    <div style="background:#f8fafc;border-top:1px solid #e5e7eb;padding:20px;text-align:center;">
      <p style="margin:0;color:#9ca3af;font-size:12px;">AssetXAI Asset Management Platform</p>
      <p style="margin:4px 0 0;color:#9ca3af;font-size:11px;">This is an automated confirmation. Please contact your asset manager for any issues.</p>
    </div>
  </div>
</body>
</html>`,
          });
        } catch (err) {
          console.error('Confirmation email error:', err);
        }
      });
    }

    // Audit log
    try {
      await logDataModification('ASSET', asset.id, 'CREATE', { assetId: asset.assetId, name, type, workflow: true }, {
        action: 'Asset Registration (Signed Workflow)',
        assetName: name, assetType: type, userId: user.id, userEmail: user.email,
      });
      await logUserActivity('ASSET_CREATED', 'ASSET', {
        assetId: asset.assetId, assetName: name, assetType: type,
        signatureCollected: !!signatureDataUrl, timestamp: new Date().toISOString(),
        userId: user.id, userEmail: user.email,
      }, asset.id);
    } catch { /* non-critical */ }

    // D365 sync
    import('@/lib/dynamics365/syncAsset').then(({ pushAssetToD365 }) => pushAssetToD365(asset).catch(() => {})).catch(() => {});

    return res.status(201).json(asset);
  } catch (err: any) {
    console.error('create-with-workflow error:', err);
    return res.status(500).json({ message: 'Failed to create asset', error: err?.message });
  }
}
