/**
 * Tab layout — tab bar is HIDDEN.
 * The native bottom bar is intentionally not shown because:
 *   • The WebView (Outlook taskpane) has its own in-page navigation
 *   • Top-bar actions (scan, notifications) handle native features
 *
 * Navigation to Handheld / Alerts happens via router.push() from within screens.
 * Only HANDHELD-role accounts can access the inventory screen.
 */
import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: 'none' }, // completely hidden
      }}
    >
      <Tabs.Screen name="index"     options={{ title: 'App' }} />
      <Tabs.Screen name="inventory" options={{ title: 'Handheld' }} />
      <Tabs.Screen name="alerts"    options={{ title: 'Alerts' }} />
      {/* Remaining legacy screens hidden */}
      <Tabs.Screen name="assets"  options={{ href: null }} />
      <Tabs.Screen name="portal"  options={{ href: null }} />
      <Tabs.Screen name="work"    options={{ href: null }} />
      <Tabs.Screen name="more"    options={{ href: null }} />
    </Tabs>
  );
}
