import { Html, Head, Main, NextScript } from "next/document";
import Script from "next/script";

/**
 * Inline script injected before Next.js boots.
 * Outlook's iframe sandbox removes or restricts window.history.pushState /
 * replaceState. Next.js router calls them unconditionally, which throws
 * "window.history[e] is not a function" and prevents the task pane from
 * rendering. We patch them here — before any JS framework code runs — so
 * they silently succeed inside the Office iframe.
 * The guard on pathname means normal pages are completely unaffected.
 */
const outlookHistoryPatch = `
(function(){
  try {
    if (typeof window === 'undefined') return;
    if (!window.location.pathname.startsWith('/outlook')) return;
    var noop = function(){};
    var safe = function(fn) {
      return function() { try { return fn.apply(this, arguments); } catch(e) {} };
    };
    var h = window.history;
    ['pushState','replaceState','go','back','forward'].forEach(function(m){
      if (typeof h[m] !== 'function') {
        try { h[m] = noop; } catch(e) {}
      } else {
        try { h[m] = safe(h[m].bind(h)); } catch(e) {}
      }
    });
  } catch(e) {}
})();
`.trim();

/**
 * Chunk-load recovery — injected inline into every HTML page so it runs
 * regardless of which version of _app.js is cached in the browser.
 *
 * After a new deployment Next.js generates new content-hashed filenames.
 * If a user has the OLD HTML/JS cached, client-side navigation tries to
 * fetch page chunks that no longer exist on the CDN → 404 → "Abort fetching
 * component for route" error.
 *
 * This tiny script intercepts those failures at three levels:
 *   1. Capturing error listener for <script> 404s (_next/static/chunks/)
 *   2. unhandledrejection for promise-based chunk load failures
 *   3. console.error monkey-patch to catch "Abort fetching component" noise
 * Any match → hard reload so the browser fetches fresh HTML + new chunks.
 */
const chunkRecoveryScript = `
(function(){
  try {
    var reloading = false;
    function doReload() {
      if (reloading) return;
      reloading = true;
      setTimeout(function(){ window.location.reload(); }, 200);
    }
    // 1. <script src="/_next/static/chunks/..."> failed to load
    window.addEventListener('error', function(e) {
      try {
        var t = e.target;
        if (t && t.tagName === 'SCRIPT' && typeof t.src === 'string' && t.src.indexOf('/_next/static/chunks/') !== -1) {
          e.stopPropagation();
          doReload();
        }
      } catch(_){}
    }, true);
    // 2. Promise rejection — chunk load failure or route abort
    window.addEventListener('unhandledrejection', function(e) {
      try {
        var msg = e.reason && (e.reason.message || String(e.reason));
        if (msg && (msg.indexOf('Loading chunk') !== -1 || msg.indexOf('Abort fetching component') !== -1 || msg.indexOf('Failed to fetch') !== -1)) {
          e.preventDefault();
          doReload();
        }
      } catch(_){}
    });
    // 3. console.error — Next.js logs the abort before throwing
    var _ce = console.error;
    console.error = function() {
      try {
        var msg = Array.prototype.join.call(arguments, ' ');
        if (msg.indexOf('Abort fetching component for route') !== -1) {
          doReload();
          return;
        }
      } catch(_){}
      _ce.apply(console, arguments);
    };
  } catch(_){}
})();
`.trim();

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* Must be the very first script — runs before any framework JS loads.
            Recovers from stale chunk 404s caused by new deployments. */}
        <script dangerouslySetInnerHTML={{ __html: chunkRecoveryScript }} />
        {/* Patch window.history before Next.js router initialises on Outlook pages */}
        <script dangerouslySetInnerHTML={{ __html: outlookHistoryPatch }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="icon" href="/app-favicon.svg" type="image/svg+xml" />
        <link rel="alternate icon" href="/app-favicon.ico" type="image/x-icon" />
      </Head>
      <body>
        <Main />
        <Script src="https://assets.co.dev/files/codevscript.js" strategy="afterInteractive" />
        <NextScript />
      </body>
    </Html>
  );
}
