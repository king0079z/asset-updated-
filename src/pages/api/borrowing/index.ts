// @ts-nocheck
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '@/util/supabase/require-auth';
import prisma from '@/lib/prisma';
import { getUserRoleData } from '@/util/roleCheck';
import { sendEmail } from '@/lib/email/sendEmail';

export const config = {
  api: { bodyParser: { sizeLimit: '10mb' } },
};

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || '';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireAuth(req, res);
  if (!auth) return;
  const { user } = auth;
  const roleData = await getUserRoleData(user.id);
  const orgId = roleData?.organizationId || null;

  if (req.method === 'GET') {
    const { status, assetId, userId: qUserId } = req.query;
    const borrows = await prisma.assetBorrow.findMany({
      where: {
        ...(orgId ? { organizationId: orgId } : {}),
        ...(status ? { status: status as any } : {}),
        ...(assetId ? { assetId: assetId as string } : {}),
        ...(qUserId ? { borrowedById: qUserId as string } : {}),
      },
      include: {
        asset: { select: { id: true, name: true, assetId: true, status: true } },
        borrowedBy: { select: { id: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return res.status(200).json(borrows);
  }

  if (req.method === 'POST') {
    const { assetId, borrowedById, expectedReturnAt, borrowLocation, custodianName, notes,
            signatureDataUrl, pdfDataUrl, signedAt } = req.body;
    if (!assetId || !borrowedById || !expectedReturnAt) {
      return res.status(400).json({ error: 'assetId, borrowedById, and expectedReturnAt are required' });
    }

    // Check asset is available
    const asset = await prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset) return res.status(404).json({ error: 'Asset not found' });
    if (asset.status === 'BORROWED') return res.status(409).json({ error: 'Asset is already borrowed' });

    const borrow = await prisma.assetBorrow.create({
      data: {
        assetId,
        borrowedById,
        expectedReturnAt: new Date(expectedReturnAt),
        borrowLocation,
        custodianName,
        notes,
        organizationId: orgId,
        approvedById: user.id,
      },
    });

    // Update asset status
    await prisma.asset.update({ where: { id: assetId }, data: { status: 'BORROWED' } });

    // Log BORROW_SIGNED history (with signature) if signature provided
    if (signatureDataUrl) {
      let docId: string | null = null;
      // Store full PDF as AssetDocument
      if (pdfDataUrl) {
        const doc = await prisma.assetDocument.create({
          data: {
            assetId,
            fileName: `Borrow-Agreement-${asset.assetId || assetId}-${Date.now()}.png`,
            fileUrl: pdfDataUrl,
            fileType: 'image/png',
            fileSize: Math.round((pdfDataUrl.length * 3) / 4),
            uploadedById: user.id,
          },
        }).catch(() => null);
        docId = doc?.id || null;
      }
      await prisma.assetHistory.create({
        data: {
          assetId,
          action: 'BORROW_SIGNED',
          details: {
            borrowId: borrow.id,
            borrowedById,
            custodianName: custodianName || null,
            expectedReturnAt,
            signatureDataUrl,   // small — canvas only
            documentId: docId,  // reference to AssetDocument
            signedAt: signedAt || new Date().toISOString(),
            signedBy: user.email,
          },
          userId: user.id,
        },
      }).catch(() => {});
    }

    // Log ASSIGNED history
    await prisma.assetHistory.create({
      data: {
        assetId,
        action: 'ASSIGNED',
        details: { borrowId: borrow.id, borrowedById, expectedReturnAt, isBorrow: true },
        userId: user.id,
      },
    });

    // Email borrower
    const borrower = await prisma.user.findUnique({ where: { id: borrowedById }, select: { email: true } });
    if (borrower?.email) {
      if (signatureDataUrl) {
        // Send confirmation with signed PDF attachment
        const { Resend } = await import('resend');
        const resend = new Resend(process.env.RESEND_API_KEY);
        const FROM = process.env.EMAIL_FROM || 'AssetXAI <noreply@assetxai.live>';
        const attachments: any[] = [];
        if (pdfDataUrl?.startsWith('data:image/png;base64,')) {
          attachments.push({ filename: `Borrow-Agreement-${asset.assetId || assetId}.png`, content: pdfDataUrl.replace('data:image/png;base64,', '') });
        }
        resend.emails.send({
          from: FROM, to: [borrower.email],
          subject: `✓ Asset Borrowing Confirmed: ${asset.name}`,
          html: `<div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto"><div style="background:linear-gradient(135deg,#2563eb,#7c3aed);padding:28px 32px;color:white;border-radius:12px 12px 0 0"><h2 style="margin:0 0 4px">Asset Borrowing Confirmed</h2><p style="margin:0;opacity:.8;font-size:14px">Your signed borrowing agreement is attached</p></div><div style="background:#fff;border:1px solid #e2e8f0;border-radius:0 0 12px 12px;padding:28px 32px"><p>Dear borrower,</p><p>You have successfully borrowed <strong>${asset.name}</strong> (${asset.assetId || assetId}).</p><p><strong>Due date:</strong> ${new Date(expectedReturnAt).toLocaleDateString()}</p><p>Your signed borrowing agreement is attached to this email. Please return the asset by the due date.</p></div></div>`,
          attachments,
        }).catch((e) => console.error('[borrowing] email error:', e));
      } else {
        await sendEmail({
          to: borrower.email, template: 'overdue-asset',
          data: { assetName: asset.name, assetId: asset.assetId || asset.id, dueDate: new Date(expectedReturnAt).toLocaleDateString(), type: 'Asset Borrowing', url: `${SITE_URL}/assets/${assetId}` },
        });
      }
    }

    return res.status(201).json(borrow);
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}
