/**
 * Main screen — full-screen WebView (Outlook taskpane interface)
 *
 * Auth is 100% owned by the native layer:
 *  • Native top bar contains: logo · title · [scan] [bell] [sign-out]
 *  • Sign-out shows a world-class confirmation bottom sheet
 *  • WebView never shows its own login/logout controls
 *  • On sign-out → native login screen appears immediately
 */
import { useRef, useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform,
  StatusBar, Modal, Animated, Easing, Image, ActivityIndicator,
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

// URL each role sees inside the WebView
const URLS = {
  staff:   `${API_URL}/outlook/taskpane`,  // STAFF → employee portal
  admin:   `${API_URL}`,                   // ADMIN/MANAGER → full main app dashboard
} as const;

// ─── View-drawn icons (zero font / zero asset dependency) ──────────────────

function ScanIcon({ color = '#fff', size = 20 }: { color?: string; size?: number }) {
  const t = Math.round(size * 0.12);
  const l = Math.round(size * 0.36);
  const bars: object[] = [
    { top: 0, left: 0, width: l, height: t },
    { top: 0, left: 0, width: t, height: l },
    { top: 0, right: 0, width: l, height: t },
    { top: 0, right: 0, width: t, height: l },
    { bottom: 0, left: 0, width: l, height: t },
    { bottom: 0, left: 0, width: t, height: l },
    { bottom: 0, right: 0, width: l, height: t },
    { bottom: 0, right: 0, width: t, height: l },
    { top: size / 2 - t / 2, left: size * 0.15, right: size * 0.15, height: t },
  ];
  return (
    <View style={{ width: size, height: size }}>
      {bars.map((s, i) => (
        <View key={i} style={[{ position: 'absolute', backgroundColor: color }, s as any]} />
      ))}
    </View>
  );
}

function BellIcon({ color = '#fff', size = 20 }: { color?: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center' }}>
      <View style={{ position: 'absolute', top: size * 0.14, left: size * 0.12, right: size * 0.12, height: size * 0.62, backgroundColor: color, borderRadius: size * 0.24 }} />
      <View style={{ position: 'absolute', top: 0, width: size * 0.14, height: size * 0.2, backgroundColor: color, borderRadius: 2, alignSelf: 'center' }} />
      <View style={{ position: 'absolute', bottom: size * 0.04, width: size * 0.3, height: size * 0.16, backgroundColor: color, borderRadius: size * 0.08, alignSelf: 'center' }} />
    </View>
  );
}

/** Sign-out icon: rectangle with arrow pointing right */
function SignOutIcon({ color = '#fff', size = 18 }: { color?: string; size?: number }) {
  const t = Math.round(size * 0.13); // thickness
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      {/* Door frame — left + top + bottom */}
      <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: t, backgroundColor: color, borderRadius: 1 }} />
      <View style={{ position: 'absolute', left: 0, right: size * 0.3, top: 0, height: t, backgroundColor: color, borderRadius: 1 }} />
      <View style={{ position: 'absolute', left: 0, right: size * 0.3, bottom: 0, height: t, backgroundColor: color, borderRadius: 1 }} />
      {/* Arrow shaft → */}
      <View style={{ position: 'absolute', right: 0, top: size / 2 - t / 2, left: size * 0.35, height: t, backgroundColor: color, borderRadius: 1 }} />
      {/* Arrow head > */}
      <View style={{ position: 'absolute', right: 0, top: size * 0.28, width: t, height: size * 0.25, backgroundColor: color, transform: [{ rotate: '45deg' }] }} />
      <View style={{ position: 'absolute', right: 0, bottom: size * 0.28, width: t, height: size * 0.25, backgroundColor: color, transform: [{ rotate: '-45deg' }] }} />
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
            <View style={scan.permIcon}><Text style={{ fontSize: 34 }}>📷</Text></View>
            <Text style={scan.permTitle}>Camera Access Required</Text>
            <Text style={scan.permBody}>AssetXAI needs camera access to scan barcodes, QR codes, and RFID tags.</Text>
            <TouchableOpacity style={scan.permBtn} onPress={requestPerm}><Text style={scan.permBtnText}>Grant Access</Text></TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={{ marginTop: 8 }}><Text style={scan.cancelText}>Cancel</Text></TouchableOpacity>
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
          style={StyleSheet.absoluteFill} facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr', 'code128', 'code39', 'ean13', 'ean8', 'datamatrix', 'pdf417'] }}
          onBarcodeScanned={result => {
            if (scannedRef.current) return;
            scannedRef.current = true;
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onScanned(result.data);
          }}
        />
        <View style={scan.vignette} pointerEvents="none" />
        <View style={scan.finder} pointerEvents="none">
          <View style={[scan.corner, scan.cTL]} /><View style={[scan.corner, scan.cTR]} />
          <View style={[scan.corner, scan.cBL]} /><View style={[scan.corner, scan.cBR]} />
          <View style={scan.scanLine} />
        </View>
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

// ── World-class Sign-Out Confirmation Sheet ───────────────────────────────
function SignOutSheet({
  visible, userEmail, onConfirm, onCancel,
}: {
  visible: boolean; userEmail: string; onConfirm: () => void; onCancel: () => void;
}) {
  const slideY  = useRef(new Animated.Value(400)).current;
  const overlayOp = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(overlayOp, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(slideY, { toValue: 0, tension: 70, friction: 11, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(overlayOp, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(slideY,    { toValue: 400, duration: 200, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  const initial = userEmail ? userEmail[0].toUpperCase() : 'U';

  return (
    <Modal visible transparent animationType="none" onRequestClose={onCancel}>
      {/* Overlay */}
      <Animated.View style={[so.overlay, { opacity: overlayOp }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onCancel} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View style={[so.sheet, { transform: [{ translateY: slideY }] }]}>
        {/* Handle */}
        <View style={so.handle} />

        {/* User avatar */}
        <View style={so.avatarWrap}>
          <LinearGradient colors={['#4f46e5', '#7c3aed']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={so.avatarGrad}>
            <Text style={so.avatarInitial}>{initial}</Text>
          </LinearGradient>
          <View style={so.avatarBadge}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e' }} />
          </View>
        </View>

        <Text style={so.greeting}>Signed in as</Text>
        <Text style={so.email} numberOfLines={1}>{userEmail || 'Your account'}</Text>

        {/* Divider */}
        <View style={so.divider} />

        <Text style={so.confirmTitle}>Sign out of AssetXAI?</Text>
        <Text style={so.confirmBody}>
          You'll need to enter your credentials again to access the app.
        </Text>

        {/* Sign out button */}
        <TouchableOpacity
          style={so.signOutBtn}
          onPress={() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            onConfirm();
          }}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={['#ef4444', '#dc2626']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={so.signOutGrad}
          >
            <SignOutIcon color="#fff" size={18} />
            <Text style={so.signOutText}>Sign Out</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Cancel button */}
        <TouchableOpacity style={so.cancelBtn} onPress={onCancel} activeOpacity={0.7}>
          <Text style={so.cancelText}>Cancel</Text>
        </TouchableOpacity>

        {/* Safe area spacer */}
        <View style={{ height: Platform.OS === 'ios' ? 20 : 8 }} />
      </Animated.View>
    </Modal>
  );
}

// ── Network error ─────────────────────────────────────────────────────────
function NetworkError({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={err.wrap}>
      <View style={err.iconBox}><Text style={{ fontSize: 38 }}>🌐</Text></View>
      <Text style={err.title}>No Connection</Text>
      <Text style={err.body}>Check your internet and try again.</Text>
      <TouchableOpacity style={err.btn} onPress={onRetry} activeOpacity={0.85}>
        <LinearGradient colors={['#4f46e5', '#7c3aed']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={err.btnInner}>
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

  const [session,       setSession]      = useState<any>(null);
  const [bridgeReady,   setBridgeReady]  = useState(false);
  const [loadProgress,  setLoadProgress] = useState(0);
  const [networkError,  setNetworkError] = useState(false);
  const [canGoBack,     setCanGoBack]    = useState(false);
  const [scanVisible,   setScanVisible]  = useState(false);
  const [scanCallback,  setScanCallback] = useState<string | null>(null);
  const [pushToken,     setPushToken]    = useState('');
  const [unreadCount,   setUnreadCount]  = useState(0);
  const [webviewKilled, setWebviewKilled] = useState(false);
  const [showSignOut,   setShowSignOut]  = useState(false);
  const [signingOut,    setSigningOut]   = useState(false);
  // Role gate — 'checking' → loading; 'staff' → taskpane; 'admin' → full app
  const [roleStatus,  setRoleStatus]  = useState<'checking' | 'staff' | 'admin'>('checking');
  const [webViewUrl,  setWebViewUrl]  = useState(URLS.staff);
  const webKeyRef    = useRef(0);
  const [webKey,     setWebKey]         = useState(0);
  const prevUserIdRef = useRef<string | null>(null);

  // ── Auth state ──────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      prevUserIdRef.current = s?.user?.id ?? null;
      setBridgeReady(true);
      if (s) {
        webKeyRef.current += 1;
        setWebKey(webKeyRef.current);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      const prevId = prevUserIdRef.current;
      const nextId = s?.user?.id ?? null;
      setSession(s);

      if (!s) {
        setWebviewKilled(true);
        router.replace('/(auth)/login' as any);
      } else if (prevId !== nextId) {
        // Different user logged in — reset everything and re-check role
        setWebviewKilled(false);
        setSigningOut(false);
        setRoleStatus('checking');
        setWebViewUrl(URLS.staff); // safe default until role is confirmed
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

  // ── Role gate: check profile BEFORE showing any content ──────────────────
  //
  //  HANDHELD         → native inventory screen (no WebView)
  //  ADMIN / MANAGER  → full main app dashboard (assetxai.live)
  //  STAFF            → employee taskpane  (assetxai.live/outlook/taskpane)
  //
  useEffect(() => {
    if (!session?.user?.id) return;

    let cancelled = false;
    setRoleStatus('checking');

    const checkRole = async (attempt = 0) => {
      try {
        const profile = await getMyProfile();
        if (cancelled) return;

        const role = profile?.role as string | undefined;

        if (role === 'HANDHELD') {
          router.replace('/(tabs)/inventory' as any);
        } else if (role === 'ADMIN' || role === 'MANAGER') {
          setWebViewUrl(URLS.admin);
          setRoleStatus('admin');
        } else {
          // STAFF or unknown → employee taskpane
          setWebViewUrl(URLS.staff);
          setRoleStatus('staff');
        }
      } catch {
        if (cancelled) return;
        if (attempt < 3) {
          setTimeout(() => checkRole(attempt + 1), 800 * (attempt + 1));
        } else {
          // Fail-open: default to staff view
          setWebViewUrl(URLS.staff);
          setRoleStatus('staff');
        }
      }
    };

    checkRole();
    return () => { cancelled = true; };
  }, [session?.user?.id]);

  // ── Push token + unread ─────────────────────────────────────────────────
  useEffect(() => {
    Notifications.getExpoPushTokenAsync().then(t => setPushToken(t.data)).catch(() => {});
    const sub = Notifications.addNotificationReceivedListener(() => setUnreadCount(n => n + 1));
    return () => Notifications.removeNotificationSubscription(sub);
  }, []);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(() => {
      setUnreadCount(0);
      router.push('/(tabs)/alerts' as any);
    });
    return () => Notifications.removeNotificationSubscription(sub);
  }, []);

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
            title: msg.title || 'AssetXAI', body: msg.body || '',
            data: msg.data || {}, sound: true,
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
        // WebView bridge signout (fallback — normally the native button handles this)
        setWebviewKilled(true);
        router.replace('/(auth)/login' as any);
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

  // ── Native sign-out handler ──────────────────────────────────────────────
  const handleNativeSignOut = useCallback(async () => {
    setShowSignOut(false);
    setSigningOut(true);
    // Immediately kill WebView so nothing web-side renders
    setWebviewKilled(true);
    await supabase.auth.signOut();
    // onAuthStateChange will fire → router.replace('/(auth)/login')
  }, []);

  const retry = () => {
    setNetworkError(false);
    webKeyRef.current += 1;
    setWebKey(webKeyRef.current);
  };

  const topPad = insets.top + (Platform.OS === 'android' ? 28 : 0);
  const userEmail = session?.user?.email || '';

  return (
    <View style={{ flex: 1, backgroundColor: '#1e1b4b' }}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* ── Native top bar ────────────────────────────────────────────── */}
      <LinearGradient
        colors={['#1e1b4b', '#3730a3']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={[styles.bar, { paddingTop: topPad, paddingBottom: 10 }]}
      >
        {/* Left: back + logo + title */}
        <View style={styles.barLeft}>
          {canGoBack && (
            <TouchableOpacity style={styles.iconBtn} onPress={() => webRef.current?.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <View style={{ width: 18, height: 18, justifyContent: 'center', alignItems: 'center' }}>
                <View style={{ width: 9, height: 9, borderLeftWidth: 2.5, borderBottomWidth: 2.5, borderColor: '#fff', transform: [{ rotate: '45deg' }], marginLeft: 4 }} />
              </View>
            </TouchableOpacity>
          )}
          <Image source={require('../../assets/icon.png')} style={styles.logoImg} resizeMode="contain" />
          <Text style={styles.barTitle}>AssetXAI</Text>
        </View>

        {/* Right: scan · bell · sign-out */}
        <View style={styles.barRight}>

          {/* Scan */}
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => { setScanCallback(null); setScanVisible(true); }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <ScanIcon color="#fff" size={20} />
          </TouchableOpacity>

          {/* Bell */}
          <TouchableOpacity
            style={[styles.iconBtn, unreadCount > 0 && styles.iconBtnAmber]}
            onPress={() => { setUnreadCount(0); router.push('/(tabs)/alerts' as any); }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <BellIcon color={unreadCount > 0 ? '#fbbf24' : '#fff'} size={20} />
            <Badge count={unreadCount} />
          </TouchableOpacity>

          {/* ── Sign-out (native — the ONLY place to log out) ── */}
          <TouchableOpacity
            style={[styles.iconBtn, styles.iconBtnRed]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowSignOut(true);
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
            disabled={signingOut}
          >
            <SignOutIcon color={signingOut ? 'rgba(255,255,255,0.4)' : '#fff'} size={18} />
          </TouchableOpacity>

        </View>
      </LinearGradient>

      {/* ── Progress bar ─────────────────────────────────────────────── */}
      {loadProgress > 0 && loadProgress < 1 && (
        <View style={styles.progressTrack}>
          <LinearGradient
            colors={['#818cf8', '#4f46e5']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={[styles.progressBar, { width: `${loadProgress * 100}%` as any }]}
          />
        </View>
      )}

      {/* ── Content ──────────────────────────────────────────────────── */}
      {webviewKilled ? (
        /* Blank while navigating to login */
        <View style={{ flex: 1, backgroundColor: '#1e1b4b' }} />
      ) : roleStatus === 'checking' ? (
        /* Checking role — nothing renders until we know where to send the user */
        <View style={styles.roleGate}>
          <LinearGradient
            colors={['#060413', '#1e1b4b', '#2d2470']}
            style={StyleSheet.absoluteFill}
          />
          {/* Decorative glow */}
          <View style={styles.roleGateGlow} />
          <View style={styles.roleGateCard}>
            <View style={styles.roleGateIconWrap}>
              <LinearGradient colors={['#4f46e5', '#7c3aed']} style={styles.roleGateIconGrad}>
                <Image source={require('../../assets/icon.png')} style={{ width: 40, height: 40, borderRadius: 10 }} resizeMode="contain" />
              </LinearGradient>
            </View>
            <ActivityIndicator size="large" color="#818cf8" style={{ marginTop: 4 }} />
            <Text style={styles.roleGateTitle}>Setting up your workspace</Text>
            <Text style={styles.roleGateSubtitle}>Checking account permissions…</Text>
          </View>
        </View>
      ) : networkError ? (
        <NetworkError onRetry={retry} />
      ) : (
        <WebView
          key={webKey}
          ref={webRef}
          source={{ uri: webViewUrl }}
          style={{ flex: 1, backgroundColor: '#f8fafc' }}
          injectedJavaScriptBeforeContentLoaded={injectedScript}
          javaScriptEnabled domStorageEnabled
          allowsBackForwardNavigationGestures sharedCookiesEnabled
          cacheEnabled cacheMode="LOAD_CACHE_ELSE_NETWORK"
          allowsInlineMediaPlayback mediaPlaybackRequiresUserAction={false}
          allowsFullscreenVideo mixedContentMode="compatibility"
          originWhitelist={['https://*', 'http://*']}
          onLoadProgress={({ nativeEvent }) => setLoadProgress(nativeEvent.progress)}
          onLoadEnd={() => setLoadProgress(0)}
          onNavigationStateChange={state => setCanGoBack(state.canGoBack)}
          onError={() => setNetworkError(true)}
          onHttpError={({ nativeEvent }) => { if (nativeEvent.statusCode >= 500) setNetworkError(true); }}
          onMessage={handleMessage}
          applicationNameForUserAgent="AssetXAI-Native/2.2"
          decelerationRate="normal" scrollEnabled bounces
          pullToRefreshEnabled={Platform.OS === 'ios'}
        />
      )}

      {/* ── Scanner modal ─────────────────────────────────────────── */}
      <ScannerModal
        visible={scanVisible}
        onScanned={handleScanResult}
        onClose={() => { setScanVisible(false); setScanCallback(null); }}
      />

      {/* ── World-class sign-out confirmation sheet ────────────────── */}
      <SignOutSheet
        visible={showSignOut}
        userEmail={userEmail}
        onConfirm={handleNativeSignOut}
        onCancel={() => setShowSignOut(false)}
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
  barRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  logoImg: {
    width: 32, height: 32, borderRadius: 9,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  barTitle: { fontSize: 16, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },

  iconBtn: {
    width: 38, height: 38, borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
    position: 'relative',
  },
  iconBtnAmber: {
    backgroundColor: 'rgba(251,191,36,0.2)',
    borderColor: 'rgba(251,191,36,0.45)',
  },
  iconBtnRed: {
    backgroundColor: 'rgba(239,68,68,0.18)',
    borderColor: 'rgba(239,68,68,0.4)',
  },

  badge: {
    position: 'absolute', top: -5, right: -5,
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: '#ef4444',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 2, borderColor: '#1e1b4b', zIndex: 2,
  },
  badgeText: { fontSize: 9, fontWeight: '900', color: '#fff' },

  progressTrack: { height: 2, backgroundColor: 'rgba(99,102,241,0.15)' },
  progressBar:   { height: 2 },

  roleGate: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
  },
  roleGateGlow: {
    position: 'absolute', alignSelf: 'center', top: '30%',
    width: 260, height: 260, borderRadius: 130,
    backgroundColor: 'rgba(99,102,241,0.12)',
    shadowColor: '#6366f1', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8, shadowRadius: 60,
  },
  roleGateCard: {
    alignItems: 'center', gap: 16, padding: 40,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 32,
    borderWidth: 1, borderColor: 'rgba(165,180,252,0.15)',
    marginHorizontal: 32,
    shadowColor: '#4f46e5', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3, shadowRadius: 20,
  },
  roleGateIconWrap: {
    shadowColor: '#4f46e5', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5, shadowRadius: 14, elevation: 10,
  },
  roleGateIconGrad: {
    width: 80, height: 80, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
  },
  roleGateTitle: {
    fontSize: 17, fontWeight: '800', color: '#e0e7ff',
    textAlign: 'center', letterSpacing: -0.3,
  },
  roleGateSubtitle: {
    fontSize: 13, color: 'rgba(165,180,252,0.6)',
    textAlign: 'center', marginTop: -6,
  },
});

// Sign-out sheet styles
const so = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 24, paddingTop: 12,
    alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.18, shadowRadius: 24, elevation: 30,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#e2e8f0', marginBottom: 24,
  },
  avatarWrap: { marginBottom: 12, position: 'relative' },
  avatarGrad: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#4f46e5', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 10, elevation: 8,
  },
  avatarInitial: { fontSize: 30, fontWeight: '800', color: '#fff' },
  avatarBadge: {
    position: 'absolute', bottom: 2, right: 2,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  greeting: { fontSize: 12, color: '#94a3b8', fontWeight: '500', marginBottom: 2 },
  email:    { fontSize: 15, color: '#0f172a', fontWeight: '700', marginBottom: 20, maxWidth: 280 },
  divider:  { width: '100%', height: 1, backgroundColor: '#f1f5f9', marginBottom: 20 },
  confirmTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a', marginBottom: 6, textAlign: 'center' },
  confirmBody:  { fontSize: 13, color: '#64748b', textAlign: 'center', lineHeight: 18, marginBottom: 24, maxWidth: 260 },
  signOutBtn:  { width: '100%', borderRadius: 16, overflow: 'hidden', marginBottom: 10 },
  signOutGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16 },
  signOutText: { fontSize: 16, fontWeight: '800', color: '#fff', letterSpacing: 0.2 },
  cancelBtn:   { width: '100%', paddingVertical: 14, alignItems: 'center', borderRadius: 16, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },
  cancelText:  { fontSize: 15, fontWeight: '600', color: '#64748b' },
});

// Scanner styles
const scan = StyleSheet.create({
  overlay:  { ...StyleSheet.absoluteFillObject, backgroundColor: '#000' },
  vignette: { ...StyleSheet.absoluteFillObject },
  finder: { position: 'absolute', width: 250, height: 250, top: '50%', left: '50%', marginTop: -125, marginLeft: -125 },
  corner: { position: 'absolute', width: 32, height: 32, borderColor: '#818cf8' },
  cTL: { top: 0, left: 0,   borderTopWidth: 3, borderLeftWidth: 3,   borderTopLeftRadius: 4 },
  cTR: { top: 0, right: 0,  borderTopWidth: 3, borderRightWidth: 3,  borderTopRightRadius: 4 },
  cBL: { bottom: 0, left: 0,  borderBottomWidth: 3, borderLeftWidth: 3,  borderBottomLeftRadius: 4 },
  cBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 4 },
  scanLine: { position: 'absolute', top: '50%', left: 8, right: 8, height: 2, backgroundColor: 'rgba(129,140,248,0.8)', borderRadius: 1 },
  headerRow: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 20 },
  closeBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  footer: { position: 'absolute', bottom: 80, left: 0, right: 0, alignItems: 'center' },
  footerPill: { backgroundColor: 'rgba(0,0,0,0.55)', paddingVertical: 10, paddingHorizontal: 22, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  footerText: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '500' },
  permBox: { backgroundColor: '#1e1b4b', borderRadius: 28, padding: 32, margin: 24, alignItems: 'center', gap: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  permIcon: { width: 72, height: 72, borderRadius: 22, backgroundColor: '#4f46e5', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  permTitle:   { fontSize: 20, fontWeight: '800', color: '#fff', textAlign: 'center' },
  permBody:    { fontSize: 14, color: 'rgba(255,255,255,0.65)', textAlign: 'center', lineHeight: 20 },
  permBtn:     { backgroundColor: '#4f46e5', paddingVertical: 14, paddingHorizontal: 32, borderRadius: 16, marginTop: 4, width: '100%', alignItems: 'center' },
  permBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  cancelText:  { color: 'rgba(255,255,255,0.45)', fontSize: 14 },
});

const err = StyleSheet.create({
  wrap:     { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, backgroundColor: '#f8fafc', gap: 12 },
  iconBox:  { width: 80, height: 80, borderRadius: 24, backgroundColor: '#eef2ff', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  title:    { fontSize: 22, fontWeight: '800', color: '#0f172a' },
  body:     { fontSize: 15, color: '#64748b', textAlign: 'center', lineHeight: 22 },
  btn:      { borderRadius: 16, overflow: 'hidden', marginTop: 8 },
  btnInner: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14, paddingHorizontal: 28 },
  btnText:  { color: '#fff', fontSize: 15, fontWeight: '700' },
});
