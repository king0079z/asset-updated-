import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView, StatusBar, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { isConfigValid } from '@/constants/config';
import { theme } from '@/constants/theme';

export default function LoginScreen() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const { signIn } = useAuth();
  const router = useRouter();

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Required', 'Please enter your email and password.');
      return;
    }
    if (!isConfigValid()) {
      Alert.alert('Configuration Error', 'App is not yet configured. Please contact IT.');
      return;
    }
    setLoading(true);
    try {
      await signIn(email.trim(), password);
      router.replace('/(tabs)');
    } catch (e: any) {
      Alert.alert('Login Failed', e?.message || 'Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <LinearGradient
        colors={['#1e1b4b', '#3730a3', '#4f46e5']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Background decoration */}
      <View style={styles.circle1} />
      <View style={styles.circle2} />
      <View style={styles.circle3} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo / Branding */}
          <View style={styles.brandArea}>
            <LinearGradient colors={['rgba(99,102,241,0.5)', 'rgba(45,36,112,0.85)']} style={styles.logoBox}>
              <Image source={require('../../assets/icon.png')} style={styles.logoImg} resizeMode="contain" />
            </LinearGradient>
            <Text style={styles.appName}>AssetXAI</Text>
            <Text style={styles.appTagline}>Enterprise Asset Management</Text>
          </View>

          {/* Login Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Sign In</Text>
            <Text style={styles.cardSubtitle}>Use your organization credentials</Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Email Address</Text>
              <View style={styles.inputWrap}>
                {/* @ symbol as mail icon */}
                <Text style={styles.fieldIcon}>@</Text>
                <TextInput
                  style={styles.input}
                  placeholder="you@organization.com"
                  placeholderTextColor={theme.colors.textMuted}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Password</Text>
              <View style={styles.inputWrap}>
                {/* Lock icon drawn with views */}
                <View style={styles.lockIcon}>
                  <View style={styles.lockTop} />
                  <View style={styles.lockBody} />
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your password"
                  placeholderTextColor={theme.colors.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPw}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                />
                <TouchableOpacity onPress={() => setShowPw(!showPw)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.eyeIcon}>{showPw ? '🙈' : '👁'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.loginBtn, loading && { opacity: 0.7 }]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#4f46e5', '#7c3aed']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.loginGradient}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={styles.loginText}>Sign In</Text>
                    <Text style={styles.arrowIcon}>→</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.footer}>
              <Text style={styles.footerText}>🔒  Secured with enterprise SSO</Text>
            </View>
          </View>

          <Text style={styles.versionText}>AssetXAI Mobile · v2.2</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: theme.spacing.xl,
    paddingTop: 80,
    paddingBottom: 40,
  },
  circle1: {
    position: 'absolute', top: -80, right: -80,
    width: 280, height: 280, borderRadius: 140,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  circle2: {
    position: 'absolute', bottom: 100, left: -60,
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  circle3: {
    position: 'absolute', top: 200, left: 100,
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  brandArea: {
    alignItems: 'center',
    marginBottom: theme.spacing.xxxl,
    gap: 8,
  },
  logoBox: {
    width: 80,
    height: 80,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
    marginBottom: 4,
    overflow: 'hidden',
  },
  logoImg: {
    width: 54,
    height: 54,
    borderRadius: 12,
  },
  appName: {
    fontSize: 30,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
  },
  appTagline: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '500',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 28,
    padding: theme.spacing.xxl,
    gap: theme.spacing.lg,
    ...theme.shadows.xl,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.text,
    letterSpacing: -0.3,
  },
  cardSubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: -8,
  },
  fieldGroup: { gap: 6 },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.xl,
    paddingHorizontal: theme.spacing.lg,
    height: 52,
    backgroundColor: theme.colors.surfaceDim,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: theme.colors.text,
  },
  fieldIcon: {
    fontSize: 16,
    color: theme.colors.textMuted,
    fontWeight: '700',
    width: 18,
    textAlign: 'center',
  },
  lockIcon: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockTop: {
    width: 10,
    height: 6,
    borderWidth: 1.5,
    borderColor: theme.colors.textMuted,
    borderBottomWidth: 0,
    borderRadius: 5,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    marginBottom: 0,
  },
  lockBody: {
    width: 13,
    height: 9,
    borderWidth: 1.5,
    borderColor: theme.colors.textMuted,
    borderRadius: 2,
    backgroundColor: 'transparent',
  },
  eyeIcon: {
    fontSize: 16,
  },
  arrowIcon: {
    fontSize: 18,
    color: '#fff',
    fontWeight: '700',
  },
  loginBtn: {
    borderRadius: theme.radius.xl,
    overflow: 'hidden',
    ...theme.shadows.colored,
    marginTop: 4,
  },
  loginGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 54,
  },
  loginText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  footerText: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  versionText: {
    textAlign: 'center',
    marginTop: theme.spacing.xl,
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '500',
  },
});
