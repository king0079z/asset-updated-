/**
 * This screen is retired — HANDHELD accounts now use the WebView taskpane.
 * Any navigation that lands here is immediately bounced back to the main screen.
 */
import { useEffect } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

export default function InventoryScreen() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/(tabs)/' as any);
  }, []);
  return <View style={{ flex: 1, backgroundColor: '#1e1b4b' }} />;
}
