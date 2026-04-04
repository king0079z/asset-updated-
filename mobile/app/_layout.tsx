import { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, Animated, Platform } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { AuthProvider, useAuth } from '@/hooks/useAuth';

SplashScreen.preventAutoHideAsync();

// ── Branded animated splash ────────────────────────────────────────────────
function AppSplash({ onDone }: { onDone: () => void }) {
  const scale    = useRef(new Animated.Value(0.35)).current;
  const logoOp   = useRef(new Animated.Value(0)).current;
  const textY    = useRef(new Animated.Value(24)).current;
  const textOp   = useRef(new Animated.Value(0)).current;
  const tagOp    = useRef(new Animated.Value(0)).current;
  const screenOp = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(scale,  { toValue: 1, tension: 55, friction: 7, useNativeDriver: true }),
        Animated.timing(logoOp, { toValue: 1, duration: 350, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(textOp, { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.timing(textY,  { toValue: 0, duration: 280, useNativeDriver: true }),
      ]),
      Animated.timing(tagOp,    { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.delay(750),
      Animated.timing(screenOp, { toValue: 0, duration: 380, useNativeDriver: true }),
    ]).start(() => onDone());
  }, []);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: screenOp }]} pointerEvents="none">
      <LinearGradient
        colors={['#1e1b4b', '#3730a3', '#4f46e5']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.7, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={s.circle1} />
      <View style={s.circle2} />

      <View style={s.center}>
        <Animated.View style={[s.logoWrap, { opacity: logoOp, transform: [{ scale }] }]}>
          <View style={s.glowRing} />
          <LinearGradient
            colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0.07)']}
            style={s.logoBox}
          >
            <Ionicons name="cube" size={54} color="#ffffff" allowFontScaling={false} />
          </LinearGradient>
        </Animated.View>

        <Animated.Text style={[s.appName, { opacity: textOp, transform: [{ translateY: textY }] }]}>
          AssetXAI
        </Animated.Text>
        <Animated.Text style={[s.tagline, { opacity: tagOp }]}>
          Enterprise Asset Management
        </Animated.Text>

        <Animated.View style={[s.dotsRow, { opacity: tagOp }]}>
          {[0, 1, 2].map(i => <View key={i} style={s.dot} />)}
        </Animated.View>
      </View>

      <Animated.Text style={[s.version, { opacity: tagOp }]}>
        v2.0 · Powered by AssetXAI
      </Animated.Text>
    </Animated.View>
  );
}

// ── Root navigation ────────────────────────────────────────────────────────
function RootLayoutNav() {
  const { initializing, user } = useAuth();
  const [fontsLoaded] = useFonts({ ...Ionicons.font });
  const [nativeSplashDone, setNativeSplashDone] = useState(false);
  const [showSplash, setShowSplash] = useState(true);

  // Only hide native splash AFTER both fonts AND auth are ready
  useEffect(() => {
    if (!initializing && fontsLoaded) {
      SplashScreen.hideAsync()
        .then(() => setNativeSplashDone(true))
        .catch(() => setNativeSplashDone(true));
    }
  }, [initializing, fontsLoaded]);

  // Lazy push-notification registration after login
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

const s = StyleSheet.create({
  center:   { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 60 },
  circle1: {
    position: 'absolute', top: -60, right: -60,
    width: 280, height: 280, borderRadius: 140,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  circle2: {
    position: 'absolute', bottom: 120, left: -80,
    width: 220, height: 220, borderRadius: 110,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  logoWrap: { alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  glowRing: {
    position: 'absolute',
    width: 138, height: 138, borderRadius: 44,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.15)',
  },
  logoBox: {
    width: 114, height: 114, borderRadius: 34,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.25)',
  },
  appName: {
    fontSize: 40, fontWeight: '800', color: '#fff',
    letterSpacing: -1.2, marginBottom: 8,
  },
  tagline: {
    fontSize: 15, color: 'rgba(255,255,255,0.62)',
    fontWeight: '500', marginBottom: 36,
  },
  dotsRow: { flexDirection: 'row', gap: 8 },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: 'rgba(255,255,255,0.38)' },
  version: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 50 : 34,
    alignSelf: 'center',
    fontSize: 12, color: 'rgba(255,255,255,0.32)', fontWeight: '500',
  },
});
