import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { theme } from '@/constants/theme';
import { Card } from '@/components/ui/Card';
import { getTicket, updateTicketStatus } from '@/lib/api';

export default function TicketDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getTicket(id);
      setTicket(data);
    } catch {
      setTicket(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    if (ticket?.title) navigation.setOptions({ title: ticket.title });
  }, [ticket?.title, navigation]);

  const setStatus = (status: string) => {
    if (!id) return;
    updateTicketStatus(id, status).then(load).catch((e) => Alert.alert('Error', e?.message));
  };

  if (!id) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Invalid ticket</Text>
      </View>
    );
  }

  if (loading && !ticket) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!ticket) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Ticket not found</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.colors.primary} />}
    >
      <Card>
        <Text style={styles.title}>{ticket.title || ticket.subject || 'Ticket'}</Text>
        <View style={[styles.badge, ticket.status === 'CLOSED' && styles.badgeClosed]}>
          <Text style={styles.badgeText}>{ticket.status}</Text>
        </View>
        {ticket.priority && <Text style={styles.meta}>Priority: {ticket.priority}</Text>}
        {ticket.asset?.name && <Text style={styles.meta}>Asset: {ticket.asset.name}</Text>}
        {ticket.description && (
          <>
            <Text style={styles.label}>Description</Text>
            <Text style={styles.body}>{ticket.description}</Text>
          </>
        )}
      </Card>

      <Text style={styles.sectionTitle}>Update status</Text>
      <View style={styles.actions}>
        {['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.actionBtn, ticket.status === s && styles.actionBtnActive]}
            onPress={() => setStatus(s)}
          >
            <Text style={[styles.actionBtnText, ticket.status === s && styles.actionBtnTextActive]}>{s.replace('_', ' ')}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xxxl },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background },
  muted: { ...theme.typography.body, color: theme.colors.textMuted },
  title: { ...theme.typography.titleSmall, color: theme.colors.text },
  badge: { alignSelf: 'flex-start', marginTop: theme.spacing.sm, paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.radius.sm, backgroundColor: theme.colors.infoBg },
  badgeClosed: { backgroundColor: theme.colors.successBg },
  badgeText: { fontSize: 12, fontWeight: '600', color: theme.colors.textSecondary },
  meta: { ...theme.typography.caption, color: theme.colors.textSecondary, marginTop: theme.spacing.xs },
  label: { ...theme.typography.label, color: theme.colors.textSecondary, marginTop: theme.spacing.lg },
  body: { ...theme.typography.body, color: theme.colors.text, marginTop: theme.spacing.xs },
  sectionTitle: { ...theme.typography.titleSmall, color: theme.colors.text, marginBottom: theme.spacing.md },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  actionBtn: { paddingVertical: theme.spacing.sm, paddingHorizontal: theme.spacing.md, borderRadius: theme.radius.md, backgroundColor: theme.colors.surface, borderWidth: 1.5, borderColor: theme.colors.border },
  actionBtnActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  actionBtnText: { ...theme.typography.captionMedium, color: theme.colors.text },
  actionBtnTextActive: { color: '#fff' },
});
