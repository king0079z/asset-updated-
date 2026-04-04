// @ts-nocheck
/**
 * POST /api/dlm/[ticketId]/decide
 * DLM approves or rejects a ticket.
 * Body: { action: "approve" | "reject", comment?: string }
 *
 * On approve  → dlmApprovalStatus = "DLM_APPROVED", adds timeline entry, notifies requester.
 * On reject   → dlmApprovalStatus = "DLM_REJECTED", adds timeline entry, notifies requester.
 */
import { NextApiRequest, NextApiResponse } from "next";
import { requireAuth } from "@/util/supabase/require-auth";
import prisma from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const auth = await requireAuth(req, res);
  if (!auth) return;
  const { user } = auth;

  const ticketId = req.query.ticketId as string;
  const { action, comment } = req.body as { action: "approve" | "reject"; comment?: string };

  if (!ticketId) return res.status(400).json({ error: "ticketId required" });
  if (!["approve", "reject"].includes(action)) return res.status(400).json({ error: "action must be 'approve' or 'reject'" });

  try {
    // Fetch the ticket with requester info
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        user: { select: { id: true, email: true, displayName: true } },
        dlm: { select: { id: true, email: true, displayName: true } },
      },
    });

    if (!ticket) return res.status(404).json({ error: "Ticket not found" });
    if (ticket.dlmId !== user.id) return res.status(403).json({ error: "You are not the DLM for this ticket" });
    if (ticket.dlmApprovalStatus !== "PENDING_DLM") {
      return res.status(409).json({ error: "Ticket is not pending DLM approval" });
    }

    const isApprove = action === "approve";
    const newStatus = isApprove ? "DLM_APPROVED" : "DLM_REJECTED";
    const dlmName = ticket.dlm?.displayName || ticket.dlm?.email || "Your manager";

    // Update ticket + add TicketHistory in one transaction
    await prisma.$transaction(async (tx) => {
      await tx.ticket.update({
        where: { id: ticketId },
        data: {
          dlmApprovalStatus: newStatus,
          dlmComment: comment || null,
          dlmDecidedAt: new Date(),
        },
      });

      // Timeline entry visible to the requester on the ticket detail page
      const historyComment = isApprove
        ? `✅ Approved by DLM — ${dlmName} has approved your request. Your ticket is now open for the IT support team to process.${comment ? ` Manager's note: "${comment}"` : ''}`
        : `❌ Rejected by DLM — ${dlmName} has rejected your request.${comment ? ` Reason: "${comment}"` : ''} Please contact your manager for more information.`;

      await tx.ticketHistory.create({
        data: {
          ticketId,
          status: "OPEN",
          priority: ticket.priority,
          userId: user.id,
          comment: historyComment,
        },
      });

      // In-app notification to the requester
      if (ticket.userId) {
        await tx.notification.create({
          data: {
            userId: ticket.userId,
            ticketId,
            type: isApprove ? "TICKET_APPROVED_BY_DLM" : "TICKET_REJECTED_BY_DLM",
            title: isApprove ? "Your ticket was approved by your manager" : "Your ticket was rejected by your manager",
            message: isApprove
              ? `Your ticket "${ticket.title}" has been approved by ${dlmName} and is now with the IT support team.`
              : `Your ticket "${ticket.title}" was rejected by ${dlmName}. ${comment ? `Reason: ${comment}` : "Please contact your manager for more information."}`,
          },
        });
      }
    });

    // Send email to requester (non-blocking)
    try {
      const { sendEmail } = await import("@/lib/email/sendEmail");
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://assetxai.live";
      if (ticket.user?.email) {
        await sendEmail({
          to: ticket.user.email,
          template: "ticket-update",
          data: {
            ticketId: ticket.displayId || ticketId,
            ticketTitle: ticket.title,
            status: isApprove ? "DLM Approved — Now with IT Team" : "Rejected by Manager",
            comment: isApprove
              ? `Your request has been approved by ${dlmName} and routed to the IT support team for action.${comment ? ` Manager's note: "${comment}"` : ""}`
              : `Your request was rejected by ${dlmName}.${comment ? ` Reason: "${comment}"` : ""}`,
            portalUrl: `${baseUrl}/portal`,
          },
        });
      }
    } catch (emailErr) {
      console.error("[DLM decide] email failed (non-critical)", emailErr);
    }

    return res.status(200).json({
      success: true,
      newStatus,
      message: isApprove ? "Ticket approved and routed to IT team" : "Ticket rejected",
    });
  } catch (err) {
    console.error("[DLM decide]", err);
    return res.status(500).json({ error: "Failed to process decision", detail: String(err) });
  }
}
