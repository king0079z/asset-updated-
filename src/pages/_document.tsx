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

/**
 * Native bridge adapter — runs in the web app when loaded inside the AssetXAI native app.
 * Detects window.AssetXAI (injected by the WebView bridge), then:
 *  • Registers the Expo push token with the server
 *  • Adds a floating "Scan" button that calls window.AssetXAI.scan()
 *  • Listens for notification_received events from native
 */
const nativeBridgeAdapter = `
(function(){
  function init() {
    if (!window.AssetXAI || !window.AssetXAI.ready) return;
    // Register push token
    window.AssetXAI.getPushToken().then(function(token) {
      if (!token) return;
      fetch('/api/notifications/register-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token: token }),
      }).catch(function(){});
    }).catch(function(){});
    // Add floating scan button if not already present
    if (document.getElementById('assetxai-scan-fab')) return;
    var fab = document.createElement('button');
    fab.id = 'assetxai-scan-fab';
    fab.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>';
    fab.style.cssText = 'position:fixed;bottom:80px;right:20px;z-index:9999;width:52px;height:52px;border-radius:26px;background:linear-gradient(135deg,#4f46e5,#7c3aed);border:none;cursor:pointer;color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 20px rgba(79,70,229,0.45);';
    fab.onclick = function() {
      window.AssetXAI.scan('barcode').then(function(value) {
        // Dispatch a custom event so the web app can respond
        document.dispatchEvent(new CustomEvent('assetxai-scan', { detail: { value: value } }));
        // Also try to fill any focused barcode input
        var focused = document.activeElement;
        if (focused && (focused.tagName === 'INPUT' || focused.tagName === 'TEXTAREA')) {
          var nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          nativeInputValueSetter.call(focused, value);
          focused.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }).catch(function(){});
    };
    document.body.appendChild(fab);
  }
  // Wait for bridge to be ready
  document.addEventListener('assetxai-bridge-ready', init);
  // Also try immediately in case bridge was injected before this runs
  if (document.readyState === 'complete') { init(); } else { window.addEventListener('load', init); }
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
        {/* Native bridge adapter — activates when loaded inside AssetXAI native app */}
        <script dangerouslySetInnerHTML={{ __html: nativeBridgeAdapter }} />
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
