import type { PrismaClient } from '@prisma/client';

/**
 * Tickets tied to an inventory reconciliation audit log store the audit row id in description.
 * Supported patterns (newest first):
 * - [Inventory audit report: <cuid>]
 * - Report ID: <cuid> (audit center modal)
 * - _Audit log ref: <cuid>_ (legacy markdown)
 */
export function extractInventoryAuditLogIdFromTicketDescription(description: string | null | undefined): string | null {
  if (!description || typeof description !== 'string') return null;
  const bracket = description.match(/\[Inventory audit report:\s*([a-z0-9]+)\]/i);
  if (bracket?.[1]) return bracket[1];
  const reportLine = description.match(/Report ID:\s*([a-z0-9]+)/i);
  if (reportLine?.[1]) return reportLine[1];
  const ref = description.match(/_Audit log ref:\s*([a-z0-9]+)_/i);
  if (ref?.[1]) return ref[1];
  return null;
}

/** Notify the field staff who submitted the inventory audit when someone else updates a linked ticket. */
export async function notifyInventoryAuditReportSubmitter(params: {
  prisma: PrismaClient;
  ticketId: string;
  ticketDescription: string;
  updaterUserId: string;
  ticketCreatorUserId: string;
  summaryLine: string;
}): Promise<void> {
  const auditLogId = extractInventoryAuditLogIdFromTicketDescription(params.ticketDescription);
  if (!auditLogId) return;
  const log = await params.prisma.auditLog.findFirst({
    where: { id: auditLogId, action: 'INVENTORY_REVIEW_SUBMITTED' },
    select: { userId: true },
  });
  const submitterId = log?.userId;
  if (!submitterId || submitterId === params.updaterUserId) return;
  if (submitterId === params.ticketCreatorUserId) return;
  try {
    await params.prisma.notification.create({
      data: {
        userId: submitterId,
        ticketId: params.ticketId,
        type: 'INVENTORY_AUDIT_TICKET_UPDATE',
        title: 'Update on ticket from your inventory report',
        message: params.summaryLine.slice(0, 500),
      },
    });
  } catch {
    /* non-blocking */
  }
}
