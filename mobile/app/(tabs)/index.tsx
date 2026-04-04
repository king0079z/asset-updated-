/**
 * Main App tab — full-screen PWA WebView
 * Loads assetxai.live with:
 *  • Supabase session auto-injection (SSO — user logs in once)
 *  • Native scan bridge (barcode / QR / RFID via camera)
 *  • Native push notification bridge
 *  • Native haptic feedback bridge
 *  • Network error + retry screen
 *  • Pull-to-refresh
 *  • Loading progress bar
 */
import { useRef, useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform,
  StatusBar, ActivityIndicator, Modal, Alert as RNAlert,
} from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { API_URL, SUPABASE_URL } from '@/constants/config';
import { supabase } from '@/lib/supabase';
import { buildBridgeScript } from '@/lib/webBridge';

// ── Scanner modal ──────────────────────────────────────────────────────────
function ScannerModal({
  visible,
  onScanned,
  onClose,
}: {
  visible: boolean;
  onScanned: (value: string) => void;
  onClose: () => void;
}) {
  const [perm, requestPerm] = useCameraPermissions();
  const scannedRef = useRef(false);

  useEffect(() => {
    if (visible) {
      scannedRef.current = false;
      if (!perm?.granted) requestPerm();
    }
  }, [visible]);

  if (!visible) return null;

  if (!perm?.granted) {
    return (
      <Modal visible transparent animationType="slide">
        <View style={scan.overlay}>
          <View style={scan.permBox}>
            <Ionicons name="camera-outline" size={48} color="#fff" allowFontScaling={false} />
            <Text style={scan.permTitle}>Camera Access Required</Text>
            <Text style={scan.permBody}>
              AssetXAI needs camera access to scan barcodes, QR codes, and RFID tags.
            </Text>
            <TouchableOpacity style={scan.permBtn} onPress={requestPerm}>
              <Text style={scan.permBtnText}>Grant Access</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose}>
              <Text style={scan.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible transparent animationType="slide">
      <View style={scan.overlay}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr', 'code128', 'code39', 'ean13', 'ean8', 'datamatrix', 'pdf417'] }}
          onBarcodeScanned={result => {
            if (scannedRef.current) return;
            scannedRef.current = true;
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onScanned(result.data);
          }}
        />
        {/* Viewfinder overlay */}
        <View style={scan.frame} pointerEvents="none">
          <View style={scan.corner} />
          <View style={[scan.corner, scan.cornerTR]} />
          <View style={[scan.corner, scan.cornerBL]} />
          <View style={[scan.corner, scan.cornerBR]} />
        </View>
        <View style={scan.headerRow}>
          <TouchableOpacity style={scan.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={24} color="#fff" allowFontScaling={false} />
          </TouchableOpacity>
        </View>
        <View style={scan.footer}>
          <Text style={scan.footerText}>Point at a barcode, QR code or RFID tag</Text>
        </View>
      </View>
    </Modal>
  );
}

// ── Network error screen ──────────────────────────────────────────────────
function NetworkError({ url, onRetry }: { url: string; onRetry: () => void }) {
  return (
    <View style={err.wrap}>
      <Ionicons name="cloud-offline-outline" size={64} color="#94a3b8" allowFontScaling={false} />
      <Text style={err.title}>Connection Failed</Text>
      <Text style={err.body}>Make sure you have an internet connection and try again.</Text>
      <TouchableOpacity style={err.btn} onPress={onRetry} activeOpacity={0.85}>
        <LinearGradient colors={['#4f46e5', '#7c3aed']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={err.btnInner}>
          <Ionicons name="refresh-outline" size={18} color="#fff" allowFontScaling={false} />
          <Text style={err.btnText}>Retry</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

// ── Main screen ─────────────────────────────────────────────────────────────
export default function AppWebViewScreen() {
  const insets  = useSafeAreaInsets();
  const router  = useRouter();
  const webRef  = useRef<WebView>(null);
  const [session,     setSession]     = useState<any>(null);
  const [bridgeReady, setBridgeReady] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [networkError, setNetworkError] = useState(false);
  const [canGoBack,   setCanGoBack]   = useState(false);
  const [scanVisible, setScanVisible] = useState(false);
  const [scanCallback, setScanCallback] = useState<string | null>(null);
  const [pushToken, setPushToken] = useState<string>('');
  const keyCounter = useRef(0);
  const [webKey, setWebKey] = useState(0);

  // ── Fetch Supabase session ────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setBridgeReady(true);
    });
    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
  }, []);

  // ── Get push token ────────────────────────────────────────────────────────
  useEffect(() => {
    Notifications.getExpoPushTokenAsync()
      .then(t => setPushToken(t.data))
      .catch(() => {});
  }, []);

  // ── Inject bridge script ──────────────────────────────────────────────────
  const injectedScript = bridgeReady
    ? buildBridgeScript(
        session ? JSON.stringify(session) : 'null',
        SUPABASE_URL
      )
    : '';

  // ── Handle messages from WebView ──────────────────────────────────────────
  const handleMessage = useCallback(async (event: WebViewMessageEvent) => {
    let msg: any;
    try { msg = JSON.parse(event.nativeEvent.data); } catch { return; }

    switch (msg.type) {
      // ── Scan (barcode / QR / RFID) ────────────────────────────────────────
      case 'scan': {
        setScanCallback(msg.callbackId);
        setScanVisible(true);
        break;
      }

      // ── Native push notification ──────────────────────────────────────────
      case 'notification': {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: msg.title || 'AssetXAI',
            body:  msg.body  || '',
            data:  msg.data  || {},
            sound: true,
          },
          trigger: null, // immediate
        });
        break;
      }

      // ── Haptic feedback ───────────────────────────────────────────────────
      case 'haptic': {
        switch (msg.style) {
          case 'success': Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); break;
          case 'error':   Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);   break;
          case 'warning': Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); break;
          case 'heavy':   Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);              break;
          case 'medium':  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);             break;
          default:        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        break;
      }

      // ── Navigate to native screen ──────────────────────────────────────────
      case 'navigate': {
        if (msg.route === 'handheld') router.push('/(tabs)/inventory' as any);
        break;
      }

      // ── Get push token ─────────────────────────────────────────────────────
      case 'getPushToken': {
        webRef.current?.injectJavaScript(
          `window.AssetXAI._resolve(${JSON.stringify(msg.callbackId)}, ${JSON.stringify(pushToken)}); true;`
        );
        break;
      }
    }
  }, [pushToken]);

  // ── Called when native scan completes ─────────────────────────────────────
  const handleScanResult = useCallback((value: string) => {
    setScanVisible(false);
    if (scanCallback && webRef.current) {
      webRef.current.injectJavaScript(
        `window.AssetXAI._resolve(${JSON.stringify(scanCallback)}, ${JSON.stringify(value)}); true;`
      );
    }
    setScanCallback(null);
  }, [scanCallback]);

  // ── Forward incoming push notifications to WebView ────────────────────────
  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener(notification => {
      const payload = JSON.stringify({
        type: 'notification_received',
        callbackId: null,
        value: {
          title: notification.request.content.title,
          body:  notification.request.content.body,
          data:  notification.request.content.data,
        },
      });
      webRef.current?.injectJavaScript(`
        window.dispatchEvent(new MessageEvent('message', { data: ${JSON.stringify(payload)} }));
        true;
      `);
    });
    return () => Notifications.removeNotificationSubscription(sub);
  }, []);

  const retry = () => {
    setNetworkError(false);
    keyCounter.current += 1;
    setWebKey(keyCounter.current);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#1e1b4b' }}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* ── Slim top bar ──────────────────────────────────────────────────── */}
      <LinearGradient
        colors={['#1e1b4b', '#3730a3']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.bar, { paddingTop: insets.top + (Platform.OS === 'android' ? 28 : 0) }]}
      >
        <View style={styles.barLeft}>
          {canGoBack && (
            <TouchableOpacity
              style={styles.barBtn}
              onPress={() => webRef.current?.goBack()}
            >
              <Ionicons name="arrow-back" size={20} color="#fff" allowFontScaling={false} />
            </TouchableOpacity>
          )}
          <Ionicons name="cube" size={18} color="#a5b4fc" allowFontScaling={false} />
          <Text style={styles.barTitle}>AssetXAI</Text>
        </View>
        <View style={styles.barRight}>
          <TouchableOpacity
            style={styles.barBtn}
            onPress={() => { setScanCallback(null); setScanVisible(true); }}
          >
            <Ionicons name="scan-outline" size={20} color="#fff" allowFontScaling={false} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.barBtn} onPress={() => webRef.current?.reload()}>
            <Ionicons name="refresh-outline" size={20} color="#fff" allowFontScaling={false} />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* ── Progress bar ──────────────────────────────────────────────────── */}
      {loadProgress > 0 && loadProgress < 1 && (
        <View style={styles.progressTrack}>
          <LinearGradient
            colors={['#818cf8', '#4f46e5']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.progressBar, { width: `${loadProgress * 100}%` }]}
          />
        </View>
      )}

      {/* ── WebView / Error ────────────────────────────────────────────────── */}
      {networkError ? (
        <NetworkError url={API_URL} onRetry={retry} />
      ) : (
        <WebView
          key={webKey}
          ref={webRef}
          source={{ uri: API_URL }}
          style={{ flex: 1, backgroundColor: '#f1f5f9' }}

          // Auth + bridge injection
          injectedJavaScriptBeforeContentLoaded={injectedScript}
          javaScriptEnabled
          domStorageEnabled
          allowsBackForwardNavigationGestures
          sharedCookiesEnabled

          // Performance
          cacheEnabled
          cacheMode="LOAD_CACHE_ELSE_NETWORK"

          // Media / content
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          allowsFullscreenVideo

          // Security
          mixedContentMode="compatibility"
          originWhitelist={['https://*', 'http://*']}

          // Events
          onLoadProgress={({ nativeEvent }) => setLoadProgress(nativeEvent.progress)}
          onLoadEnd={() => setLoadProgress(0)}
          onNavigationStateChange={state => setCanGoBack(state.canGoBack)}
          onError={() => setNetworkError(true)}
          onHttpError={({ nativeEvent }) => {
            if (nativeEvent.statusCode >= 500) setNetworkError(true);
          }}
          onMessage={handleMessage}

          // User agent — identifies as mobile
          applicationNameForUserAgent="AssetXAI-Native/2.1"

          // iOS
          decelerationRate="normal"
          scrollEnabled
          bounces

          // Pull-to-refresh is handled by the webview itself on mobile web
          pullToRefreshEnabled={Platform.OS === 'ios'}
          refreshControl={undefined}
        />
      )}

      {/* ── Native scanner modal ──────────────────────────────────────────── */}
      <ScannerModal
        visible={scanVisible}
        onScanned={handleScanResult}
        onClose={() => { setScanVisible(false); setScanCallback(null); }}
      />
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingBottom: 10,
    zIndex: 10,
  },
  barLeft:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  barTitle: { fontSize: 15, fontWeight: '800', color: '#fff', letterSpacing: -0.2 },
  barBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  progressTrack: { height: 2, backgroundColor: 'rgba(99,102,241,0.15)' },
  progressBar:   { height: 2 },
});

// Scanner styles
const scan = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  frame: {
    position: 'absolute', width: 260, height: 260,
    top: '50%', left: '50%',
    marginTop: -130, marginLeft: -130,
  },
  corner: {
    position: 'absolute', width: 30, height: 30,
    borderColor: '#4f46e5', borderTopWidth: 3, borderLeftWidth: 3,
    top: 0, left: 0,
  },
  cornerTR: { left: undefined, right: 0, borderLeftWidth: 0, borderRightWidth: 3 },
  cornerBL: { top: undefined, bottom: 0, borderTopWidth: 0, borderBottomWidth: 3 },
  cornerBR: { top: undefined, bottom: 0, left: undefined, right: 0, borderTopWidth: 0, borderLeftWidth: 0, borderRightWidth: 3, borderBottomWidth: 3 },
  headerRow: { position: 'absolute', top: 60, left: 0, right: 0, flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 20 },
  closeBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  footer: { position: 'absolute', bottom: 100, left: 0, right: 0, alignItems: 'center' },
  footerText: { color: 'rgba(255,255,255,0.75)', fontSize: 14, fontWeight: '500' },
  permBox: { backgroundColor: '#1e1b4b', borderRadius: 24, padding: 32, margin: 24, alignItems: 'center', gap: 12 },
  permTitle: { fontSize: 20, fontWeight: '800', color: '#fff', textAlign: 'center' },
  permBody:  { fontSize: 14, color: 'rgba(255,255,255,0.7)', textAlign: 'center', lineHeight: 20 },
  permBtn:   { backgroundColor: '#4f46e5', paddingVertical: 14, paddingHorizontal: 28, borderRadius: 16, marginTop: 8 },
  permBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  cancelText:  { color: 'rgba(255,255,255,0.5)', fontSize: 14, marginTop: 4 },
});

// Error styles
const err = StyleSheet.create({
  wrap:  { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, backgroundColor: '#f1f5f9', gap: 12 },
  title: { fontSize: 22, fontWeight: '800', color: '#0f172a' },
  body:  { fontSize: 15, color: '#64748b', textAlign: 'center', lineHeight: 22 },
  btn:   { borderRadius: 16, overflow: 'hidden', marginTop: 8 },
  btnInner: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14, paddingHorizontal: 28 },
  btnText:  { color: '#fff', fontSize: 15, fontWeight: '700' },
});
