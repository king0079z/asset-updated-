import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';
import { EmptyState } from '@/components/ui/EmptyState';
import { getAssignedTickets, getAssignedTasks } from '@/lib/api';

type WorkTab = 'tickets' | 'tasks';

export default function WorkScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<WorkTab>('tickets');
  const [tickets, setTickets] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [t, g] = await Promise.all([getAssignedTickets(), getAssignedTasks()]);
      setTickets(Array.isArray(t) ? t : []);
      setTasks(Array.isArray(g) ? g : []);
    } catch {
      setTickets([]);
      setTasks([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const list = tab === 'tickets' ? tickets : tasks;
  const emptyTitle = tab === 'tickets' ? 'No tickets assigned' : 'No tasks assigned';
  const emptySub = tab === 'tickets' ? 'Tickets assigned to you will appear here' : 'Tasks from the planner will appear here';

  const renderTicket = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.7}
      onPress={() => router.push(`/ticket/${item.id}` as any)}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle} numberOfLines={1}>{item.title || item.subject || 'Ticket'}</Text>
        <View style={[styles.statusBadge, item.status === 'CLOSED' && styles.statusClosed]}>
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
      </View>
      {item.asset?.name && <Text style={styles.cardSub}>Asset: {item.asset.name}</Text>}
      {item.priority && <Text style={styles.cardMeta}>Priority: {item.priority}</Text>}
      <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} style={styles.chevron} />
    </TouchableOpacity>
  );

  const renderTask = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.7}
      onPress={() => router.push(`/task/${item.id}` as any)}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle} numberOfLines={1}>{item.title || item.name || 'Task'}</Text>
        <View style={[styles.statusBadge, item.status === 'COMPLETED' && styles.statusClosed]}>
          <Text style={styles.statusText}>{item.status?.replace('_', ' ')}</Text>
        </View>
      </View>
      {item.asset?.name && <Text style={styles.cardSub}>Asset: {item.asset.name}</Text>}
      {item.priority && <Text style={styles.cardMeta}>Priority: {item.priority}</Text>}
      <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} style={styles.chevron} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.toggle}>
        <TouchableOpacity style={[styles.toggleBtn, tab === 'tickets' && styles.toggleBtnActive]} onPress={() => setTab('tickets')}>
          <Ionicons name="ticket" size={18} color={tab === 'tickets' ? '#fff' : theme.colors.textSecondary} />
          <Text style={[styles.toggleText, tab === 'tickets' && styles.toggleTextActive]}>Tickets</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.toggleBtn, tab === 'tasks' && styles.toggleBtnActive]} onPress={() => setTab('tasks')}>
          <Ionicons name="checkbox" size={18} color={tab === 'tasks' ? '#fff' : theme.colors.textSecondary} />
          <Text style={[styles.toggleText, tab === 'tasks' && styles.toggleTextActive]}>Tasks</Text>
        </TouchableOpacity>
      </View>

      {loading && list.length === 0 ? (
        <ActivityIndicator size="large" color={theme.colors.primary} style={styles.loader} />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(item) => item.id}
          renderItem={tab === 'tickets' ? renderTicket : renderTask}
          contentContainerStyle={list.length === 0 ? styles.emptyList : styles.list}
          ListEmptyComponent={<EmptyState icon="briefcase-outline" title={emptyTitle} subtitle={emptySub} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  toggle: { flexDirection: 'row', padding: theme.spacing.lg, gap: theme.spacing.sm },
  toggleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.spacing.xs, paddingVertical: theme.spacing.md, borderRadius: theme.radius.md, backgroundColor: theme.colors.surface, ...theme.shadows.sm },
  toggleBtnActive: { backgroundColor: theme.colors.primary },
  toggleText: { ...theme.typography.bodyMedium, color: theme.colors.textSecondary },
  toggleTextActive: { color: '#fff' },
  list: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xxxl },
  emptyList: { flexGrow: 1, paddingBottom: theme.spacing.xxxl },
  loader: { marginTop: 48 },
  card: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: theme.spacing.lg, marginBottom: theme.spacing.md, ...theme.shadows.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.xs },
  cardTitle: { flex: 1, ...theme.typography.bodyMedium, color: theme.colors.text },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: theme.radius.sm, backgroundColor: theme.colors.infoBg },
  statusClosed: { backgroundColor: theme.colors.successBg },
  statusText: { fontSize: 11, fontWeight: '600', color: theme.colors.textSecondary },
  cardSub: { ...theme.typography.caption, color: theme.colors.textSecondary, marginTop: 4 },
  cardMeta: { ...theme.typography.caption, color: theme.colors.textMuted, marginTop: 2 },
  chevron: { position: 'absolute', right: theme.spacing.lg, top: theme.spacing.lg },
});
