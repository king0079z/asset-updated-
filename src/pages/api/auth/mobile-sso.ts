/**
 * GET /api/auth/mobile-sso?at=ACCESS_TOKEN&rt=REFRESH_TOKEN&next=/path
 *
 * Mobile-to-web SSO bridge.
 * The native app redirects the WebView to this endpoint, passing the
 * Supabase session tokens as query parameters.
 *
 * This endpoint:
 *   1. Validates the access token
 *   2. Calls supabase.auth.setSession() via the SSR client, which writes
 *      the auth cookies to the response headers
 *   3. Redirects the browser to `next` — arriving already authenticated,
 *      with a valid server-side cookie session
 *
 * This is the ONLY reliable way to hand off a native Supabase session to
 * a Next.js app that uses SSR / server-side session checks via cookies.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js';
import { createClient } from '@/util/supabase/api';
import { getSupabaseEnv } from '@/util/supabase/env';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();

  const { at, rt, next } = req.query as { at?: string; rt?: string; next?: string };

  // Sanitise redirect target
  const safeNext = next && next.startsWith('/') ? next : '/outlook/taskpane';

  if (!at) {
    return res.redirect(302, `/login?error=missing_token&next=${encodeURIComponent(safeNext)}`);
  }

  // 1. Validate the access token (anon client — no cookies involved)
  const { url, anonKey } = getSupabaseEnv();
  const anon = createSupabaseJsClient(url, anonKey);
  const { data: { user }, error: verifyError } = await anon.auth.getUser(at);

  if (verifyError || !user) {
    return res.redirect(302, `/login?error=invalid_token&next=${encodeURIComponent(safeNext)}`);
  }

  // 2. Set the session in the SSR client so the auth cookie is written
  //    to the response Set-Cookie header before the redirect.
  if (rt) {
    try {
      const ssrClient = createClient(req, res);
      await ssrClient.auth.setSession({ access_token: at, refresh_token: rt });
      // setSession writes the cookie headers automatically via the SSR adapter
    } catch {
      // Non-fatal — the page might still work via the localStorage injection
    }
  }

  // 3. Redirect to the destination (browser will send the cookie)
  return res.redirect(302, safeNext);
}
