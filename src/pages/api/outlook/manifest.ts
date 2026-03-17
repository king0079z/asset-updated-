import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

const PLACEHOLDER = 'https://YOUR_DEPLOYMENT_URL';

/**
 * Serves the Outlook add-in manifest with the current request origin
 * so admins can install the add-in without editing the XML.
 * GET /api/outlook/manifest
 */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.setHeader('Allow', 'GET').status(405).end();
  }

  const host = req.headers.host || '';
  const proto = req.headers['x-forwarded-proto'] === 'http' ? 'http' : 'https';
  const baseUrl = `${proto}://${host}`;

  try {
    const manifestPath = path.join(process.cwd(), 'public', 'outlook-manifest.xml');
    let xml = fs.readFileSync(manifestPath, 'utf-8');
    xml = xml.split(PLACEHOLDER).join(baseUrl);

    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.status(200).send(xml);
  } catch (e) {
    console.error('[outlook/manifest]', e);
    return res.status(500).json({ error: 'Failed to load manifest' });
  }
}
