import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: 'none' },
      }}
    >
      <Tabs.Screen name="index"     options={{ title: 'App' }} />
      <Tabs.Screen name="alerts"    options={{ title: 'Alerts' }} />
      <Tabs.Screen name="inventory" options={{ href: null }} />
      <Tabs.Screen name="assets"    options={{ href: null }} />
      <Tabs.Screen name="portal"    options={{ href: null }} />
      <Tabs.Screen name="work"      options={{ href: null }} />
      <Tabs.Screen name="more"      options={{ href: null }} />
    </Tabs>
  );
}
