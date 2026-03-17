// @ts-nocheck
/**
 * Outlook add-in auth callback. Opens in an Office dialog after user logs in.
 * Reads Supabase session and sends access token back to the task pane, then closes.
 *
 * Communication strategy (in order):
 *  1. window.opener.postMessage()       — works when opened via window.open() (web fallback)
 *  2. Office.context.ui.messageParent() — required for Office desktop displayDialogAsync
 *
 * IMPORTANT: Office.js loads asynchronously. We fetch the token immediately but
 * store it in a ref, then retry inside Office.onReady() so we never race.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import Head from 'next/head';
import Script from 'next/script';
import { createClient } from '@/util/supabase/component';
import { isSupabaseConfigured } from '@/util/supabase/env';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';

const OUTLOOK_AUTH_MESSAGE = 'OUTLOOK_AUTH';

export default function OutlookAuthCallback() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  // Holds the JSON payload once we have the session; consumed by whichever
  // communication path fires first (opener postMessage or Office messageParent).
  const pendingPayload = useRef<string | null>(null);
  const sent = useRef(false);

  const markSuccess = useCallback(() => {
    sent.current = true;
    setStatus('success');
    setMessage('Signed in! You can close this window.');
    setTimeout(() => {
      try { window.close(); } catch { /* ignore */ }
    }, 1500);
  }, []);

  // Try to send via Office.context.ui.messageParent — returns true if sent.
  const tryOfficeMessage = useCallback((payload: string): boolean => {
    const Office = (window as any).Office;
    if (!Office?.context?.ui?.messageParent) return false;
    try {
      Office.context.ui.messageParent(payload);
      markSuccess();
      return true;
    } catch { return false; }
  }, [markSuccess]);

  // Try to send via window.opener.postMessage — returns true if sent.
  const tryOpenerMessage = useCallback((token: string): boolean => {
    if (!window.opener) return false;
    try {
      window.opener.postMessage(
        { type: OUTLOOK_AUTH_MESSAGE, accessToken: token },
        window.location.origin
      );
      markSuccess();
      return true;
    } catch { return false; }
  }, [markSuccess]);

  useEffect(() => {
    const run = async () => {
      if (typeof window === 'undefined' || !isSupabaseConfigured()) {
        setStatus('error');
        setMessage('Configuration error.');
        return;
      }
      try {
        const supabase = createClient();
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session?.access_token) {
          setStatus('error');
          setMessage('Not signed in. Please sign in and try again.');
          return;
        }
        const token = session.access_token;
        const payload = JSON.stringify({ type: OUTLOOK_AUTH_MESSAGE, accessToken: token });

        // Fastest path: window.open fallback (Outlook Web)
        if (tryOpenerMessage(token)) return;

        // Second path: Office.js already loaded (desktop, cached)
        if (tryOfficeMessage(payload)) return;

        // Office.js is still loading — store payload; Script onLoad will finish.
        pendingPayload.current = payload;
        // Keep status as 'loading' so the spinner shows while we wait.
      } catch (e) {
        setStatus('error');
        setMessage(e instanceof Error ? e.message : 'Something went wrong.');
      }
    };
    run();
  }, [tryOpenerMessage, tryOfficeMessage]);

  // Called by <Script onLoad> once Office.js is available.
  const onOfficeLoaded = useCallback(() => {
    if (sent.current) return;
    const Office = (window as any).Office;
    if (!Office) return;
    // Must wait for Office.onReady before messageParent is available.
    Office.onReady(() => {
      if (sent.current) return;
      const payload = pendingPayload.current;
      if (payload) {
        if (tryOfficeMessage(payload)) return;
      }
      // If we still couldn't send, show a clear error.
      setStatus('error');
      setMessage('Could not communicate with the task pane. Please close and try again.');
    });
  }, [tryOfficeMessage]);

  return (
    <>
      <Head>
        <title>Sign in — Outlook Add-in</title>
      </Head>
      {/* Load Office.js so messageParent() is available when opened via displayDialogAsync */}
      <Script
        src="https://appsforoffice.microsoft.com/lib/1/hosted/office.js"
        strategy="afterInteractive"
        onLoad={onOfficeLoaded}
      />
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        {status === 'loading' && (
          <>
            <Loader2 className="h-10 w-10 text-indigo-600 animate-spin mb-4" />
            <p className="text-slate-600">Completing sign in…</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle className="h-10 w-10 text-emerald-600 mb-4" />
            <p className="text-slate-700 font-medium">{message}</p>
          </>
        )}
        {status === 'error' && (
          <>
            <AlertCircle className="h-10 w-10 text-amber-600 mb-4" />
            <p className="text-slate-700 text-center">{message}</p>
          </>
        )}
      </div>
    </>
  );
}
