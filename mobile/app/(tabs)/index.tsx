/**
 * Main App screen — full-screen WebView (Outlook taskpane interface)
 *
 * Top bar features:
 *  • AssetXAI logo (image asset — no font dependency)
 *  • Back navigation (when WebView can go back)
 *  • Scan button → opens native camera scanner
 *  • Notifications bell → navigates to native alerts screen
 *
 * HANDHELD role users are automatically redirected to the native handheld screen.
 * All other roles see the Outlook taskpane (Submit Ticket, My Tickets, etc.).
 */
import { useRef, useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform,
  StatusBar, Modal, Image,
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
import { getMyProfile } from '@/lib/api';

// The interface shown is identical to the Outlook add-in taskpane
const TASKPANE_URL = `${API_URL}/outlook/taskpane`;

// ── Scanner modal ─────────────────────────────────────────────────────────
function ScannerModal({
  visible, onScanned, onClose,
}: {
  visible: boolean; onScanned: (v: string) => void; onClose: () => void;
}) {
  const [perm, requestPerm] = useCameraPermissions();
  const scannedRef = useRef(false);

  useEffect(() => {
    if (visible) { scannedRef.current = false; if (!perm?.granted) requestPerm(); }
  }, [visible]);

  if (!visible) return null;

  if (!perm?.granted) {
    return (
      <Modal visible transparent animationType="slide">
        <View style={scan.overlay}>
          <View style={scan.permBox}>
            <View style={scan.permIcon}>
              <Ionicons name="camera-outline" size={36} color="#fff" allowFontScaling={false} />
            </View>
            <Text style={scan.permTitle}>Camera Access Required</Text>
            <Text style={scan.permBody}>AssetXAI needs camera access to scan barcodes, QR codes, and RFID tags.</Text>
            <TouchableOpacity style={scan.permBtn} onPress={requestPerm}>
              <Text style={scan.permBtnText}>Grant Access</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={{ marginTop: 8 }}>
              <Text style={scan.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible transparent animationType="fade">
      <View style={scan.overlay}>
        <StatusBar barStyle="light-content" />
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{
            barcodeTypes: ['qr', 'code128', 'code39', 'ean13', 'ean8', 'datamatrix', 'pdf417'],
          }}
          onBarcodeScanned={result => {
            if (scannedRef.current) return;
            scannedRef.current = true;
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onScanned(result.data);
          }}
        />
        {/* Dark vignette */}
        <View style={scan.vignette} pointerEvents="none" />
        {/* Viewfinder */}
        <View style={scan.finder} pointerEvents="none">
          {/* Corner brackets */}
          <View style={[scan.corner, scan.cTL]} />
          <View style={[scan.corner, scan.cTR]} />
          <View style={[scan.corner, scan.cBL]} />
          <View style={[scan.corner, scan.cBR]} />
          {/* Scan line animation handled by pulsing border */}
          <View style={scan.scanLine} />
        </View>
        {/* Header */}
        <View style={[scan.headerRow, { paddingTop: 60 }]}>
          <TouchableOpacity style={scan.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={22} color="#fff" allowFontScaling={false} />
          </TouchableOpacity>
        </View>
        {/* Footer */}
        <View style={scan.footer}>
          <View style={scan.footerPill}>
            <Ionicons name="scan-outline" size={16} color="#a5b4fc" allowFontScaling={false} />
            <Text style={scan.footerText}>Point at barcode · QR code · RFID tag</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Network error screen ─────────────────────────────────────────────────
function NetworkError({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={err.wrap}>
      <View style={err.iconBox}>
        <Ionicons name="cloud-offline-outline" size={40} color="#4f46e5" allowFontScaling={false} />
      </View>
      <Text style={err.title}>No Connection</Text>
      <Text style={err.body}>Check your internet connection and try again.</Text>
      <TouchableOpacity style={err.btn} onPress={onRetry} activeOpacity={0.85}>
        <LinearGradient colors={['#4f46e5', '#7c3aed']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={err.btnInner}>
          <Ionicons name="refresh-outline" size={16} color="#fff" allowFontScaling={false} />
          <Text style={err.btnText}>Retry</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

// ── Unread badge ─────────────────────────────────────────────────────────
function Badge({ count }: { count: number }) {
  if (count < 1) return null;
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{count > 9 ? '9+' : count}</Text>
    </View>
  );
}

// ── Main screen ──────────────────────────────────────────────────────────
export default function AppScreen() {
  const insets   = useRef(useSafeAreaInsets()).current;
  const router   = useRouter();
  const webRef   = useRef<WebView>(null);

  const [session,     setSession]     = useState<any>(null);
  const [bridgeReady, setBridgeReady] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [networkError, setNetworkError] = useState(false);
  const [canGoBack,   setCanGoBack]   = useState(false);
  const [scanVisible, setScanVisible] = useState(false);
  const [scanCallback,setScanCallback]= useState<string | null>(null);
  const [pushToken,   setPushToken]   = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const webKeyRef = useRef(0);
  const [webKey,  setWebKey]  = useState(0);

  // ── Fetch session + role check ─────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setBridgeReady(true);
    });
    supabase.auth.onAuthStateChange((_e, s) => setSession(s));
  }, []);

  // ── HANDHELD role gate ─────────────────────────────────────────────────
  useEffect(() => {
    if (!session) return;
    getMyProfile()
      .then(profile => {
        if (profile?.role === 'HANDHELD') {
          router.replace('/(tabs)/inventory' as any);
        }
      })
      .catch(() => {});
  }, [session]);

  // ── Push token + unread count ──────────────────────────────────────────
  useEffect(() => {
    Notifications.getExpoPushTokenAsync().then(t => setPushToken(t.data)).catch(() => {});

    const sub = Notifications.addNotificationReceivedListener(() => {
      setUnreadCount(n => n + 1);
    });
    return () => Notifications.removeNotificationSubscription(sub);
  }, []);

  // ── Build bridge injection script ─────────────────────────────────────
  const injectedScript = bridgeReady
    ? buildBridgeScript(session ? JSON.stringify(session) : 'null', SUPABASE_URL)
    : '';

  // ── Handle messages from WebView ──────────────────────────────────────
  const handleMessage = useCallback(async (event: WebViewMessageEvent) => {
    let msg: any;
    try { msg = JSON.parse(event.nativeEvent.data); } catch { return; }

    switch (msg.type) {
      case 'scan':
        setScanCallback(msg.callbackId ?? null);
        setScanVisible(true);
        break;

      case 'notification':
        await Notifications.scheduleNotificationAsync({
          content: { title: msg.title || 'AssetXAI', body: msg.body || '', data: msg.data || {}, sound: true },
          trigger: null,
        });
        setUnreadCount(n => n + 1);
        break;

      case 'haptic':
        switch (msg.style) {
          case 'success': Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); break;
          case 'error':   Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);   break;
          case 'warning': Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); break;
          case 'heavy':   Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);              break;
          default:        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        break;

      case 'navigate':
        if (msg.route === 'handheld') router.push('/(tabs)/inventory' as any);
        if (msg.route === 'alerts')   { setUnreadCount(0); router.push('/(tabs)/alerts' as any); }
        break;

      case 'getPushToken':
        webRef.current?.injectJavaScript(
          `window.AssetXAI._resolve(${JSON.stringify(msg.callbackId)},${JSON.stringify(pushToken)});true;`
        );
        break;
    }
  }, [pushToken]);

  const handleScanResult = useCallback((value: string) => {
    setScanVisible(false);
    if (scanCallback && webRef.current) {
      webRef.current.injectJavaScript(
        `window.AssetXAI._resolve(${JSON.stringify(scanCallback)},${JSON.stringify(value)});true;`
      );
    }
    setScanCallback(null);
  }, [scanCallback]);

  // ── Forward push notifications to WebView ─────────────────────────────
  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener(n => {
      const payload = JSON.stringify({
        type: 'notification_received', callbackId: null,
        value: { title: n.request.content.title, body: n.request.content.body, data: n.request.content.data },
      });
      webRef.current?.injectJavaScript(
        `window.dispatchEvent(new MessageEvent('message',{data:${JSON.stringify(payload)}}));true;`
      );
    });
    return () => Notifications.removeNotificationSubscription(sub);
  }, []);

  const retry = () => {
    setNetworkError(false);
    webKeyRef.current += 1;
    setWebKey(webKeyRef.current);
  };

  const openAlerts = () => {
    setUnreadCount(0);
    router.push('/(tabs)/alerts' as any);
  };

  const topPad = insets.top + (Platform.OS === 'android' ? 28 : 0);

  return (
    <View style={{ flex: 1, backgroundColor: '#1e1b4b' }}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* ── Top bar ────────────────────────────────────────────────────── */}
      <LinearGradient
        colors={['#1e1b4b', '#3730a3']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.bar, { paddingTop: topPad, paddingBottom: 10 }]}
      >
        {/* Left: back (if applicable) + logo + title */}
        <View style={styles.barLeft}>
          {canGoBack && (
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => webRef.current?.goBack()}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="arrow-back" size={20} color="#fff" allowFontScaling={false} />
            </TouchableOpacity>
          )}

          {/* Logo: Image asset — guaranteed to render regardless of font state */}
          <Image
            source={require('../../../assets/icon.png')}
            style={styles.logoImg}
            resizeMode="cover"
          />
          <Text style={styles.barTitle}>AssetXAI</Text>
        </View>

        {/* Right: scan + notifications bell */}
        <View style={styles.barRight}>
          {/* Scan button */}
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => { setScanCallback(null); setScanVisible(true); }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="scan-outline" size={22} color="#fff" allowFontScaling={false} />
          </TouchableOpacity>

          {/* Notifications bell */}
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={openAlerts}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={unreadCount > 0 ? 'notifications' : 'notifications-outline'}
              size={22}
              color={unreadCount > 0 ? '#fbbf24' : '#fff'}
              allowFontScaling={false}
            />
            <Badge count={unreadCount} />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* ── Progress bar ───────────────────────────────────────────────── */}
      {loadProgress > 0 && loadProgress < 1 && (
        <View style={styles.progressTrack}>
          <LinearGradient
            colors={['#818cf8', '#4f46e5']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.progressBar, { width: `${loadProgress * 100}%` as any }]}
          />
        </View>
      )}

      {/* ── WebView / Error ─────────────────────────────────────────────── */}
      {networkError ? (
        <NetworkError onRetry={retry} />
      ) : (
        <WebView
          key={webKey}
          ref={webRef}
          source={{ uri: TASKPANE_URL }}
          style={{ flex: 1, backgroundColor: '#f8fafc' }}

          injectedJavaScriptBeforeContentLoaded={injectedScript}
          javaScriptEnabled
          domStorageEnabled
          allowsBackForwardNavigationGestures
          sharedCookiesEnabled

          cacheEnabled
          cacheMode="LOAD_CACHE_ELSE_NETWORK"

          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          allowsFullscreenVideo

          mixedContentMode="compatibility"
          originWhitelist={['https://*', 'http://*']}

          onLoadProgress={({ nativeEvent }) => setLoadProgress(nativeEvent.progress)}
          onLoadEnd={() => setLoadProgress(0)}
          onNavigationStateChange={state => setCanGoBack(state.canGoBack)}
          onError={() => setNetworkError(true)}
          onHttpError={({ nativeEvent }) => {
            if (nativeEvent.statusCode >= 500) setNetworkError(true);
          }}
          onMessage={handleMessage}

          applicationNameForUserAgent="AssetXAI-Native/2.2"

          decelerationRate="normal"
          scrollEnabled
          bounces
          pullToRefreshEnabled={Platform.OS === 'ios'}
        />
      )}

      {/* ── Native scanner modal ───────────────────────────────────────── */}
      <ScannerModal
        visible={scanVisible}
        onScanned={handleScanResult}
        onClose={() => { setScanVisible(false); setScanCallback(null); }}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    zIndex: 10,
  },
  barLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  barRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  logoImg: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  barTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.3,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#1e1b4b',
  },
  badgeText: { fontSize: 8, fontWeight: '900', color: '#fff' },

  progressTrack: { height: 2, backgroundColor: 'rgba(99,102,241,0.15)' },
  progressBar:   { height: 2 },
});

// Scanner styles
const scan = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000' },
  vignette: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    shadowColor: '#000',
  },
  finder: {
    position: 'absolute',
    width: 250, height: 250,
    top: '50%', left: '50%',
    marginTop: -125, marginLeft: -125,
  },
  corner: {
    position: 'absolute',
    width: 32, height: 32,
    borderColor: '#6366f1',
  },
  cTL: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 4 },
  cTR: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 4 },
  cBL: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 4 },
  cBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 4 },
  scanLine: {
    position: 'absolute',
    top: '50%', left: 8, right: 8,
    height: 2,
    backgroundColor: 'rgba(99,102,241,0.7)',
    borderRadius: 1,
  },
  headerRow: {
    position: 'absolute', left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'flex-end',
    paddingHorizontal: 20,
  },
  closeBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  footer: {
    position: 'absolute', bottom: 80,
    left: 0, right: 0, alignItems: 'center',
  },
  footerPill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingVertical: 10, paddingHorizontal: 20,
    borderRadius: 24,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  footerText: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '500' },
  permBox: {
    backgroundColor: '#1e1b4b',
    borderRadius: 28, padding: 32, margin: 24,
    alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  permIcon: {
    width: 72, height: 72, borderRadius: 22,
    backgroundColor: '#4f46e5',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  permTitle: { fontSize: 20, fontWeight: '800', color: '#fff', textAlign: 'center' },
  permBody:  { fontSize: 14, color: 'rgba(255,255,255,0.65)', textAlign: 'center', lineHeight: 20 },
  permBtn:   { backgroundColor: '#4f46e5', paddingVertical: 14, paddingHorizontal: 32, borderRadius: 16, marginTop: 4, width: '100%', alignItems: 'center' },
  permBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  cancelText:  { color: 'rgba(255,255,255,0.45)', fontSize: 14 },
});

// Error styles
const err = StyleSheet.create({
  wrap:  { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, backgroundColor: '#f8fafc', gap: 12 },
  iconBox: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: '#eef2ff',
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  title: { fontSize: 22, fontWeight: '800', color: '#0f172a' },
  body:  { fontSize: 15, color: '#64748b', textAlign: 'center', lineHeight: 22 },
  btn:   { borderRadius: 16, overflow: 'hidden', marginTop: 8 },
  btnInner: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14, paddingHorizontal: 28 },
  btnText:  { color: '#fff', fontSize: 15, fontWeight: '700' },
});
