// @ts-nocheck
/**
 * POST /api/tickets/email-ingest
 * Webhook endpoint for email-to-ticket creation.
 * Supports: Outlook (via Office 365 forwarding), Gmail (via Google Workspace routing),
 * or any SMTP webhook provider (Mailgun, SendGrid Inbound, etc.)
 *
 * Expected body: { from, subject, text, html, attachments? }
 * Protected by EMAIL_WEBHOOK_SECRET header.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { sendEmail } from '@/lib/email/sendEmail';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || '';

function classifyPriority(subject: string, body: string): string {
  const text = (subject + ' ' + body).toLowerCase();
  if (text.includes('urgent') || text.includes('critical') || text.includes('emergency')) return 'CRITICAL';
  if (text.includes('high') || text.includes('asap') || text.includes('immediately')) return 'HIGH';
  if (text.includes('low') || text.includes('when possible') || text.includes('not urgent')) return 'LOW';
  return 'MEDIUM';
}

function classifyCategory(subject: string, body: string): string {
  const text = (subject + ' ' + body).toLowerCase();
  if (text.includes('maintenance') || text.includes('repair') || text.includes('broken')) return 'MAINTENANCE';
  if (text.includes('access') || text.includes('permission') || text.includes('login')) return 'ACCESS';
  if (text.includes('damage') || text.includes('damaged') || text.includes('broken')) return 'DAMAGE';
  if (text.includes('lost') || text.includes('missing') || text.includes('cannot find')) return 'LOSS';
  if (text.includes('laptop') || text.includes('computer') || text.includes('device') || text.includes('printer')) return 'DEVICES';
  return 'SERVICE_DESK';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Validate webhook secret
  const secret = process.env.EMAIL_WEBHOOK_SECRET;
  if (secret) {
    const incoming = req.headers['x-webhook-secret'] || req.headers['x-email-secret'];
    if (incoming !== secret) return res.status(401).json({ error: 'Unauthorized' });
  }

  const { from, subject, text, html, attachments } = req.body;
  if (!from || !subject) return res.status(400).json({ error: 'from and subject are required' });

  // Extract email address
  const emailMatch = from.match(/<([^>]+)>/) || [null, from];
  const fromEmail = emailMatch[1]?.trim() || from.trim();

  // Find user by email
  const user = await prisma.user.findFirst({ where: { email: { equals: fromEmail, mode: 'insensitive' } } });

  const body = text || html?.replace(/<[^>]+>/g, ' ') || '';
  const priority = classifyPriority(subject, body);
  const category = classifyCategory(subject, body);
  const organizationId = user ? (await prisma.user.findUnique({ where: { id: user.id }, select: { organizationId: true } }))?.organizationId : null;

  // Generate displayId
  const count = await prisma.ticket.count();
  const displayId = `TKT-${(count + 1).toString().padStart(5, '0')}`;

  const ticket = await prisma.ticket.create({
    data: {
      displayId,
      title: subject.slice(0, 200),
      description: `${body.slice(0, 2000)}\n\n[Created from email: ${fromEmail}]`,
      status: 'OPEN',
      priority: priority as any,
      category,
      source: 'EMAIL',
      requesterName: from,
      userId: user?.id || (await prisma.user.findFirst({ where: { isAdmin: true } }))?.id || 'system',
      organizationId,
    },
  });

  await prisma.ticketHistory.create({
    data: {
      ticketId: ticket.id,
      status: 'OPEN' as any,
      comment: `Ticket created from email: ${fromEmail}`,
      userId: user?.id || ticket.userId,
    },
  });

  // Confirm to sender
  await sendEmail({
    to: fromEmail,
    template: 'ticket-update',
    data: {
      ticketId: ticket.displayId || ticket.id,
      title: ticket.title,
      status: 'OPEN',
      priority,
      updatedBy: 'AssetXAI System',
      comment: 'Your email has been received and a support ticket has been created. Our team will respond shortly.',
      ticketUrl: `${SITE_URL}/tickets/${ticket.id}`,
    },
  });

  return res.status(200).json({ ok: true, ticketId: ticket.id, displayId: ticket.displayId });
}
