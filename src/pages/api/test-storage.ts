import { NextApiRequest, NextApiResponse } from "next";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/util/supabase/api";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow in non-production or with a secret header
  if (req.method !== "GET") return res.status(405).end();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = (process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || 'assets').trim();

  const result: Record<string, any> = {
    supabaseUrl: supabaseUrl ? `${supabaseUrl.slice(0, 30)}...` : 'MISSING',
    serviceRoleKeyPresent: !!serviceRoleKey,
    serviceRoleKeyLength: serviceRoleKey?.length ?? 0,
    bucket,
  };

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(200).json({ ...result, error: "Missing env vars" });
  }

  try {
    const admin = createAdminClient(supabaseUrl, serviceRoleKey);

    // List buckets
    const { data: buckets, error: listErr } = await admin.storage.listBuckets();
    result.listBucketsError = listErr?.message ?? null;
    result.buckets = buckets?.map(b => b.name) ?? [];
    result.targetBucketExists = buckets?.some(b => b.name === bucket) ?? false;

    // If bucket doesn't exist, try to create it
    if (!result.targetBucketExists) {
      const { error: createErr } = await admin.storage.createBucket(bucket, {
        public: true,
        fileSizeLimit: 10 * 1024 * 1024,
      });
      result.bucketCreateError = createErr?.message ?? null;
      result.bucketCreated = !createErr;
    }

    // Try uploading a tiny test file
    const testFile = Buffer.from("ping");
    const { data: uploadData, error: uploadErr } = await admin.storage
      .from(bucket)
      .upload(`__test__/ping.txt`, testFile, { upsert: true, contentType: "text/plain" });
    result.testUploadError = uploadErr?.message ?? null;
    result.testUploadPath = uploadData?.path ?? null;

    if (!uploadErr && uploadData) {
      // Clean up test file
      await admin.storage.from(bucket).remove([`__test__/ping.txt`]);
      result.testUploadSuccess = true;
    }

  } catch (err) {
    result.exception = err instanceof Error ? err.message : String(err);
  }

  return res.status(200).json(result);
}
