// @ts-nocheck
/**
 * POST /api/dlm/[ticketId]/decide
 * Body: { action: "approve" | "reject", comment?: string }
 *
 * The authenticated user must be the DLM for this ticket.
 * - approve: dlmApprovalStatus → "DLM_APPROVED", ticket status stays OPEN (appears in main ticket page)
 * - reject:  dlmApprovalStatus → "DLM_REJECTED", ticket remains hidden from main ticket page
 */
import { NextApiRequest, NextApiResponse } from "next";
import { requireAuth } from "@/util/supabase/require-auth";
import prisma from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const auth = await requireAuth(req, res);
  if (!auth) return;
  const { user } = auth;

  const { ticketId } = req.query;
  if (!ticketId || typeof ticketId !== "string") return res.status(400).json({ error: "Invalid ticket ID" });

  const { action, comment } = req.body ?? {};
  if (!["approve", "reject"].includes(action)) return res.status(400).json({ error: "action must be 'approve' or 'reject'" });

  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, dlmId: true, dlmApprovalStatus: true, title: true, userId: true },
    });

    if (!ticket) return res.status(404).json({ error: "Ticket not found" });
    if (ticket.dlmId !== user.id) return res.status(403).json({ error: "You are not the DLM for this ticket" });
    if (ticket.dlmApprovalStatus !== "PENDING_DLM") return res.status(400).json({ error: "Ticket is not awaiting DLM approval" });

    const newStatus = action === "approve" ? "DLM_APPROVED" : "DLM_REJECTED";

    const updated = await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        dlmApprovalStatus: newStatus,
        dlmComment: comment?.trim() || null,
        dlmDecidedAt: new Date(),
        // Add a history entry
        history: {
          create: {
            userId: user.id,
            comment: action === "approve"
              ? `✅ Approved by DLM${comment ? `: ${comment}` : ""}. Ticket is now live for IT support.`
              : `❌ Rejected by DLM${comment ? `: ${comment}` : ""}. Ticket will not be processed.`,
            status: null,
            priority: null,
          },
        },
      },
      include: {
        user: { select: { id: true, email: true, displayName: true } },
        asset: { select: { id: true, name: true, assetId: true } },
      },
    });

    // Notify the ticket submitter
    try {
      await prisma.notification.create({
        data: {
          userId: ticket.userId,
          ticketId: ticket.id,
          type: action === "approve" ? "DLM_APPROVED" : "DLM_REJECTED",
          title: action === "approve" ? "Your ticket has been approved" : "Your ticket has been rejected",
          message: action === "approve"
            ? `Your ticket "${ticket.title}" has been approved by your manager and is now with the IT support team.`
            : `Your ticket "${ticket.title}" has been rejected by your manager.${comment ? ` Reason: ${comment}` : ""}`,
        },
      });
    } catch (_) {}

    return res.status(200).json({ ticket: updated, action: newStatus });
  } catch (error) {
    console.error("[DLM decide]", error);
    return res.status(500).json({ error: "Failed to process approval decision" });
  }
}
