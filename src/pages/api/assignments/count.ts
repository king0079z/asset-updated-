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

  // Ensure req.cookies exists to prevent TypeError
  if (!req.cookies) {
    req.cookies = {};
  }

  try {
    console.info(`Path: ${req.url || '/api/assignments/count'} Starting request processing`);
    
    // Get the authenticated user
    let supabase;
    try {
      supabase = createClient(req, res);
    } catch (err) {
      console.error("Failed to create Supabase client:", err);
      return res.status(200).json({ 
        total: 0, 
        tickets: 0, 
        tasks: 0,
        error: "Authentication service unavailable"
      });
    }
    
    if (!supabase) {
      console.error("Failed to create Supabase client - returned null");
      return res.status(200).json({ 
        total: 0, 
        tickets: 0, 
        tasks: 0,
        error: "Authentication service unavailable"
      });
    }
    
    let authResponse;
    try {
      authResponse = await supabase.auth.getUser();
    } catch (err) {
      console.error("Error in supabase.auth.getUser():", err);
      return res.status(200).json({ 
        total: 0, 
        tickets: 0, 
        tasks: 0,
        error: "Failed to authenticate user"
      });
    }
    
    const { data: { user }, error } = authResponse || { data: { user: null }, error: null };

    if (error) {
      console.error("Error fetching user:", error);
      // Return a default response for unauthenticated users instead of 401
      return res.status(200).json({
        total: 0,
        tickets: 0,
        tasks: 0
      });
    }

    if (!user) {
      console.info("No authenticated user found, returning zero counts");
      return res.status(200).json({
        total: 0,
        tickets: 0,
        tasks: 0
      });
    }

    // Log the request
    console.info(`Path: ${req.url || '/api/assignments/count'} Fetching assignment counts for user: ${user.id}`);

    // Count tickets assigned to the user
    const ticketsCount = await prisma.ticket.count({
      where: {
        assignedToId: user.id,
        status: {
          in: ["OPEN", "IN_PROGRESS"] // Only count active tickets
        }
      }
    }).catch(err => {
      console.error("Error counting tickets:", err);
      return 0;
    });

    // Count tasks assigned to the user
    const tasksCount = await prisma.plannerTask.count({
      where: {
        assignedToUserId: user.id,
        status: {
          in: ["PLANNED", "IN_PROGRESS"] // Only count active tasks
        }
      }
    }).catch(err => {
      console.error("Error counting tasks:", err);
      return 0;
    });

    // Calculate total count
    const totalCount = ticketsCount + tasksCount;

    console.info(`Path: ${req.url || '/api/assignments/count'} Found ${totalCount} pending assignments (${ticketsCount} tickets, ${tasksCount} tasks) for user: ${user.id}`);
    
    return res.status(200).json({
      total: totalCount,
      tickets: ticketsCount,
      tasks: tasksCount
    });
  } catch (error) {
    console.error("Error fetching assignment counts:", error instanceof Error ? error.stack : error);
    // Return a default response instead of an error to prevent client-side failures
    return res.status(200).json({ 
      total: 0,
      tickets: 0,
      tasks: 0,
      error: "Failed to fetch assignment counts",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
}