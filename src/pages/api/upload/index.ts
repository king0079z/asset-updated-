import { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@/util/supabase/api";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import formidable from "formidable";
import fs from "fs";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    // Authenticate the calling user
    const supabase = createClient(req, res);
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    const user = session?.user ?? null;

    if (authError || !user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Parse the multipart form
    const form = formidable({});
    const [, files] = await form.parse(req);

    if (!files.image?.[0]) {
      return res.status(400).json({ message: "No image file provided (field name must be 'image')" });
    }

    const file = files.image[0];

    // ── Validate file type ────────────────────────────────────────────────────
    const allowedMimes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
      'image/gif', 'image/heic', 'image/heif', 'image/avif',
      'image/bmp', 'image/tiff', 'image/svg+xml',
    ];
    const allowedExts = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif', 'avif', 'bmp', 'tiff', 'svg'];
    const mimeType = file.mimetype?.toLowerCase() || '';
    const ext = (file.originalFilename?.split('.').pop() || '').toLowerCase();

    if (!allowedMimes.includes(mimeType) && !allowedExts.includes(ext)) {
      return res.status(400).json({
        message: `Unsupported file type "${mimeType || ext}". Allowed: JPG, PNG, WEBP, GIF, HEIC, AVIF, BMP.`,
      });
    }

    // ── Validate size (10 MB) ─────────────────────────────────────────────────
    if (file.size > 10 * 1024 * 1024) {
      return res.status(400).json({ message: "File too large. Maximum is 10 MB." });
    }

    const fileData = await fs.promises.readFile(file.filepath);

    // ── Storage client ────────────────────────────────────────────────────────
    // Trim ALL env vars — Vercel can introduce trailing \r\n when pasting values,
    // which corrupts URLs (stored as %0D%0A in the path).
    const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
    const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim() || undefined;

    const storage = serviceRoleKey
      ? createAdminClient(supabaseUrl, serviceRoleKey).storage
      : supabase.storage;

    const bucket = (process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || 'assets').trim();

    // ── Ensure bucket exists AND is public (requires service role) ────────────
    if (serviceRoleKey) {
      const { data: buckets } = await storage.listBuckets();
      const existing = buckets?.find((b) => b.name === bucket);
      if (!existing) {
        // Create as public
        const { error: bucketErr } = await storage.createBucket(bucket, {
          public: true,
          fileSizeLimit: 10 * 1024 * 1024,
        });
        if (bucketErr && !bucketErr.message.toLowerCase().includes('already exist')) {
          console.error("Could not create storage bucket:", bucketErr.message);
          return res.status(500).json({
            message: "Storage bucket could not be created",
            error: bucketErr.message,
          });
        }
      } else if (!existing.public) {
        // Bucket exists but is private — update it to public
        await storage.updateBucket(bucket, {
          public: true,
          fileSizeLimit: 10 * 1024 * 1024,
        });
        console.info(`Bucket "${bucket}" updated to public`);
      }
    }

    // ── Upload ────────────────────────────────────────────────────────────────
    const timestamp = Date.now();
    const safeName = (file.originalFilename || 'image').replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileName = `${user.id}_${timestamp}_${safeName}`;

    console.info(`Uploading to bucket="${bucket}" path="${fileName}"`);

    const { data, error: uploadError } = await storage
      .from(bucket)
      .upload(fileName, fileData, {
        contentType: file.mimetype || 'image/jpeg',
        upsert: true,
      });

    // Clean up temp file regardless of outcome
    await fs.promises.unlink(file.filepath).catch(() => {});

    if (uploadError) {
      console.error("Supabase storage upload error:", uploadError.message);
      return res.status(500).json({
        message: "Failed to upload image to storage",
        error: uploadError.message,
        hint: !serviceRoleKey
          ? "Set SUPABASE_SERVICE_ROLE_KEY in your Vercel environment variables so the server can create the storage bucket and bypass RLS."
          : undefined,
      });
    }

    const { data: { publicUrl } } = storage.from(bucket).getPublicUrl(data.path);

    return res.status(200).json({ url: publicUrl });
  } catch (err) {
    console.error("Upload handler error:", err);
    return res.status(500).json({
      message: "Internal server error",
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
