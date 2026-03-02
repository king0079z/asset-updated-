import { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@/util/supabase/api";
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
    // Get the authenticated user
    const supabase = createClient(req, res);
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    const user = session?.user ?? null;

    if (authError || !user) {
      console.error("Authentication error:", authError);
      return res.status(401).json({ message: "Unauthorized", details: authError });
    }

    console.info("Processing upload for user:", user.id);

    const form = formidable({});
    const [fields, files] = await form.parse(req);

    if (!files.image?.[0]) {
      return res.status(400).json({ message: "No image provided" });
    }

    const file = files.image[0];
    console.info("File details:", {
      name: file.originalFilename,
      type: file.mimetype,
      size: file.size
    });

    const fileData = await fs.promises.readFile(file.filepath);

    // Validate file type — accept all common image formats
    const allowedTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
      'image/gif', 'image/heic', 'image/heif', 'image/avif',
      'image/bmp', 'image/tiff', 'image/svg+xml',
    ];
    const mimeType = file.mimetype?.toLowerCase() || '';

    // Also allow by file extension as a fallback (some cameras send generic MIME types)
    const ext = (file.originalFilename?.split('.').pop() || '').toLowerCase();
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif', 'avif', 'bmp', 'tiff', 'svg'];
    const isAllowedByMime = allowedTypes.includes(mimeType);
    const isAllowedByExt = allowedExtensions.includes(ext);

    if (!isAllowedByMime && !isAllowedByExt) {
      return res.status(400).json({
        message: `Unsupported file type: ${mimeType || ext || 'unknown'}. Allowed: JPG, PNG, WEBP, GIF, HEIC, AVIF, BMP.`
      });
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return res.status(400).json({ message: "File size too large. Maximum size is 10MB." });
    }

    // Create a more organized file structure with user ID and timestamp
    const timestamp = Date.now();
    const sanitizedFileName = file.originalFilename?.replace(/[^a-zA-Z0-9.-]/g, '_') || 'unnamed';
    const fileName = `${user.id}/${timestamp}/${sanitizedFileName}`;
    const bucket = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || 'assets';
    
    console.info("Attempting to upload to bucket:", bucket);
    
    // First, ensure the path exists by creating an empty file
    const { error: pathError } = await supabase.storage
      .from(bucket)
      .upload(`${user.id}/${timestamp}/.keep`, new Uint8Array(0), {
        upsert: true
      });

    if (pathError) {
      console.error("Error creating path:", pathError);
      return res.status(500).json({ 
        message: "Failed to create upload path",
        error: pathError.message
      });
    }

    // Now upload the actual file
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, fileData, {
        contentType: file.mimetype || "image/jpeg",
        upsert: true // Allow overwriting in case of retry
      });

    if (error) {
      console.error("Error uploading file:", {
        error,
        bucket,
        fileName,
        contentType: file.mimetype
      });
      return res.status(500).json({ 
        message: "Failed to upload file",
        error: error.message,
        details: {
          name: error.name,
          message: error.message
        }
      });
    }

    console.info("File uploaded successfully:", data.path);

    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path);

    // Clean up the temporary file
    await fs.promises.unlink(file.filepath).catch(error => {
      console.error("Error cleaning up temporary file:", error);
    });

    return res.status(200).json({ url: publicUrl });
  } catch (error) {
    console.error("Error handling upload:", error);
    return res.status(500).json({ 
      message: "Internal server error",
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}