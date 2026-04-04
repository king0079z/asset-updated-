import { useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, Platform, StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { API_URL } from '@/constants/config';

const WEB = API_URL; // e.g. https://assetxai.live

type NavItem = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
  route?: string;
  webPath?: string;
  badge?: string;
};

type Section = {
  title: string;
  items: NavItem[];
};

const NAV_SECTIONS: Section[] = [
  {
    title: 'Dashboard & Analytics',
    items: [
      { label: 'Dashboard', icon: 'grid-outline', color: '#4f46e5', bg: '#eef2ff', route: '/(tabs)/index' },
      { label: 'AI Analysis', icon: 'sparkles-outline', color: '#7c3aed', bg: '#f5f3ff', webPath: '/ai-analysis' },
      { label: 'Print Reports', icon: 'print-outline', color: '#0ea5e9', bg: '#e0f2fe', webPath: '/reports' },
      { label: 'Planner', icon: 'calendar-outline', color: '#059669', bg: '#ecfdf5', webPath: '/planner' },
      { label: 'Staff Activity', icon: 'people-outline', color: '#d97706', bg: '#fef3c7', webPath: '/staff-activity' },
    ],
  },
  {
    title: 'Asset Management',
    items: [
      { label: 'All Assets', icon: 'cube-outline', color: '#4f46e5', bg: '#eef2ff', route: '/(tabs)/assets' },
      { label: 'Handheld Audit', icon: 'scan-outline', color: '#16a34a', bg: '#dcfce7', route: '/(tabs)/inventory' },
      { label: 'Service Contracts', icon: 'document-text-outline', color: '#0ea5e9', bg: '#e0f2fe', webPath: '/service-contracts' },
      { label: 'Compliance & Audit', icon: 'shield-checkmark-outline', color: '#7c3aed', bg: '#f5f3ff', webPath: '/compliance' },
    ],
  },
  {
    title: 'Tracking',
    items: [
      { label: 'Asset Location', icon: 'location-outline', color: '#ef4444', bg: '#fee2e2', webPath: '/asset-tracking' },
      { label: 'RFID & BLE Tracking', icon: 'bluetooth-outline', color: '#8b5cf6', bg: '#ede9fe', webPath: '/rfid-tracking' },
      { label: 'Vehicle Tracking', icon: 'navigate-outline', color: '#0d9488', bg: '#f0fdfa', webPath: '/vehicle-tracking' },
      { label: 'My Vehicle', icon: 'car-sport-outline', color: '#f59e0b', bg: '#fffbeb', webPath: '/my-vehicle' },
    ],
  },
  {
    title: 'Fleet & Operations',
    items: [
      { label: 'Vehicle Assignments', icon: 'car-outline', color: '#0ea5e9', bg: '#e0f2fe', webPath: '/vehicle-assignments' },
      { label: 'Vehicle Rentals', icon: 'key-outline', color: '#d97706', bg: '#fef3c7', webPath: '/vehicle-rentals' },
      { label: 'Drivers', icon: 'person-circle-outline', color: '#7c3aed', bg: '#f5f3ff', webPath: '/drivers' },
    ],
  },
  {
    title: 'Food & Facilities',
    items: [
      { label: 'Food Supply', icon: 'nutrition-outline', color: '#16a34a', bg: '#dcfce7', webPath: '/food-supply' },
      { label: 'Kitchens', icon: 'flame-outline', color: '#ef4444', bg: '#fee2e2', webPath: '/kitchens' },
    ],
  },
  {
    title: 'IT Support',
    items: [
      { label: 'IT Tickets', icon: 'ticket-outline', color: '#4f46e5', bg: '#eef2ff', route: '/(tabs)/portal' },
      { label: 'My Work Queue', icon: 'briefcase-outline', color: '#d97706', bg: '#fef3c7', route: '/(tabs)/work' },
      { label: 'Approval Requests', icon: 'checkmark-circle-outline', color: '#16a34a', bg: '#dcfce7', route: '/(tabs)/work' },
      { label: 'Approval Management', icon: 'people-circle-outline', color: '#7c3aed', bg: '#f5f3ff', webPath: '/settings/approval' },
    ],
  },
  {
    title: 'System',
    items: [
      { label: 'Settings', icon: 'settings-outline', color: '#64748b', bg: '#f1f5f9', webPath: '/settings' },
      { label: 'System Config', icon: 'construct-outline', color: '#475569', bg: '#f8fafc', webPath: '/system' },
    ],
  },
];

export default function MoreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleSignOut = useCallback(() => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          router.replace('/(auth)/login' as any);
        },
      },
    ]);
  }, [router]);

  const openItem = useCallback((item: NavItem) => {
    if (item.route) {
      router.push(item.route as any);
    } else if (item.webPath) {
      router.push({
        pathname: '/webview',
        params: { url: `${WEB}${item.webPath}`, title: item.label },
      } as any);
    }
  }, [router]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Gradient Header */}
      <LinearGradient
        colors={['#3730a3', '#4f46e5', '#7c3aed']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + (Platform.OS === 'android' ? 36 : 16) }]}
      >
        <View style={styles.headerCircle} />
        <Text style={styles.headerTitle}>Navigation</Text>
        <Text style={styles.headerSubtitle}>All AssetXAI modules</Text>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {NAV_SECTIONS.map(section => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.sectionCard}>
              {section.items.map((item, idx) => (
                <TouchableOpacity
                  key={item.label}
                  style={[
                    styles.navItem,
                    idx < section.items.length - 1 && styles.navItemBorder,
                  ]}
                  onPress={() => openItem(item)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.navIconBox, { backgroundColor: item.bg }]}>
                    <Ionicons name={item.icon} size={20} color={item.color} />
                  </View>
                  <Text style={styles.navLabel}>{item.label}</Text>
                  <View style={styles.navRight}>
                    {item.webPath && (
                      <View style={styles.webBadge}>
                        <Ionicons name="globe-outline" size={11} color={theme.colors.textMuted} />
                        <Text style={styles.webBadgeText}>Web</Text>
                      </View>
                    )}
                    <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {/* Sign Out */}
        <View style={styles.section}>
          <View style={styles.sectionCard}>
            <TouchableOpacity style={styles.navItem} onPress={handleSignOut} activeOpacity={0.7}>
              <View style={[styles.navIconBox, { backgroundColor: theme.colors.errorBg }]}>
                <Ionicons name="log-out-outline" size={20} color={theme.colors.error} />
              </View>
              <Text style={[styles.navLabel, { color: theme.colors.error }]}>Sign Out</Text>
              <Ionicons name="chevron-forward" size={16} color={theme.colors.error} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ alignItems: 'center', marginTop: 8, marginBottom: 8 }}>
          <Text style={styles.versionText}>AssetXAI Mobile · v2.0</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: theme.spacing.xl,
    paddingBottom: theme.spacing.xxl,
    overflow: 'hidden',
  },
  headerCircle: {
    position: 'absolute',
    top: -30, right: -30,
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.65)',
    marginTop: 4,
  },
  content: {
    padding: theme.spacing.lg,
  },
  section: {
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.sm,
    marginLeft: 4,
  },
  sectionCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    overflow: 'hidden',
    ...theme.shadows.md,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 14,
    gap: theme.spacing.md,
    minHeight: 52,
  },
  navItemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.borderLight,
  },
  navIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: theme.colors.text,
  },
  navRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  webBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: theme.colors.borderLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  webBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  versionText: {
    fontSize: 12,
    color: theme.colors.textMuted,
    fontWeight: '500',
  },
});
