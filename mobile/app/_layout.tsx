import { useEffect } from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider, useAuth } from '@/hooks/useAuth';

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const { initializing, user } = useAuth();

  useEffect(() => {
    if (!initializing) SplashScreen.hideAsync();
  }, [initializing]);

  // Push notifications registered lazily after first login
  // to avoid requiring google-services.json at build time.
  useEffect(() => {
    if (!user) return;
    import('@/lib/push').then(({ registerForPushNotificationsAsync }) => {
      registerForPushNotificationsAsync().catch(() => {});
    }).catch(() => {});
  }, [user?.id]);

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }} />
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
