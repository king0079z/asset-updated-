import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { createClient } from "@/util/supabase/api";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow GET requests
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Ensure req.cookies exists to prevent TypeError
    if (!req.cookies) {
      req.cookies = {};
    }
    
    // Get the authenticated user
    const supabase = createClient(req, res);
    const { data: { session }, error } = await supabase.auth.getSession();
    const user = session?.user ?? null;

    if (error || !user) {
      console.error("Error fetching user:", error);
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Resolve DB user to scope by organization (same-org tickets only)
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { organizationId: true },
    });
    const orgId = dbUser?.organizationId ?? undefined;

    const whereClause: any = {
      assignedToId: user.id,
      status: { in: ["OPEN", "IN_PROGRESS"] },
    };
    if (orgId) {
      whereClause.OR = [
        { organizationId: orgId },
        { organizationId: null },
      ];
      delete whereClause.organizationId;
    }

    const tickets = await prisma.ticket.findMany({
      where: whereClause,
      orderBy: [
        {
          priority: "desc" // High priority first
        },
        {
          createdAt: "desc" // Newest first
        }
      ],
      select: {
        id: true,
        displayId: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        userId: true,
        assignedToId: true,
        createdAt: true,
        updatedAt: true
      }
    });
    
    // Log the tickets found with their statuses
    console.info(`Path: ${req.url} Found ${tickets.length} assigned tickets with statuses: ${tickets.map(t => t.status).join(', ')}`);

    // Map enum values to lowercase strings for frontend compatibility
    const formattedTickets = tickets.map(ticket => ({
      ...ticket,
      status: ticket.status.toLowerCase(),
      priority: ticket.priority.toLowerCase()
    }));

    console.info(`Path: ${req.url} Found ${tickets.length} assigned tickets for user: ${user.email}`);
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');

    return res.status(200).json(formattedTickets);
  } catch (error) {
    console.error("Error fetching assigned tickets:", error);
    return res.status(500).json({ error: "Failed to fetch assigned tickets" });
  }
}