// @ts-nocheck
/**
 * POST /api/dlm/remind
 * Sends reminder emails to DLMs who have pending ticket approvals.
 * Can be called from a cron job (Vercel cron, GitHub Actions, etc.)
 * or manually by an admin pressing "Send Reminders" on the approval management page.
 *
 * Body: { ticketId?: string }  — if ticketId is supplied, only remind that DLM.
 *                                 Otherwise remind all DLMs with stale pending tickets.
 * A ticket is "stale" if it has been PENDING_DLM for more than the threshold (default 24h).
 */
import { NextApiRequest, NextApiResponse } from "next";
import { requireAuth } from "@/util/supabase/require-auth";
import { getUserRoleData } from "@/util/roleCheck";
import prisma from "@/lib/prisma";
import { sendEmail } from "@/lib/email/sendEmail";

const STALE_HOURS = 24; // send reminder after 24 hours of no action

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const auth = await requireAuth(req, res);
  if (!auth) return;
  const { user } = auth;

  const roleData = await getUserRoleData(user.id);
  const isAdminOrManager =
    roleData?.isAdmin === true ||
    roleData?.role === "ADMIN" ||
    roleData?.role === "MANAGER";

  if (!isAdminOrManager) {
    return res.status(403).json({ error: "Admin or Manager access required" });
  }

  const { ticketId } = req.body as { ticketId?: string };

  try {
    const staleThreshold = new Date(Date.now() - STALE_HOURS * 60 * 60 * 1000);

    const pendingTickets = await prisma.ticket.findMany({
      where: {
        dlmApprovalStatus: "PENDING_DLM",
        ...(ticketId ? { id: ticketId } : { createdAt: { lt: staleThreshold } }),
        dlmId: { not: null },
      },
      select: {
        id: true,
        displayId: true,
        title: true,
        description: true,
        category: true,
        priority: true,
        createdAt: true,
        user: { select: { id: true, email: true, displayName: true, department: true, jobTitle: true } },
        dlm: { select: { id: true, email: true, displayName: true } },
      },
    });

    if (pendingTickets.length === 0) {
      return res.status(200).json({ message: "No pending tickets to remind", count: 0 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://assetxai.live";
    let sent = 0;
    const errors: string[] = [];

    for (const ticket of pendingTickets) {
      if (!ticket.dlm?.email) continue;
      try {
        await sendEmail({
          to: ticket.dlm.email,
          template: "dlm-approval-request",
          data: {
            dlmName: ticket.dlm.displayName || ticket.dlm.email,
            requesterName: ticket.user?.displayName || ticket.user?.email,
            requesterEmail: ticket.user?.email,
            requesterDepartment: ticket.user?.department,
            requesterJobTitle: ticket.user?.jobTitle,
            ticketTitle: ticket.title,
            ticketDescription: ticket.description,
            ticketCategory: ticket.category,
            ticketPriority: ticket.priority,
            ticketDisplayId: ticket.displayId,
            portalUrl: `${baseUrl}/portal?tab=approvals`,
            isReminder: true,
          },
        });
        sent++;
      } catch (err) {
        errors.push(`Ticket ${ticket.displayId}: ${String(err)}`);
      }
    }

    return res.status(200).json({
      message: `Sent ${sent} reminder(s)`,
      count: sent,
      errors: errors.length ? errors : undefined,
    });
  } catch (err) {
    console.error("[DLM remind]", err);
    return res.status(500).json({ error: "Failed to send reminders", detail: String(err) });
  }
}
