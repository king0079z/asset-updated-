import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import prisma from '@/lib/prisma';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow POST method
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify admin authentication
    const supabase = createClient(req, res);
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    const user = session?.user ?? null;

    if (authError || !user) {
      console.error('Authentication error:', authError);
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { role: true, isAdmin: true },
    });
    const isAuthorizedAdmin =
      !!dbUser && (dbUser.role === 'ADMIN' || dbUser.isAdmin === true);

    if (!isAuthorizedAdmin) {
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }

    console.log('Enabling Row Level Security on Ticket table');

    // Define the migration SQL
    const migrationSql = `
    -- Enable Row Level Security on the Ticket table
    ALTER TABLE "public"."Ticket" ENABLE ROW LEVEL SECURITY;
    
    -- Create policy to allow users to select only their own tickets
    CREATE POLICY "Users can view their own tickets" 
    ON "public"."Ticket"
    FOR SELECT
    USING (auth.uid()::text = "userId");
    
    -- Create policy to allow users to insert their own tickets
    CREATE POLICY "Users can create their own tickets" 
    ON "public"."Ticket"
    FOR INSERT
    WITH CHECK (auth.uid()::text = "userId");
    
    -- Create policy to allow users to update their own tickets
    CREATE POLICY "Users can update their own tickets" 
    ON "public"."Ticket"
    FOR UPDATE
    USING (auth.uid()::text = "userId");
    
    -- Create policy to allow users to delete their own tickets
    CREATE POLICY "Users can delete their own tickets" 
    ON "public"."Ticket"
    FOR DELETE
    USING (auth.uid()::text = "userId");
    
    -- Comment explaining the security enhancement
    COMMENT ON TABLE "public"."Ticket" IS 'Tickets with Row Level Security enabled. Users can only access their own tickets.';
    `;

    // Execute the SQL directly using Prisma's $executeRawUnsafe
    // This is necessary because Prisma doesn't have direct methods to manage RLS
    await prisma.$executeRawUnsafe(migrationSql);

    console.log('Successfully enabled RLS on Ticket table');
    return res.status(200).json({ 
      success: true, 
      message: 'Row Level Security has been enabled on the Ticket table' 
    });
  } catch (error) {
    console.error('Error enabling RLS:', error);
    
    // Check for specific error types to provide better error messages
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // If the policy already exists, provide a more helpful message
    if (errorMessage.includes('already exists')) {
      return res.status(409).json({
        error: 'Row Level Security policies already exist',
        details: 'The security policies have already been applied to this table.'
      });
    }
    
    return res.status(500).json({ error: 'Failed to enable Row Level Security' });
  }
}