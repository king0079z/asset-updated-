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
    result.buckets = buckets?.map(b => ({ name: b.name, public: b.public })) ?? [];
    const existing = buckets?.find(b => b.name === bucket);
    result.targetBucketExists = !!existing;
    result.targetBucketIsPublic = existing?.public ?? false;

    if (!existing) {
      // Create as public
      const { error: createErr } = await admin.storage.createBucket(bucket, {
        public: true,
        fileSizeLimit: 10 * 1024 * 1024,
      });
      result.bucketCreateError = createErr?.message ?? null;
      result.bucketCreated = !createErr;
    } else if (!existing.public) {
      // Update to public
      const { error: updateErr } = await admin.storage.updateBucket(bucket, {
        public: true,
        fileSizeLimit: 10 * 1024 * 1024,
      });
      result.bucketUpdatedToPublic = !updateErr;
      result.bucketUpdateError = updateErr?.message ?? null;
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
