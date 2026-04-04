import { useEffect } from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { registerForPushNotificationsAsync } from '@/lib/push';

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const { initializing, user } = useAuth();

  useEffect(() => {
    if (!initializing) SplashScreen.hideAsync();
  }, [initializing]);

  // Register for push notifications once the user is signed in
  useEffect(() => {
    if (!user) return;
    registerForPushNotificationsAsync().catch(() => {
      // Non-fatal — user may have denied permission
    });
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
