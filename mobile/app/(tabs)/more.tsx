import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Linking, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { API_URL } from '@/constants/config';

interface MenuRow {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  sublabel?: string;
  href?: string;
  onPress?: () => void;
  badge?: string;
  danger?: boolean;
}

export default function MoreScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out', style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const openExternal = (url: string) => Linking.openURL(url);

  const sections: { title: string; rows: MenuRow[] }[] = [
    {
      title: 'Asset Management',
      rows: [
        { icon: 'cube-outline',     label: 'All Assets',              onPress: () => router.push('/(tabs)/assets') },
        { icon: 'layers-outline',   label: 'Inventory / Audit',       sublabel: 'Count & audit assets by scan', onPress: () => router.push('/(tabs)/inventory' as any) },
        { icon: 'add-circle-outline', label: 'Add New Asset',         href: `${API_URL}/assets/new` },
      ],
    },
    {
      title: 'IT Service Portal',
      rows: [
        { icon: 'ticket-outline',      label: 'My Requests',          sublabel: 'View your submitted tickets',  onPress: () => router.push('/(tabs)/portal') },
        { icon: 'add-outline',         label: 'New IT Request',       sublabel: 'Submit a new ticket',          onPress: () => router.push('/(tabs)/portal') },
        { icon: 'shield-checkmark-outline', label: 'DLM Approvals',  sublabel: 'Pending approvals from your team', onPress: () => router.push('/(tabs)/work') },
      ],
    },
    {
      title: 'Web App',
      rows: [
        { icon: 'open-outline',        label: 'Open Full Web App',    href: API_URL },
        { icon: 'settings-outline',    label: 'Settings',             href: `${API_URL}/settings` },
        { icon: 'people-outline',      label: 'Approval Management',  href: `${API_URL}/settings/approval` },
        { icon: 'analytics-outline',   label: 'Reports & Analytics',  href: `${API_URL}/reports` },
      ],
    },
  ];

  const initials = (user?.email?.[0] ?? '?').toUpperCase();
  const displayName = (user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || '') as string;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile Card */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={styles.profileInfo}>
          {displayName ? (
            <Text style={styles.displayName} numberOfLines={1}>{displayName}</Text>
          ) : null}
          <Text style={styles.email} numberOfLines={1}>{user?.email}</Text>
        </View>
      </View>

      {/* Menu Sections */}
      {sections.map(section => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <View style={styles.sectionCard}>
            {section.rows.map((row, idx) => (
              <TouchableOpacity
                key={row.label}
                style={[styles.row, idx === 0 && styles.rowFirst]}
                onPress={() => {
                  if (row.href) openExternal(row.href);
                  else if (row.onPress) row.onPress();
                }}
              >
                <View style={styles.rowIconWrap}>
                  <Ionicons name={row.icon} size={20} color={theme.colors.primary} />
                </View>
                <View style={styles.rowBody}>
                  <Text style={styles.rowLabel}>{row.label}</Text>
                  {row.sublabel && <Text style={styles.rowSublabel}>{row.sublabel}</Text>}
                </View>
                {row.href
                  ? <Ionicons name="open-outline"      size={16} color={theme.colors.textMuted} />
                  : <Ionicons name="chevron-forward"   size={16} color={theme.colors.textMuted} />
                }
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}

      {/* Sign out */}
      <TouchableOpacity style={styles.signOut} onPress={handleSignOut}>
        <Ionicons name="log-out-outline" size={22} color={theme.colors.error} />
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>

      <Text style={styles.version}>AssetXAI · {API_URL.replace('https://', '')}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: theme.colors.background },
  content:      { padding: theme.spacing.lg, paddingBottom: 48 },

  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md,
    backgroundColor: theme.colors.surface, borderRadius: theme.radius.xl,
    padding: theme.spacing.lg, marginBottom: theme.spacing.xl,
    ...theme.shadows.md,
  },
  avatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: theme.colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText:   { fontSize: 22, fontWeight: '800', color: '#fff' },
  profileInfo:  { flex: 1 },
  displayName:  { ...theme.typography.bodyMedium, color: theme.colors.text },
  email:        { ...theme.typography.caption, color: theme.colors.textSecondary, marginTop: 2 },

  section:      { marginBottom: theme.spacing.xl },
  sectionTitle: { ...theme.typography.overline, color: theme.colors.textMuted, marginBottom: theme.spacing.sm },
  sectionCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl, overflow: 'hidden', ...theme.shadows.sm,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md,
    paddingVertical: theme.spacing.md, paddingHorizontal: theme.spacing.lg,
    borderTopWidth: 1, borderTopColor: theme.colors.borderLight,
  },
  rowFirst:     { borderTopWidth: 0 },
  rowIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: theme.colors.primary + '15',
    alignItems: 'center', justifyContent: 'center',
  },
  rowBody:      { flex: 1 },
  rowLabel:     { ...theme.typography.body, color: theme.colors.text },
  rowSublabel:  { fontSize: 12, color: theme.colors.textMuted, marginTop: 1 },

  signOut: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: theme.spacing.sm, marginTop: theme.spacing.md,
    paddingVertical: theme.spacing.lg,
  },
  signOutText:  { ...theme.typography.bodyMedium, color: theme.colors.error },

  version:      { textAlign: 'center', fontSize: 11, color: theme.colors.textMuted, marginTop: 8 },
});
