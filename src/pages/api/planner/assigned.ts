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

    // Log the request
    console.info(`Path: ${req.url} Fetching assigned tasks for user: ${user.id}`);

    // Fetch tasks assigned to the user
    const tasks = await prisma.plannerTask.findMany({
      where: {
        assignedToUserId: user.id,
        status: {
          in: ["PLANNED", "IN_PROGRESS"] // Only fetch active tasks - using enum values
        }
      },
      orderBy: [
        {
          priority: "desc" // High priority first
        },
        {
          startDate: "asc" // Earlier due dates first
        }
      ],
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        startDate: true,
        endDate: true,
        assignedToUserId: true,
        createdAt: true,
        updatedAt: true
      }
    });

    // Map enum values to lowercase strings for frontend compatibility
    // and rename startDate to dueDate for frontend compatibility
    const formattedTasks = tasks.map(task => ({
      ...task,
      status: task.status.toLowerCase() === "planned" ? "pending" : task.status.toLowerCase(),
      priority: task.priority.toLowerCase(),
      dueDate: task.endDate || task.startDate
    }));

    console.info(`Path: ${req.url} Found ${tasks.length} assigned tasks for user: ${user.id}`);
    
    return res.status(200).json(formattedTasks);
  } catch (error) {
    console.error("Error fetching assigned tasks:", error);
    return res.status(500).json({ error: "Failed to fetch assigned tasks" });
  }
}