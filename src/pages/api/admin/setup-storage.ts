import { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { createClient as createAuthClient } from "@/util/supabase/api";
import prisma from "@/lib/prisma";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  // Verify that the user is authenticated and authorized
  const supabase = createAuthClient(req, res);
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { role: true, isAdmin: true },
    });
    const isAuthorizedAdmin =
      !!dbUser && (dbUser.role === "ADMIN" || dbUser.isAdmin === true);

    if (!isAuthorizedAdmin) {
      return res.status(403).json({ message: "Forbidden: Admin access required" });
    }

    // Create policies for the assets bucket
    const bucket = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || 'assets';

    // First, ensure the bucket exists
    const { data: bucketData, error: bucketError } = await supabaseAdmin
      .storage
      .createBucket(bucket, {
        public: false,
        fileSizeLimit: 5242880, // 5MB in bytes
        allowedMimeTypes: ['image/jpeg', 'image/png']
      });

    if (bucketError && !bucketError.message.includes('already exists')) {
      throw bucketError;
    }

    // Update bucket settings even if it already exists
    await supabaseAdmin
      .storage
      .updateBucket(bucket, {
        public: false,
        fileSizeLimit: 5242880,
        allowedMimeTypes: ['image/jpeg', 'image/png']
      });

    // First, remove any existing policies for this bucket to avoid conflicts
    await supabaseAdmin.rpc('exec_sql', {
      query: `
        DROP POLICY IF EXISTS "Allow authenticated users to view files" ON storage.objects;
        DROP POLICY IF EXISTS "Allow authenticated users to upload files" ON storage.objects;
        DROP POLICY IF EXISTS "Allow users to update their own files" ON storage.objects;
        DROP POLICY IF EXISTS "Allow users to delete their own files" ON storage.objects;
      `
    });

    // Define and create the new policies
    const policies = [
      {
        name: 'Allow authenticated users to view files',
        query: `
          CREATE POLICY "Allow authenticated users to view files"
          ON storage.objects FOR SELECT
          TO authenticated
          USING (bucket_id = '${bucket}');
        `
      },
      {
        name: 'Allow authenticated users to upload files',
        query: `
          CREATE POLICY "Allow authenticated users to upload files"
          ON storage.objects FOR INSERT
          TO authenticated
          WITH CHECK (bucket_id = '${bucket}');
        `
      },
      {
        name: 'Allow users to update their own files',
        query: `
          CREATE POLICY "Allow users to update their own files"
          ON storage.objects FOR UPDATE
          TO authenticated
          USING (bucket_id = '${bucket}' AND owner = auth.uid());
        `
      },
      {
        name: 'Allow users to delete their own files',
        query: `
          CREATE POLICY "Allow users to delete their own files"
          ON storage.objects FOR DELETE
          TO authenticated
          USING (bucket_id = '${bucket}' AND owner = auth.uid());
        `
      }
    ];

    // Create each policy
    for (const policy of policies) {
      const { error: policyError } = await supabaseAdmin.rpc('exec_sql', {
        query: policy.query
      });

      if (policyError) {
        console.error(`Error creating policy "${policy.name}":`, policyError);
        throw new Error(`Failed to create policy "${policy.name}": ${policyError.message}`);
      }
    }

    // Enable RLS on the objects table
    await supabaseAdmin.rpc('exec_sql', {
      query: `ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;`
    });

    return res.status(200).json({ 
      message: "Storage policies configured successfully",
      bucket: bucket
    });
  } catch (error) {
    console.error("Error setting up storage policies:", error);
    return res.status(500).json({ 
      message: "Failed to set up storage policies"
    });
  }
}