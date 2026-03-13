// @ts-nocheck
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';

export const config = { api: { bodyParser: false } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabase = createClient(req, res);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const form = formidable({ maxFileSize: 20 * 1024 * 1024 });
    const [, files] = await form.parse(req);
    const file = Array.isArray(files.file) ? files.file[0] : files.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    const ext = path.extname(file.originalFilename ?? '').toLowerCase().replace('.', '');
    const allowedExts = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'];
    if (!allowedExts.includes(ext)) return res.status(400).json({ error: 'Invalid file type' });

    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const filename = `floor-plans/${session.user.id}-${Date.now()}.${ext}`;
    const fileBuffer = fs.readFileSync(file.filepath);

    const { error: uploadError } = await adminClient.storage
      .from('rfid-floor-plans')
      .upload(filename, fileBuffer, {
        contentType: file.mimetype ?? 'image/png',
        upsert: true,
      });

    if (uploadError) {
      console.error('Supabase upload error:', uploadError);
      return res.status(500).json({ error: 'Upload failed: ' + uploadError.message });
    }

    const { data: urlData } = adminClient.storage
      .from('rfid-floor-plans')
      .getPublicUrl(filename);

    return res.status(200).json({ url: urlData.publicUrl });
  } catch (err: any) {
    console.error('Floor plan upload error:', err);
    return res.status(500).json({ error: err.message ?? 'Upload failed' });
  }
}
