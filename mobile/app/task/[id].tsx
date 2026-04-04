import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert, Platform,
  StatusBar, Animated,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/constants/theme';
import { Badge } from '@/components/ui/Badge';
import { getTask, updateTaskStatus } from '@/lib/api';

const PRIORITY_META: Record<string, { variant: 'error' | 'warning' | 'success' | 'muted'; label: string }> = {
  CRITICAL: { variant: 'error',   label: 'Critical' },
  HIGH:     { variant: 'error',   label: 'High'     },
  MEDIUM:   { variant: 'warning', label: 'Medium'   },
  LOW:      { variant: 'success', label: 'Low'      },
};

const STATUS_STEPS = [
  { key: 'PLANNED',     label: 'Planned',     icon: 'calendar-outline' as const },
  { key: 'IN_PROGRESS', label: 'In Progress', icon: 'construct-outline' as const },
  { key: 'COMPLETED',   label: 'Completed',   icon: 'checkmark-circle-outline' as const },
];

export default function TaskDetailScreen() {
  const { id }  = useLocalSearchParams<{ id: string }>();
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const [task,      setTask]      = useState<any>(null);
  const [loading,   setLoading]   = useState(true);
  const [refreshing,setRefreshing]= useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

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
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const setStatus = (status: string) => {
    if (!id) return;
    Alert.alert('Update Status', `Set task to "${status.replace('_', ' ')}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        onPress: () => updateTaskStatus(id, status).then(load).catch(e => Alert.alert('Error', e?.message)),
      },
    ]);
  };

  if (!id || (!loading && !task)) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <Ionicons name="checkbox-outline" size={48} color={theme.colors.textMuted} allowFontScaling={false} />
        <Text style={styles.centeredText}>Task not found</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
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

  const currentStepIdx = STATUS_STEPS.findIndex(s => s.key === task.status);
  const priorityMeta = PRIORITY_META[task.priority] ?? { variant: 'muted' as const, label: task.priority };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Amber gradient header */}
      <LinearGradient
        colors={['#78350f', '#d97706', '#f59e0b']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + (Platform.OS === 'android' ? 36 : 16) }]}
      >
        <View style={styles.headerCircle} />
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backCircle} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color="#fff" allowFontScaling={false} />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.headerTitle} numberOfLines={2}>
              {task.title || task.name || 'Task'}
            </Text>
            <View style={styles.headerMeta}>
              <Badge label={task.status?.replace(/_/g, ' ') ?? 'PLANNED'} variant="muted" size="sm" />
              {task.priority && <Badge label={priorityMeta.label} variant={priorityMeta.variant} size="sm" />}
            </View>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          {/* Progress steps */}
          <View style={styles.stepsCard}>
            <Text style={styles.stepsTitle}>Progress</Text>
            <View style={styles.stepsRow}>
              {STATUS_STEPS.map((step, idx) => {
                const done   = idx < currentStepIdx;
                const active = idx === currentStepIdx;
                const color  = done ? theme.colors.success : active ? theme.colors.amber : theme.colors.textMuted;
                return (
                  <View key={step.key} style={{ flex: 1, alignItems: 'center' }}>
                    {idx > 0 && (
                      <View style={[styles.connector, { backgroundColor: done ? theme.colors.success : theme.colors.border }]} />
                    )}
                    <View style={[styles.stepCircle, {
                      backgroundColor: (done || active) ? color + '18' : theme.colors.borderLight,
                      borderColor: color, borderWidth: active || done ? 2 : 1,
                    }]}>
                      <Ionicons
                        name={done ? 'checkmark-circle' : step.icon}
                        size={20}
                        color={color}
                        allowFontScaling={false}
                      />
                    </View>
                    <Text style={[styles.stepLabel, { color }]}>{step.label}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Details card */}
          <View style={styles.card}>
            {task.asset?.name && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Asset</Text>
                <Text style={styles.detailValue}>{task.asset.name}</Text>
              </View>
            )}
            {task.assignedUser?.name && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Assigned To</Text>
                <Text style={styles.detailValue}>{task.assignedUser.name}</Text>
              </View>
            )}
            {task.dueDate && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Due Date</Text>
                <Text style={styles.detailValue}>{new Date(task.dueDate).toLocaleDateString()}</Text>
              </View>
            )}
            {task.createdAt && (
              <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.detailLabel}>Created</Text>
                <Text style={styles.detailValue}>{new Date(task.createdAt).toLocaleDateString()}</Text>
              </View>
            )}
          </View>

          {/* Description */}
          {task.description && (
            <View style={styles.card}>
              <Text style={styles.cardSectionTitle}>Description</Text>
              <Text style={styles.descText}>{task.description}</Text>
            </View>
          )}

          {/* Status actions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Update Status</Text>
            <View style={styles.actionsRow}>
              {STATUS_STEPS.map(step => {
                const active = task.status === step.key;
                const gradients: Record<string, [string, string]> = {
                  PLANNED:     ['#6366f1', '#4f46e5'],
                  IN_PROGRESS: ['#f59e0b', '#d97706'],
                  COMPLETED:   ['#16a34a', '#15803d'],
                };
                return (
                  <TouchableOpacity
                    key={step.key}
                    style={[styles.actionBtn, active && styles.actionBtnActive]}
                    onPress={() => !active && setStatus(step.key)}
                    activeOpacity={active ? 1 : 0.75}
                  >
                    {active && (
                      <LinearGradient colors={gradients[step.key]} style={StyleSheet.absoluteFill} />
                    )}
                    <Text style={[styles.actionBtnText, active && { color: '#fff' }]}>
                      {step.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: theme.colors.background, gap: 12,
  },
  centeredText: { ...theme.typography.body, color: theme.colors.textMuted },
  backBtn: {
    paddingHorizontal: 24, paddingVertical: 10,
    backgroundColor: theme.colors.primary, borderRadius: theme.radius.xl,
  },
  backBtnText: { color: '#fff', fontWeight: '700' },

  header: {
    paddingHorizontal: theme.spacing.xl,
    paddingBottom: theme.spacing.xxl,
    overflow: 'hidden',
  },
  headerCircle: {
    position: 'absolute', top: -30, right: -30,
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start' },
  backCircle: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#fff', letterSpacing: -0.2, marginBottom: 6 },
  headerMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  stepsCard: {
    backgroundColor: theme.colors.surface,
    margin: theme.spacing.lg,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    ...theme.shadows.md,
  },
  stepsTitle: {
    fontSize: 11, fontWeight: '700', color: theme.colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: theme.spacing.lg,
  },
  stepsRow: { flexDirection: 'row', alignItems: 'flex-start' },
  connector: {
    position: 'absolute', top: 22, right: '50%', left: '-50%',
    height: 2,
  },
  stepCircle: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    zIndex: 1,
  },
  stepLabel: {
    fontSize: 9, fontWeight: '700', textAlign: 'center',
    textTransform: 'uppercase', letterSpacing: 0.3,
    marginTop: 6, maxWidth: 72,
  },

  card: {
    backgroundColor: theme.colors.surface,
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    borderRadius: theme.radius.xl,
    overflow: 'hidden',
    ...theme.shadows.md,
  },
  detailRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.borderLight,
  },
  detailLabel: { fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary },
  detailValue: { fontSize: 14, fontWeight: '500', color: theme.colors.text, textAlign: 'right', flex: 1, marginLeft: 16 },
  cardSectionTitle: {
    fontSize: 11, fontWeight: '700', color: theme.colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.5,
    paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.lg, paddingBottom: theme.spacing.sm,
  },
  descText: {
    fontSize: 15, color: theme.colors.text, lineHeight: 22,
    paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.lg,
  },

  section: { paddingHorizontal: theme.spacing.lg, marginBottom: theme.spacing.lg },
  sectionTitle: {
    fontSize: 11, fontWeight: '700', color: theme.colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: theme.spacing.md,
  },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  actionBtn: {
    paddingVertical: 10, paddingHorizontal: 16,
    borderRadius: theme.radius.xl,
    borderWidth: 1.5, borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    overflow: 'hidden',
    ...theme.shadows.sm,
  },
  actionBtnActive: { borderColor: 'transparent' },
  actionBtnText: { fontSize: 13, fontWeight: '700', color: theme.colors.textSecondary },
});
