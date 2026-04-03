// @ts-nocheck
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';

export const config = {
  api: { bodyParser: { sizeLimit: '10mb' }, responseLimit: '10mb' },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const supabase = createClient(req, res);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return res.status(401).json({ error: 'Unauthorized' });

  const { documentId } = req.query;
  const docId = Array.isArray(documentId) ? documentId[0] : documentId;

  const document = await prisma.assetDocument.findUnique({
    where: { id: docId },
    select: { id: true, fileName: true, fileUrl: true, fileType: true, fileSize: true, assetId: true, uploadedAt: true },
  });

  if (!document) return res.status(404).json({ error: 'Document not found' });

  return res.status(200).json({ document });
}
