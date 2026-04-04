/**
 * JavaScript injected into the WebView before the page loads.
 * Provides the window.AssetXAI bridge so the web app can call native features.
 * Placeholders __SESSION__ and __SUPABASE_URL__ are replaced at runtime.
 */
export function buildBridgeScript(sessionJson: string, supabaseUrl: string): string {
  return `
(function() {
  // ── 1. Auth token injection ───────────────────────────────────────────────
  // The Outlook taskpane reads its token from sessionStorage key:
  //   'outlook_addin_access_token'
  // We inject the native Supabase access_token there so the user is
  // automatically signed in without seeing the login screen.
  try {
    var session = ${sessionJson};
    var sbUrl   = ${JSON.stringify(supabaseUrl)};
    if (session && session.access_token) {
      // ── Outlook taskpane auth (primary) ────────────────────────────────
      sessionStorage.setItem('outlook_addin_access_token', session.access_token);

      // ── Supabase localStorage auth (fallback for full web app pages) ──
      if (sbUrl) {
        var ref = sbUrl.replace('https://', '').split('.')[0];
        var key = 'sb-' + ref + '-auth-token';
        var payload = JSON.stringify({
          access_token:  session.access_token,
          refresh_token: session.refresh_token,
          expires_at:    session.expires_at,
          expires_in:    session.expires_in || 3600,
          token_type:    'bearer',
          user:          session.user,
        });
        localStorage.setItem(key, payload);
        localStorage.setItem('supabase.auth.token', payload);
      }
    }
  } catch(e) { console.warn('[AssetXAI] Session injection failed:', e); }

  // ── 2. Native bridge API ──────────────────────────────────────────────────
  window.AssetXAI = {
    _callbacks: {},

    /**
     * Scan a barcode / QR code / RFID via native camera.
     * Returns a promise that resolves with the scanned string.
     */
    scan: function(type) {
      return new Promise(function(resolve) {
        var id = Date.now().toString();
        window.AssetXAI._callbacks[id] = resolve;
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage(
          JSON.stringify({ type: 'scan', scanType: type || 'barcode', callbackId: id })
        );
      });
    },

    /**
     * Trigger a native push notification.
     */
    notify: function(title, body, data) {
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage(
        JSON.stringify({ type: 'notification', title: title, body: body, data: data || {} })
      );
    },

    /**
     * Haptic feedback: 'light' | 'medium' | 'heavy' | 'success' | 'error'
     */
    haptic: function(style) {
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage(
        JSON.stringify({ type: 'haptic', style: style || 'light' })
      );
    },

    /**
     * Navigate to the native handheld audit screen.
     */
    openHandheld: function() {
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage(
        JSON.stringify({ type: 'navigate', route: 'handheld' })
      );
    },

    /**
     * Ask the native layer for the current push token.
     */
    getPushToken: function() {
      return new Promise(function(resolve) {
        var id = Date.now().toString();
        window.AssetXAI._callbacks[id] = resolve;
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage(
          JSON.stringify({ type: 'getPushToken', callbackId: id })
        );
      });
    },

    // Internal: called by native when a callback result arrives
    _resolve: function(id, value) {
      if (window.AssetXAI._callbacks[id]) {
        window.AssetXAI._callbacks[id](value);
        delete window.AssetXAI._callbacks[id];
      }
    },
  };

  // ── 3. Receive messages from native (scan results, notifications, etc.) ──
  window.addEventListener('message', function(event) {
    try {
      var msg = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      if (msg.callbackId) {
        window.AssetXAI._resolve(msg.callbackId, msg.value);
      }
    } catch(e) {}
  });

  // ── 4. Mark bridge as ready ────────────────────────────────────────────────
  window.AssetXAI.ready = true;
  document.dispatchEvent(new CustomEvent('assetxai-bridge-ready'));
  console.log('[AssetXAI] Native bridge ready');
})();
true; // required for injectedJavaScript
`;
}
