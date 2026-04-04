/**
 * Root layout — handles:
 *  • Auth-based route guard (redirect to /login when signed out)
 *  • World-class animated splash screen
 *  • Push notification handler (foreground + background)
 *  • Font pre-loading
 */
import { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Animated, Easing, Platform,
} from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { AuthProvider, useAuth } from '@/hooks/useAuth';

// Keep native splash visible while we prepare
SplashScreen.preventAutoHideAsync();

// ── Push notification handler: runs immediately on module load ────────────
// This ensures foreground notifications show system banners on both platforms
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert:  true,
    shouldPlaySound:  true,
    shouldSetBadge:   true,
    shouldShowBanner: true,
    shouldShowList:   true,
  }),
});

// ── Android notification channel ─────────────────────────────────────────
if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync('assetxai', {
    name: 'AssetXAI Alerts',
    description: 'Asset management notifications and alerts',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#7c3aed',
    sound: 'default',
    enableVibrate: true,
    showBadge: true,
  }).catch(() => {});

  Notifications.setNotificationChannelAsync('default', {
    name: 'Default',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#7c3aed',
  }).catch(() => {});
}

// ── Floating particle ─────────────────────────────────────────────────────
function Particle({
  delay, x, size, opacity,
}: {
  delay: number; x: number; size: number; opacity: number;
}) {
  const y  = useRef(new Animated.Value(0)).current;
  const op = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(y, {
            toValue: -130, duration: 3400,
            easing: Easing.out(Easing.quad), useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.timing(op, { toValue: opacity, duration: 700, useNativeDriver: true }),
            Animated.delay(1900),
            Animated.timing(op, { toValue: 0, duration: 800, useNativeDriver: true }),
          ]),
        ]),
        Animated.parallel([
          Animated.timing(y,  { toValue: 0, duration: 0, useNativeDriver: true }),
          Animated.timing(op, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <Animated.View
      style={{
        position: 'absolute', bottom: 90, left: x,
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: 'rgba(165,180,252,0.9)',
        opacity: op, transform: [{ translateY: y }],
      }}
    />
  );
}

// ── World-class animated splash ───────────────────────────────────────────
function AppSplash({ onDone }: { onDone: () => void }) {
  const logoScale  = useRef(new Animated.Value(0)).current;
  const logoOp     = useRef(new Animated.Value(0)).current;
  const logoRotate = useRef(new Animated.Value(0)).current;
  const glowScale  = useRef(new Animated.Value(0.85)).current;
  const glowOp     = useRef(new Animated.Value(0)).current;
  const titleY     = useRef(new Animated.Value(28)).current;
  const titleOp    = useRef(new Animated.Value(0)).current;
  const taglineOp  = useRef(new Animated.Value(0)).current;
  const progressW  = useRef(new Animated.Value(0)).current;
  const progressOp = useRef(new Animated.Value(0)).current;
  const screenOp   = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowScale, {
          toValue: 1.22, duration: 1500,
          easing: Easing.inOut(Easing.sin), useNativeDriver: true,
        }),
        Animated.timing(glowScale, {
          toValue: 0.92, duration: 1500,
          easing: Easing.inOut(Easing.sin), useNativeDriver: true,
        }),
      ])
    );

    Animated.sequence([
      // Phase 1 — Logo bounces in
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1, tension: 55, friction: 6, useNativeDriver: true,
        }),
        Animated.timing(logoOp, { toValue: 1, duration: 380, useNativeDriver: true }),
        Animated.timing(logoRotate, {
          toValue: 1, duration: 580,
          easing: Easing.out(Easing.back(1.6)), useNativeDriver: true,
        }),
      ]),

      // Phase 2 — Glow rings + brand name
      Animated.parallel([
        Animated.timing(glowOp,  { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.timing(titleOp, { toValue: 1, duration: 320, useNativeDriver: true }),
        Animated.timing(titleY,  {
          toValue: 0, duration: 320,
          easing: Easing.out(Easing.quad), useNativeDriver: true,
        }),
      ]),

      // Phase 3 — Tagline
      Animated.timing(taglineOp, { toValue: 1, duration: 260, useNativeDriver: true }),

      // Phase 4 — Progress bar sweeps
      Animated.timing(progressOp, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.timing(progressW, {
        toValue: 1, duration: 1000,
        easing: Easing.inOut(Easing.quad), useNativeDriver: false,
      }),

      Animated.delay(300),

      // Phase 5 — Fade out
      Animated.timing(screenOp, {
        toValue: 0, duration: 400,
        easing: Easing.in(Easing.quad), useNativeDriver: true,
      }),
    ]).start(() => onDone());

    setTimeout(() => glowLoop.start(), 480);
    return () => glowLoop.stop();
  }, []);

  const spin = logoRotate.interpolate({
    inputRange: [0, 1], outputRange: ['-18deg', '0deg'],
  });

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, { opacity: screenOp }]}
      pointerEvents="none"
    >
      {/* Deep space background */}
      <LinearGradient
        colors={['#060413', '#0f0c2e', '#1e1b4b', '#2d2470', '#3730a3']}
        locations={[0, 0.2, 0.5, 0.75, 1]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Central radial glow */}
      <View style={sp.bgGlow} />

      {/* Floating particles */}
      <Particle delay={0}   x={30}  size={5}  opacity={0.65} />
      <Particle delay={350} x={75}  size={3}  opacity={0.45} />
      <Particle delay={700} x={145} size={7}  opacity={0.55} />
      <Particle delay={150} x={210} size={4}  opacity={0.5} />
      <Particle delay={550} x={268} size={6}  opacity={0.6} />
      <Particle delay={900} x={315} size={3}  opacity={0.4} />
      <Particle delay={250} x={355} size={5}  opacity={0.5} />

      {/* Main content */}
      <View style={sp.center}>
        {/* Pulsing outer ring */}
        <Animated.View
          style={[sp.outerRing, { opacity: glowOp, transform: [{ scale: glowScale }] }]}
        />
        {/* Static middle ring */}
        <Animated.View style={[sp.midRing, { opacity: glowOp }]} />

        {/* Logo box */}
        <Animated.View
          style={[
            sp.logoWrap,
            { opacity: logoOp, transform: [{ scale: logoScale }, { rotate: spin }] },
          ]}
        >
          <LinearGradient
            colors={['rgba(255,255,255,0.25)', 'rgba(255,255,255,0.07)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={sp.logoBox}
          >
            <View style={sp.logoInnerGlow} />
            <Ionicons
              name="cube"
              size={60}
              color="#ffffff"
              allowFontScaling={false}
            />
            {/* Shine */}
            <LinearGradient
              colors={['rgba(255,255,255,0.28)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[StyleSheet.absoluteFill, { borderRadius: 34 }]}
            />
          </LinearGradient>
        </Animated.View>

        {/* Brand name */}
        <Animated.Text
          style={[sp.brandName, { opacity: titleOp, transform: [{ translateY: titleY }] }]}
        >
          AssetXAI
        </Animated.Text>

        {/* Tagline */}
        <Animated.Text style={[sp.tagline, { opacity: taglineOp }]}>
          Enterprise Asset Intelligence
        </Animated.Text>

        {/* Dot row */}
        <Animated.View style={[sp.dotsRow, { opacity: taglineOp }]}>
          {[0, 1, 2, 3, 4].map(i => (
            <View key={i} style={[sp.dot, i === 2 && sp.dotLarge]} />
          ))}
        </Animated.View>

        {/* Progress bar */}
        <Animated.View style={[sp.progressWrap, { opacity: progressOp }]}>
          <View style={sp.progressTrack}>
            <Animated.View
              style={[
                sp.progressFill,
                { width: progressW.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
              ]}
            />
          </View>
          <Text style={sp.progressLabel}>Loading…</Text>
        </Animated.View>
      </View>

      {/* Footer */}
      <View style={sp.footer}>
        <View style={sp.footerLine} />
        <Text style={sp.footerText}>AssetXAI · v2.2</Text>
        <View style={sp.footerLine} />
      </View>
    </Animated.View>
  );
}

// ── Auth-based route guard ────────────────────────────────────────────────
function AuthGuard() {
  const { user, initializing } = useAuth();
  const segments = useSegments();
  const router   = useRouter();

  useEffect(() => {
    if (initializing) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!user && !inAuthGroup) {
      // Signed out → force to login
      router.replace('/(auth)/login' as any);
    } else if (user && inAuthGroup) {
      // Signed in → go to app
      router.replace('/(tabs)' as any);
    }
  }, [user, initializing]);

  return null;
}

// ── Root layout nav ───────────────────────────────────────────────────────
function RootLayoutNav() {
  const { initializing } = useAuth();
  const [fontsLoaded, fontError] = useFonts({ ...Ionicons.font });
  const [nativeSplashHidden, setNativeSplashHidden] = useState(false);
  const [showCustomSplash,   setShowCustomSplash]   = useState(true);

  // Hide native splash once fonts/auth resolve (max 3s timeout)
  useEffect(() => {
    const ready = (!initializing && (fontsLoaded || !!fontError));
    if (!ready) return;

    const hide = () => {
      SplashScreen.hideAsync()
        .catch(() => {})
        .finally(() => setNativeSplashHidden(true));
    };

    // Small delay to let JS thread paint the first frame
    const t = setTimeout(hide, 100);
    return () => clearTimeout(t);
  }, [initializing, fontsLoaded, fontError]);

  // Safety valve: never show native splash > 4s
  useEffect(() => {
    const t = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
      setNativeSplashHidden(true);
    }, 4000);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <AuthGuard />
      <Stack screenOptions={{ headerShown: false }} />
      {/* Custom splash overlays everything until animation finishes */}
      {nativeSplashHidden && showCustomSplash && (
        <AppSplash onDone={() => setShowCustomSplash(false)} />
      )}
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}

// ── Splash styles ─────────────────────────────────────────────────────────
const sp = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 100,
  },
  bgGlow: {
    position: 'absolute',
    top: '18%',
    alignSelf: 'center',
    width: 340,
    height: 340,
    borderRadius: 170,
    backgroundColor: 'rgba(99,102,241,0.14)',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 100,
    elevation: 0,
  },
  outerRing: {
    position: 'absolute',
    width: 210, height: 210, borderRadius: 105,
    borderWidth: 1,
    borderColor: 'rgba(165,180,252,0.18)',
    backgroundColor: 'rgba(99,102,241,0.05)',
  },
  midRing: {
    position: 'absolute',
    width: 162, height: 162, borderRadius: 81,
    borderWidth: 1.5,
    borderColor: 'rgba(165,180,252,0.28)',
  },
  logoWrap: {
    marginBottom: 34,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.65,
    shadowRadius: 30,
    elevation: 22,
  },
  logoBox: {
    width: 120, height: 120,
    borderRadius: 36,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.22)',
    overflow: 'hidden',
  },
  logoInnerGlow: {
    position: 'absolute',
    top: -20, left: -20, right: -20, bottom: -20,
    backgroundColor: 'rgba(165,180,252,0.12)',
    borderRadius: 55,
  },
  brandName: {
    fontSize: 46,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -1.8,
    marginBottom: 10,
    textShadowColor: 'rgba(99,102,241,0.7)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 18,
  },
  tagline: {
    fontSize: 13,
    color: 'rgba(199,210,254,0.75)',
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 28,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 52,
  },
  dot: {
    width: 5, height: 5, borderRadius: 2.5,
    backgroundColor: 'rgba(165,180,252,0.4)',
  },
  dotLarge: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: 'rgba(165,180,252,0.85)',
  },
  progressWrap: {
    alignItems: 'center',
    gap: 10,
    width: 200,
  },
  progressTrack: {
    width: '100%',
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: '#818cf8',
    shadowColor: '#818cf8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
  },
  progressLabel: {
    fontSize: 11,
    color: 'rgba(165,180,252,0.5)',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  footer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 54 : 38,
    left: 0, right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  footerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(165,180,252,0.18)',
  },
  footerText: {
    fontSize: 11,
    color: 'rgba(165,180,252,0.35)',
    fontWeight: '500',
    letterSpacing: 0.3,
  },
});
