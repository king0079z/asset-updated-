/**
 * Main screen — full-screen WebView (Outlook taskpane interface)
 *
 * Auth:
 *  • AuthGuard in _layout.tsx handles redirect to login when session = null
 *  • WebView 'signout' message → immediately navigate to native login
 *  • Re-login reloads WebView with fresh session token
 *
 * Top bar uses custom View-drawn icons (zero font dependency).
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { API_URL, SUPABASE_URL } from '@/constants/config';
import { supabase } from '@/lib/supabase';
import { buildBridgeScript } from '@/lib/webBridge';
import { getMyProfile } from '@/lib/api';

const TASKPANE_URL = `${API_URL}/outlook/taskpane`;

// ─── Custom icons (View-drawn, zero font dependency) ────────────────────────

/** Scanner/QR icon — four corner brackets */
function ScanIcon({ color = '#fff', size = 20 }: { color?: string; size?: number }) {
  const t = Math.round(size * 0.12); // bar thickness
  const l = Math.round(size * 0.35); // bracket arm length
  const corner: object[] = [
    // top-left
    { top: 0, left: 0,         width: l, height: t },
    { top: 0, left: 0,         width: t, height: l },
    // top-right
    { top: 0, right: 0,        width: l, height: t },
    { top: 0, right: 0,        width: t, height: l },
    // bottom-left
    { bottom: 0, left: 0,      width: l, height: t },
    { bottom: 0, left: 0,      width: t, height: l },
    // bottom-right
    { bottom: 0, right: 0,     width: l, height: t },
    { bottom: 0, right: 0,     width: t, height: l },
    // center scan line
    { top: size / 2 - t / 2, left: size * 0.15, right: size * 0.15, height: t },
  ];
  return (
    <View style={{ width: size, height: size }}>
      {corner.map((s, i) => (
        <View key={i} style={[{ position: 'absolute', backgroundColor: color }, s as any]} />
      ))}
    </View>
  );
}

/** Bell icon — drawn with Views */
function BellIcon({ color = '#fff', size = 20, dot = false }: { color?: string; size?: number; dot?: boolean }) {
  const w = size;
  const h = size;
  return (
    <View style={{ width: w, height: h, alignItems: 'center' }}>
      {/* Bell body */}
      <View style={{
        position: 'absolute',
        top: h * 0.14, left: w * 0.12, right: w * 0.12,
        height: h * 0.62,
        backgroundColor: color,
        borderRadius: w * 0.24,
      }} />
      {/* Bell top stem */}
      <View style={{
        position: 'absolute', top: 0,
        width: w * 0.14, height: h * 0.2,
        backgroundColor: color, borderRadius: 2,
        alignSelf: 'center',
      }} />
      {/* Bell clapper */}
      <View style={{
        position: 'absolute', bottom: h * 0.04,
        width: w * 0.3, height: h * 0.16,
        backgroundColor: color, borderRadius: w * 0.08,
        alignSelf: 'center',
      }} />
      {/* Unread dot */}
      {dot && (
        <View style={{
          position: 'absolute', top: -2, right: 0,
          width: 9, height: 9, borderRadius: 4.5,
          backgroundColor: '#ef4444',
          borderWidth: 1.5, borderColor: '#1e1b4b',
        }} />
      )}
    </View>
  );
}

/** Back chevron */
function BackIcon({ color = '#fff', size = 20 }: { color?: string; size?: number }) {
  const s = size * 0.4;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{
        width: s, height: s,
        borderLeftWidth: 2.5, borderBottomWidth: 2.5,
        borderColor: color,
        transform: [{ rotate: '45deg' }],
        marginLeft: s * 0.4,
      }} />
    </View>
  );
}

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
              <Text style={{ fontSize: 34 }}>📷</Text>
            </View>
            <Text style={scan.permTitle}>Camera Access Required</Text>
            <Text style={scan.permBody}>
              AssetXAI needs camera access to scan barcodes, QR codes, and RFID tags.
            </Text>
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
        <View style={scan.vignette} pointerEvents="none" />

        {/* Scan viewfinder */}
        <View style={scan.finder} pointerEvents="none">
          <View style={[scan.corner, scan.cTL]} />
          <View style={[scan.corner, scan.cTR]} />
          <View style={[scan.corner, scan.cBL]} />
          <View style={[scan.corner, scan.cBR]} />
          <View style={scan.scanLine} />
        </View>

        {/* Close button */}
        <View style={[scan.headerRow, { paddingTop: 60 }]}>
          <TouchableOpacity style={scan.closeBtn} onPress={onClose}>
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={scan.footer}>
          <View style={scan.footerPill}>
            <Text style={scan.footerText}>Point at barcode · QR code · RFID tag</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Network error screen ──────────────────────────────────────────────────
function NetworkError({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={err.wrap}>
      <View style={err.iconBox}>
        <Text style={{ fontSize: 38 }}>🌐</Text>
      </View>
      <Text style={err.title}>No Connection</Text>
      <Text style={err.body}>Check your internet and try again.</Text>
      <TouchableOpacity style={err.btn} onPress={onRetry} activeOpacity={0.85}>
        <LinearGradient
          colors={['#4f46e5', '#7c3aed']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={err.btnInner}
        >
          <Text style={err.btnText}>↻  Retry</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

// ── Unread badge ──────────────────────────────────────────────────────────
function Badge({ count }: { count: number }) {
  if (count < 1) return null;
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{count > 9 ? '9+' : count}</Text>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────
export default function AppScreen() {
  const insets  = useSafeAreaInsets();
  const router  = useRouter();
  const webRef  = useRef<WebView>(null);

  const [session,      setSession]      = useState<any>(null);
  const [bridgeReady,  setBridgeReady]  = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [networkError, setNetworkError] = useState(false);
  const [canGoBack,    setCanGoBack]    = useState(false);
  const [scanVisible,  setScanVisible]  = useState(false);
  const [scanCallback, setScanCallback] = useState<string | null>(null);
  const [pushToken,    setPushToken]    = useState('');
  const [unreadCount,  setUnreadCount]  = useState(0);
  // When true: WebView is instantly unmounted to prevent taskpane login from rendering
  const [webviewKilled, setWebviewKilled] = useState(false);
  const webKeyRef    = useRef(0);
  const [webKey,     setWebKey]         = useState(0);
  const prevUserIdRef = useRef<string | null>(null);

  // ── Auth state ──────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setBridgeReady(true);
      prevUserIdRef.current = s?.user?.id ?? null;
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      const prevId = prevUserIdRef.current;
      const nextId = s?.user?.id ?? null;
      setSession(s);

      if (!s) {
        // Signed out → kill WebView instantly so taskpane login never shows
        setWebviewKilled(true);
        router.replace('/(auth)/login' as any);
      } else if (prevId !== nextId) {
        // New session (login or user switch) → reset and reload WebView with fresh token
        setWebviewKilled(false);
        setBridgeReady(false);
        setTimeout(() => {
          setBridgeReady(true);
          webKeyRef.current += 1;
          setWebKey(webKeyRef.current);
        }, 80);
      }
      prevUserIdRef.current = nextId;
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── HANDHELD role gate ──────────────────────────────────────────────────
  useEffect(() => {
    if (!session) return;
    getMyProfile()
      .then(profile => { if (profile?.role === 'HANDHELD') router.replace('/(tabs)/inventory' as any); })
      .catch(() => {});
  }, [session?.user?.id]);

  // ── Push token + unread count ───────────────────────────────────────────
  useEffect(() => {
    Notifications.getExpoPushTokenAsync().then(t => setPushToken(t.data)).catch(() => {});
    const sub = Notifications.addNotificationReceivedListener(() => setUnreadCount(n => n + 1));
    return () => Notifications.removeNotificationSubscription(sub);
  }, []);

  // ── Notification tap → alerts screen ────────────────────────────────────
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(() => {
      setUnreadCount(0);
      router.push('/(tabs)/alerts' as any);
    });
    return () => Notifications.removeNotificationSubscription(sub);
  }, []);

  // ── Forward push to WebView ──────────────────────────────────────────────
  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener(n => {
      const payload = JSON.stringify({
        type: 'notification_received',
        value: { title: n.request.content.title, body: n.request.content.body, data: n.request.content.data },
      });
      webRef.current?.injectJavaScript(
        `window.dispatchEvent(new MessageEvent('message',{data:${JSON.stringify(payload)}}));true;`
      );
    });
    return () => Notifications.removeNotificationSubscription(sub);
  }, []);

  // ── Bridge script ────────────────────────────────────────────────────────
  const injectedScript = bridgeReady
    ? buildBridgeScript(session ? JSON.stringify(session) : 'null', SUPABASE_URL)
    : '';

  // ── WebView messages ─────────────────────────────────────────────────────
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
          content: {
            title: msg.title || 'AssetXAI',
            body:  msg.body  || '',
            data:  msg.data  || {},
            sound: true,
            ...(Platform.OS === 'android' ? { channelId: 'assetxai' } : {}),
          },
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

      case 'signout':
        // ⚡ Step 1: Kill the WebView instantly (prevents taskpane login from rendering)
        setWebviewKilled(true);
        // ⚡ Step 2: Navigate to native login immediately
        router.replace('/(auth)/login' as any);
        // Step 3: Clear Supabase session in background (triggers onAuthStateChange too)
        supabase.auth.signOut().catch(() => {});
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

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <LinearGradient
        colors={['#1e1b4b', '#3730a3']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.bar, { paddingTop: topPad, paddingBottom: 10 }]}
      >
        {/* Left: back + logo + title */}
        <View style={styles.barLeft}>
          {canGoBack && (
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => webRef.current?.goBack()}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <BackIcon color="#fff" size={18} />
            </TouchableOpacity>
          )}

          {/* App logo — Image never needs font loading */}
          <Image
            source={require('../../assets/icon.png')}
            style={styles.logoImg}
            resizeMode="contain"
          />
          <Text style={styles.barTitle}>AssetXAI</Text>
        </View>

        {/* Right: scan + bell */}
        <View style={styles.barRight}>

          {/* ── Scan button ── */}
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => { setScanCallback(null); setScanVisible(true); }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <ScanIcon color="#fff" size={20} />
          </TouchableOpacity>

          {/* ── Notifications bell ── */}
          <TouchableOpacity
            style={[styles.iconBtn, unreadCount > 0 && styles.iconBtnActive]}
            onPress={openAlerts}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <BellIcon
              color={unreadCount > 0 ? '#fbbf24' : '#fff'}
              size={20}
              dot={unreadCount > 0}
            />
            {unreadCount > 0 && <Badge count={unreadCount} />}
          </TouchableOpacity>

        </View>
      </LinearGradient>

      {/* ── WebView load progress ─────────────────────────────────────────── */}
      {loadProgress > 0 && loadProgress < 1 && (
        <View style={styles.progressTrack}>
          <LinearGradient
            colors={['#818cf8', '#4f46e5']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={[styles.progressBar, { width: `${loadProgress * 100}%` as any }]}
          />
        </View>
      )}

      {/* ── WebView / Error ───────────────────────────────────────────────── */}
      {webviewKilled ? (
        /* Blank holding view — shown while router navigates to native login.
           Prevents taskpane login page from ever being visible. */
        <View style={{ flex: 1, backgroundColor: '#1e1b4b' }} />
      ) : networkError ? (
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

      {/* ── Scanner modal ─────────────────────────────────────────────────── */}
      <ScannerModal
        visible={scanVisible}
        onScanned={handleScanResult}
        onClose={() => { setScanVisible(false); setScanCallback(null); }}
      />
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14, zIndex: 10,
  },
  barLeft:  { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  barRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  logoImg: {
    width: 34, height: 34,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  barTitle: { fontSize: 16, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },

  iconBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  iconBtnActive: {
    backgroundColor: 'rgba(251,191,36,0.22)',
    borderColor: 'rgba(251,191,36,0.5)',
  },

  badge: {
    position: 'absolute', top: -5, right: -5,
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: '#ef4444',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 2, borderColor: '#1e1b4b',
    zIndex: 2,
  },
  badgeText: { fontSize: 9, fontWeight: '900', color: '#fff' },

  progressTrack: { height: 2, backgroundColor: 'rgba(99,102,241,0.15)' },
  progressBar:   { height: 2 },
});

// Scanner modal styles
const scan = StyleSheet.create({
  overlay:  { ...StyleSheet.absoluteFillObject, backgroundColor: '#000' },
  vignette: { ...StyleSheet.absoluteFillObject },
  finder: {
    position: 'absolute', width: 250, height: 250,
    top: '50%', left: '50%', marginTop: -125, marginLeft: -125,
  },
  corner: { position: 'absolute', width: 32, height: 32, borderColor: '#818cf8' },
  cTL: { top: 0, left: 0,   borderTopWidth: 3, borderLeftWidth: 3,   borderTopLeftRadius: 4 },
  cTR: { top: 0, right: 0,  borderTopWidth: 3, borderRightWidth: 3,  borderTopRightRadius: 4 },
  cBL: { bottom: 0, left: 0,  borderBottomWidth: 3, borderLeftWidth: 3,  borderBottomLeftRadius: 4 },
  cBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 4 },
  scanLine: {
    position: 'absolute', top: '50%', left: 8, right: 8,
    height: 2, backgroundColor: 'rgba(129,140,248,0.8)', borderRadius: 1,
  },
  headerRow: {
    position: 'absolute', left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 20,
  },
  closeBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  footer:     { position: 'absolute', bottom: 80, left: 0, right: 0, alignItems: 'center' },
  footerPill: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingVertical: 10, paddingHorizontal: 22, borderRadius: 24,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  footerText: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '500' },

  permBox: {
    backgroundColor: '#1e1b4b', borderRadius: 28, padding: 32, margin: 24,
    alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  permIcon: {
    width: 72, height: 72, borderRadius: 22,
    backgroundColor: '#4f46e5',
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  permTitle:   { fontSize: 20, fontWeight: '800', color: '#fff', textAlign: 'center' },
  permBody:    { fontSize: 14, color: 'rgba(255,255,255,0.65)', textAlign: 'center', lineHeight: 20 },
  permBtn:     { backgroundColor: '#4f46e5', paddingVertical: 14, paddingHorizontal: 32, borderRadius: 16, marginTop: 4, width: '100%', alignItems: 'center' },
  permBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  cancelText:  { color: 'rgba(255,255,255,0.45)', fontSize: 14 },
});

// Error screen styles
const err = StyleSheet.create({
  wrap:     { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, backgroundColor: '#f8fafc', gap: 12 },
  iconBox:  { width: 80, height: 80, borderRadius: 24, backgroundColor: '#eef2ff', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  title:    { fontSize: 22, fontWeight: '800', color: '#0f172a' },
  body:     { fontSize: 15, color: '#64748b', textAlign: 'center', lineHeight: 22 },
  btn:      { borderRadius: 16, overflow: 'hidden', marginTop: 8 },
  btnInner: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14, paddingHorizontal: 28 },
  btnText:  { color: '#fff', fontSize: 15, fontWeight: '700' },
});
