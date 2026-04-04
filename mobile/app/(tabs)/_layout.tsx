/**
 * Tab layout — 3 tabs:
 *   1. App       → Full-screen PWA WebView (assetxai.live)
 *   2. Handheld  → Native handheld audit / RFID scan screen
 *   3. Alerts    → Native push notification centre
 *
 * All other screens (assets, portal, work, more, etc.) are accessible
 * through the WebView and are hidden from the tab bar.
 */
import { Tabs } from 'expo-router';
import { View, StyleSheet, Platform, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '@/constants/theme';

function TabIcon({
  name,
  color,
  focused,
  badge,
}: {
  name: keyof typeof Ionicons.glyphMap;
  color: string;
  focused: boolean;
  badge?: number;
}) {
  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <LinearGradient
        colors={focused ? [theme.colors.primary, theme.colors.secondary] : ['transparent', 'transparent']}
        style={styles.iconGrad}
      >
        <Ionicons name={name} size={22} color={focused ? '#fff' : color} allowFontScaling={false} />
      </LinearGradient>
      {badge != null && badge > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      )}
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor:   theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: {
          backgroundColor:  '#ffffff',
          borderTopColor:   theme.colors.borderLight,
          borderTopWidth:   StyleSheet.hairlineWidth,
          height:           Platform.OS === 'ios' ? 88 : 68,
          paddingBottom:    Platform.OS === 'ios' ? 28 : 10,
          paddingTop:       8,
          elevation:        16,
          shadowColor:      '#000',
          shadowOffset:     { width: 0, height: -3 },
          shadowOpacity:    0.08,
          shadowRadius:     12,
        },
        tabBarLabelStyle: {
          fontSize:     10,
          fontWeight:   '700',
          letterSpacing: 0.3,
          marginTop:    2,
        },
        headerShown: false,
      }}
    >
      {/* ── 1. App (PWA WebView) ─────────────────────────────────────────── */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'App',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? 'globe' : 'globe-outline'} color={color} focused={focused} />
          ),
        }}
      />

      {/* ── 2. Handheld Audit (native) ───────────────────────────────────── */}
      <Tabs.Screen
        name="inventory"
        options={{
          title: 'Handheld',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? 'scan' : 'scan-outline'} color={color} focused={focused} />
          ),
        }}
      />

      {/* ── 3. Alerts (native) ───────────────────────────────────────────── */}
      <Tabs.Screen
        name="alerts"
        options={{
          title: 'Alerts',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? 'notifications' : 'notifications-outline'} color={color} focused={focused} />
          ),
        }}
      />

      {/* ── Hidden tabs (accessible via WebView or deep links) ──────────── */}
      <Tabs.Screen name="assets"  options={{ href: null }} />
      <Tabs.Screen name="portal"  options={{ href: null }} />
      <Tabs.Screen name="work"    options={{ href: null }} />
      <Tabs.Screen name="more"    options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    width: 44, height: 32,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: 16, position: 'relative',
  },
  iconWrapActive: {},
  iconGrad: {
    width: 44, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  badge: {
    position: 'absolute', top: 0, right: 0,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: theme.colors.error,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5, borderColor: '#fff',
  },
  badgeText: { fontSize: 8, fontWeight: '800', color: '#fff' },
});
