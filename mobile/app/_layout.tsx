import { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Platform, Image } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { AuthProvider, useAuth } from '@/hooks/useAuth';

SplashScreen.preventAutoHideAsync();

// ── Floating particle ─────────────────────────────────────────────────────
function Particle({ delay, x, size, opacity }: { delay: number; x: number; size: number; opacity: number }) {
  const y   = useRef(new Animated.Value(0)).current;
  const op  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(y,  { toValue: -120, duration: 3200, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.sequence([
            Animated.timing(op, { toValue: opacity, duration: 600, useNativeDriver: true }),
            Animated.delay(1800),
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
        position: 'absolute', bottom: 80, left: x,
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: 'rgba(165,180,252,0.9)',
        opacity: op, transform: [{ translateY: y }],
      }}
    />
  );
}

// ── World-class animated splash ───────────────────────────────────────────
function AppSplash({ onDone }: { onDone: () => void }) {
  // Logo animations
  const logoScale   = useRef(new Animated.Value(0)).current;
  const logoOp      = useRef(new Animated.Value(0)).current;
  const logoRotate  = useRef(new Animated.Value(0)).current;
  // Glow ring pulse
  const glowScale   = useRef(new Animated.Value(0.8)).current;
  const glowOp      = useRef(new Animated.Value(0)).current;
  // Text
  const titleY      = useRef(new Animated.Value(30)).current;
  const titleOp     = useRef(new Animated.Value(0)).current;
  const taglineOp   = useRef(new Animated.Value(0)).current;
  // Progress bar
  const progressW   = useRef(new Animated.Value(0)).current;
  const progressOp  = useRef(new Animated.Value(0)).current;
  // Screen fade out
  const screenOp    = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Glow pulse loop
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowScale, { toValue: 1.18, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(glowScale, { toValue: 0.95, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );

    Animated.sequence([
      // Phase 1: Logo appears with spring bounce
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1, tension: 60, friction: 7, useNativeDriver: true,
        }),
        Animated.timing(logoOp, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(logoRotate, { toValue: 1, duration: 600, easing: Easing.out(Easing.back(1.5)), useNativeDriver: true }),
      ]),

      // Phase 2: Glow + text reveal
      Animated.parallel([
        Animated.timing(glowOp,   { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(titleOp,  { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(titleY,   { toValue: 0, duration: 350, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]),

      // Phase 3: Tagline
      Animated.timing(taglineOp, { toValue: 1, duration: 280, useNativeDriver: true }),

      // Phase 4: Progress bar
      Animated.timing(progressOp, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(progressW,  { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),

      Animated.delay(280),

      // Phase 5: Elegant fade out
      Animated.parallel([
        Animated.timing(screenOp, { toValue: 0, duration: 420, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]),
    ]).start(() => onDone());

    // Start glow loop after logo appears
    setTimeout(() => glowLoop.start(), 500);
    return () => glowLoop.stop();
  }, []);

  const spin = logoRotate.interpolate({ inputRange: [0, 1], outputRange: ['-15deg', '0deg'] });

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: screenOp }]} pointerEvents="none">
      {/* Background gradient */}
      <LinearGradient
        colors={['#0f0c2e', '#1e1b4b', '#2d2470', '#3730a3']}
        locations={[0, 0.35, 0.7, 1]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Background radial glow */}
      <View style={sp.bgGlow} />

      {/* Floating particles */}
      <Particle delay={0}    x={40}  size={6}  opacity={0.7} />
      <Particle delay={400}  x={80}  size={4}  opacity={0.5} />
      <Particle delay={800}  x={160} size={8}  opacity={0.6} />
      <Particle delay={200}  x={220} size={5}  opacity={0.5} />
      <Particle delay={600}  x={280} size={6}  opacity={0.65} />
      <Particle delay={100}  x={320} size={4}  opacity={0.4} />

      {/* Main content */}
      <View style={sp.center}>
        {/* Outer glow ring */}
        <Animated.View style={[sp.outerRing, { opacity: glowOp, transform: [{ scale: glowScale }] }]} />

        {/* Middle ring */}
        <Animated.View style={[sp.midRing, { opacity: glowOp }]} />

        {/* Logo container */}
        <Animated.View style={[sp.logoWrap, { opacity: logoOp, transform: [{ scale: logoScale }, { rotate: spin }] }]}>
          <LinearGradient
            colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0.06)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={sp.logoBox}
          >
            {/* Inner glow */}
            <View style={sp.logoInnerGlow} />
            {/* Icon */}
            <Ionicons name="cube" size={58} color="#ffffff" allowFontScaling={false} />
            {/* Shine overlay */}
            <LinearGradient
              colors={['rgba(255,255,255,0.25)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[StyleSheet.absoluteFill, { borderRadius: 34 }]}
            />
          </LinearGradient>
        </Animated.View>

        {/* Brand name */}
        <Animated.Text style={[sp.brandName, { opacity: titleOp, transform: [{ translateY: titleY }] }]}>
          AssetXAI
        </Animated.Text>

        {/* Tagline */}
        <Animated.Text style={[sp.tagline, { opacity: taglineOp }]}>
          Enterprise Asset Intelligence
        </Animated.Text>

        {/* Decorative dots */}
        <Animated.View style={[sp.dotsRow, { opacity: taglineOp }]}>
          {[0, 1, 2, 3, 4].map(i => (
            <View key={i} style={[sp.dot, i === 2 && sp.dotLarge]} />
          ))}
        </Animated.View>

        {/* Progress bar */}
        <Animated.View style={[sp.progressWrap, { opacity: progressOp }]}>
          <Animated.View style={[sp.progressTrack]}>
            <Animated.View
              style={[sp.progressFill, {
                width: progressW.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
              }]}
            />
          </Animated.View>
          <Text style={sp.progressLabel}>Loading…</Text>
        </Animated.View>
      </View>

      {/* Bottom branding */}
      <View style={sp.footer}>
        <View style={sp.footerLine} />
        <Text style={sp.footerText}>Powered by AssetXAI · v2.2</Text>
        <View style={sp.footerLine} />
      </View>
    </Animated.View>
  );
}

// ── Root navigation ───────────────────────────────────────────────────────
function RootLayoutNav() {
  const { initializing, user } = useAuth();
  const [fontsLoaded] = useFonts({ ...Ionicons.font });
  const [nativeSplashDone, setNativeSplashDone] = useState(false);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    if (!initializing && fontsLoaded) {
      SplashScreen.hideAsync()
        .then(() => setNativeSplashDone(true))
        .catch(() => setNativeSplashDone(true));
    }
  }, [initializing, fontsLoaded]);

  useEffect(() => {
    if (!user) return;
    import('@/lib/push')
      .then(({ registerForPushNotificationsAsync }) => {
        registerForPushNotificationsAsync().catch(() => {});
      })
      .catch(() => {});
  }, [user?.id]);

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
      {nativeSplashDone && showSplash && (
        <AppSplash onDone={() => setShowSplash(false)} />
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
    paddingBottom: 80,
  },

  bgGlow: {
    position: 'absolute',
    top: '20%',
    alignSelf: 'center',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(99,102,241,0.18)',
    // Simulated radial glow via shadow
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 80,
    elevation: 0,
  },

  outerRing: {
    position: 'absolute',
    width: 200, height: 200, borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(165,180,252,0.2)',
    backgroundColor: 'rgba(99,102,241,0.06)',
  },
  midRing: {
    position: 'absolute',
    width: 155, height: 155, borderRadius: 78,
    borderWidth: 1.5,
    borderColor: 'rgba(165,180,252,0.3)',
  },

  logoWrap: {
    marginBottom: 32,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.6,
    shadowRadius: 28,
    elevation: 20,
  },
  logoBox: {
    width: 116, height: 116,
    borderRadius: 34,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.22)',
    overflow: 'hidden',
  },
  logoInnerGlow: {
    position: 'absolute',
    top: -20, left: -20, right: -20, bottom: -20,
    backgroundColor: 'rgba(165,180,252,0.15)',
    borderRadius: 50,
  },

  brandName: {
    fontSize: 44,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -1.5,
    marginBottom: 10,
    textShadowColor: 'rgba(99,102,241,0.6)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 16,
  },
  tagline: {
    fontSize: 14,
    color: 'rgba(199,210,254,0.8)',
    fontWeight: '500',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 28,
  },

  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 48,
  },
  dot: {
    width: 5, height: 5, borderRadius: 2.5,
    backgroundColor: 'rgba(165,180,252,0.45)',
  },
  dotLarge: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: 'rgba(165,180,252,0.8)',
  },

  progressWrap: {
    alignItems: 'center',
    gap: 10,
    width: 200,
  },
  progressTrack: {
    width: '100%',
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.12)',
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
    shadowRadius: 6,
  },
  progressLabel: {
    fontSize: 11,
    color: 'rgba(165,180,252,0.55)',
    fontWeight: '600',
    letterSpacing: 0.5,
  },

  footer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 52 : 36,
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
    backgroundColor: 'rgba(165,180,252,0.2)',
  },
  footerText: {
    fontSize: 11,
    color: 'rgba(165,180,252,0.4)',
    fontWeight: '500',
    letterSpacing: 0.3,
  },
});
