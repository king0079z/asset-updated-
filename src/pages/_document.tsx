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

export default function Document() {
  return (
    <Html lang="en">
      <Head>
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
