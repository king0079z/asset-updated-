import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { API_URL } from '@/constants/config';

export default function MoreScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.replace('/(auth)/login');
  };

  const rows = [
    { icon: 'add-circle-outline' as const, label: 'Add new asset', href: `${API_URL}/assets/new`, external: true },
    { icon: 'cube-outline' as const, label: 'All assets', onPress: () => router.push('/(tabs)/assets') },
    { icon: 'layers-outline' as const, label: 'Inventory (count & audit)', onPress: () => router.push('/(tabs)/inventory') },
    { icon: 'briefcase-outline' as const, label: 'Work (tickets & tasks)', onPress: () => router.push('/(tabs)/work') },
    { icon: 'open-outline' as const, label: 'Open full web app', href: API_URL, external: true },
    { icon: 'settings-outline' as const, label: 'Settings', href: `${API_URL}/settings`, external: true },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {user?.email && (
        <View style={styles.profile}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(user.email[0] || '?').toUpperCase()}</Text>
          </View>
          <Text style={styles.email} numberOfLines={1}>{user.email}</Text>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>App</Text>
        {rows.map((row, index) => (
          <TouchableOpacity
            key={row.label}
            style={[styles.row, index === 0 && styles.rowFirst]}
            onPress={() => {
              if (row.href && row.external) Linking.openURL(row.href);
              else if (row.onPress) row.onPress();
            }}
          >
            <Ionicons name={row.icon} size={22} color={theme.colors.primary} />
            <Text style={styles.rowLabel}>{row.label}</Text>
            {(row.href && row.external) && <Ionicons name="open-outline" size={18} color={theme.colors.textMuted} />}
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.signOut} onPress={handleSignOut}>
        <Ionicons name="log-out-outline" size={22} color={theme.colors.error} />
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xxxl },
  profile: { alignItems: 'center', paddingVertical: theme.spacing.xxl },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 24, fontWeight: '700', color: '#fff' },
  email: { ...theme.typography.body, color: theme.colors.textSecondary, marginTop: theme.spacing.sm },
  section: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, overflow: 'hidden', ...theme.shadows.sm },
  sectionTitle: { ...theme.typography.overline, color: theme.colors.textMuted, paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.lg, paddingBottom: theme.spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: theme.spacing.lg, paddingHorizontal: theme.spacing.lg, borderTopWidth: 1, borderTopColor: theme.colors.borderLight, gap: theme.spacing.md },
  rowFirst: { borderTopWidth: 0 },
  rowLabel: { flex: 1, ...theme.typography.body, color: theme.colors.text },
  signOut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.spacing.sm, marginTop: theme.spacing.xxl, paddingVertical: theme.spacing.lg },
  signOutText: { ...theme.typography.bodyMedium, color: theme.colors.error },
});
