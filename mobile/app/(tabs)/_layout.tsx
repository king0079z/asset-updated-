/**
 * Tab layout — tab bar fully hidden.
 * All navigation happens via the native top bar and WebView in-page nav.
 * No tab is user-accessible — expo-router needs the Tabs wrapper but
 * all screens except index are set to href:null (not navigable).
 */
import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: 'none' },
      }}
    >
      <Tabs.Screen name="index"     options={{ title: 'App' }} />
      <Tabs.Screen name="alerts"    options={{ title: 'Alerts' }} />
      {/* All other screens are non-navigable */}
      <Tabs.Screen name="inventory" options={{ href: null }} />
      <Tabs.Screen name="assets"    options={{ href: null }} />
      <Tabs.Screen name="portal"    options={{ href: null }} />
      <Tabs.Screen name="work"      options={{ href: null }} />
      <Tabs.Screen name="more"      options={{ href: null }} />
    </Tabs>
  );
}
