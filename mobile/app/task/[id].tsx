import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { theme } from '@/constants/theme';
import { Card } from '@/components/ui/Card';
import { getTask, updateTaskStatus } from '@/lib/api';

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [task, setTask] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getTask(id);
      setTask(data);
    } catch {
      setTask(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    const t = task?.title || task?.name;
    if (t) navigation.setOptions({ title: t });
  }, [task?.title, task?.name, navigation]);

  const setStatus = (status: string) => {
    if (!id) return;
    updateTaskStatus(id, status).then(load).catch((e) => Alert.alert('Error', e?.message));
  };

  if (!id) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Invalid task</Text>
      </View>
    );
  }

  if (loading && !task) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!task) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Task not found</Text>
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
        <Text style={styles.title}>{task.title || task.name || 'Task'}</Text>
        <View style={[styles.badge, task.status === 'COMPLETED' && styles.badgeClosed]}>
          <Text style={styles.badgeText}>{task.status?.replace('_', ' ')}</Text>
        </View>
        {task.priority && <Text style={styles.meta}>Priority: {task.priority}</Text>}
        {task.asset?.name && <Text style={styles.meta}>Asset: {task.asset.name}</Text>}
        {task.description && (
          <>
            <Text style={styles.label}>Description</Text>
            <Text style={styles.body}>{task.description}</Text>
          </>
        )}
      </Card>

      <Text style={styles.sectionTitle}>Update status</Text>
      <View style={styles.actions}>
        {['PLANNED', 'IN_PROGRESS', 'COMPLETED'].map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.actionBtn, task.status === s && styles.actionBtnActive]}
            onPress={() => setStatus(s)}
          >
            <Text style={[styles.actionBtnText, task.status === s && styles.actionBtnTextActive]}>{s.replace('_', ' ')}</Text>
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
