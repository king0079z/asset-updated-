// Simple file upload handler for maintenance receipts (serverless compatible: saves to /tmp)
// Uses require() for compatibility with Next.js serverless environment

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const fs = require("fs");
  const path = require("path");
  const { IncomingForm } = require("formidable");

  // Use /tmp for serverless compatibility
  const uploadDir = "/tmp";
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const form = new IncomingForm({
    uploadDir,
    keepExtensions: true,
    maxFileSize: 10 * 1024 * 1024, // 10MB
  });

  form.parse(req, (err, fields, files) => {
    if (err) {
      return res.status(500).json({ error: "File upload failed", details: err.message });
    }
    const file = files.file;
    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    // Get the file path in /tmp
    const filePath = file.filepath || file.path || "";
    const fileName = path.basename(filePath);
    const url = `/tmp/${fileName}`;
    // Note: This file is only available temporarily and is not publicly accessible in production.
    return res.status(200).json({ url, warning: "File is stored in /tmp and will not persist. For production, use cloud storage." });
  });
}