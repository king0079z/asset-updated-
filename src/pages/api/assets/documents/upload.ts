import { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@/util/supabase/api";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import prisma from "@/lib/prisma";
import formidable from "formidable";
import fs from "fs";

export const config = {
  api: { bodyParser: false },
};

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
];

const ALLOWED_EXTENSIONS = [
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
  "txt", "csv", "jpg", "jpeg", "png", "webp", "gif",
];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const supabase = createClient(req, res);
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    const user = session?.user ?? null;

    if (authError || !user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // ── Parse multipart form ─────────────────────────────────────────────────
    const form = formidable({ maxFileSize: 10 * 1024 * 1024 });
    const [fields, files] = await form.parse(req);

    const assetId = Array.isArray(fields.assetId) ? fields.assetId[0] : fields.assetId;
    if (!assetId) {
      return res.status(400).json({ message: "assetId is required" });
    }

    const file = files.document?.[0];
    if (!file) {
      return res.status(400).json({ message: "No document file provided (field name must be 'document')" });
    }

    // ── Validate type ─────────────────────────────────────────────────────────
    const mimeType = (file.mimetype ?? "").toLowerCase();
    const ext = (file.originalFilename?.split(".").pop() ?? "").toLowerCase();

    if (!ALLOWED_MIME_TYPES.includes(mimeType) && !ALLOWED_EXTENSIONS.includes(ext)) {
      await fs.promises.unlink(file.filepath).catch(() => {});
      return res.status(400).json({
        message: `Unsupported file type "${mimeType || ext}". Allowed: PDF, Word, Excel, PowerPoint, TXT, CSV, and images.`,
      });
    }

    // ── Validate size ─────────────────────────────────────────────────────────
    if (file.size > 10 * 1024 * 1024) {
      await fs.promises.unlink(file.filepath).catch(() => {});
      return res.status(400).json({ message: "File too large. Maximum size is 10 MB." });
    }

    const fileData = await fs.promises.readFile(file.filepath);

    // ── Storage client ────────────────────────────────────────────────────────
    const supabaseUrl  = (process.env.NEXT_PUBLIC_SUPABASE_URL        ?? "").trim();
    const serviceKey   = (process.env.SUPABASE_SERVICE_ROLE_KEY        ?? "").trim() || undefined;
    const imageBucket  = (process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ?? "assets").trim();
    const docsBucket   = "asset-documents";

    const storage = serviceKey
      ? createAdminClient(supabaseUrl, serviceKey).storage
      : supabase.storage;

    // ── Ensure the documents bucket exists and is public ─────────────────────
    if (serviceKey) {
      const { data: buckets } = await storage.listBuckets();
      const existing = buckets?.find((b) => b.name === docsBucket);
      if (!existing) {
        const { error: bucketErr } = await storage.createBucket(docsBucket, {
          public: true,
          fileSizeLimit: 10 * 1024 * 1024,
        });
        if (bucketErr && !bucketErr.message.toLowerCase().includes("already exist")) {
          console.error("Could not create documents bucket:", bucketErr.message);
          return res.status(500).json({ message: "Storage bucket could not be created", error: bucketErr.message });
        }
      } else if (!existing.public) {
        await storage.updateBucket(docsBucket, { public: true, fileSizeLimit: 10 * 1024 * 1024 });
      }
    }

    // ── Upload to Supabase Storage ────────────────────────────────────────────
    const timestamp = Date.now();
    const safeName  = (file.originalFilename ?? "document").replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${assetId}/${user.id}_${timestamp}_${safeName}`;

    const { data: uploadData, error: uploadError } = await storage
      .from(docsBucket)
      .upload(storagePath, fileData, {
        contentType: mimeType || "application/octet-stream",
        upsert: true,
      });

    // Clean up temp file
    await fs.promises.unlink(file.filepath).catch(() => {});

    if (uploadError) {
      console.error("Supabase document upload error:", uploadError.message);
      return res.status(500).json({ message: "Failed to upload document to storage", error: uploadError.message });
    }

    const { data: { publicUrl } } = storage.from(docsBucket).getPublicUrl(uploadData.path);

    // ── Save record in Prisma ─────────────────────────────────────────────────
    const document = await prisma.assetDocument.create({
      data: {
        assetId,
        fileName:     file.originalFilename ?? safeName,
        fileUrl:      publicUrl,
        fileType:     mimeType || "application/octet-stream",
        fileSize:     file.size,
        uploadedById: user.id,
      },
    });

    return res.status(200).json({ document });
  } catch (err) {
    console.error("Document upload handler error:", err);
    return res.status(500).json({
      message: "Internal server error",
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
