import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';
import { EmptyState } from '@/components/ui/EmptyState';
import { getAssignedTickets, getAssignedTasks, getDlmPending, decideDlm } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

type WorkTab = 'tickets' | 'tasks' | 'approvals';

const STATUS_COLORS: Record<string, { color: string; bg: string }> = {
  OPEN:        { color: '#1d4ed8', bg: '#dbeafe' },
  IN_PROGRESS: { color: '#92400e', bg: '#fef3c7' },
  RESOLVED:    { color: '#065f46', bg: '#d1fae5' },
  CLOSED:      { color: '#374151', bg: '#f3f4f6' },
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW:      '#22c55e',
  MEDIUM:   '#f59e0b',
  HIGH:     '#ef4444',
  CRITICAL: '#7c3aed',
};

// ─── Small badge ──────────────────────────────────────────────────────────
function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

// ─── Ticket row ───────────────────────────────────────────────────────────
function TicketRow({ item, onPress }: { item: any; onPress: () => void }) {
  const st = item.status || 'OPEN';
  const sc = STATUS_COLORS[st] ?? { color: '#374151', bg: '#f3f4f6' };
  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.7} onPress={onPress}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle} numberOfLines={1}>{item.title || item.subject || 'Ticket'}</Text>
        <Badge label={st.replace('_', ' ')} color={sc.color} bg={sc.bg} />
      </View>
      {item.asset?.name && <Text style={styles.cardSub}>Asset: {item.asset.name}</Text>}
      {item.priority && (
        <View style={styles.priorityRow}>
          <View style={[styles.priorityDot, { backgroundColor: PRIORITY_COLORS[item.priority] ?? '#6b7280' }]} />
          <Text style={styles.cardMeta}>{item.priority}</Text>
        </View>
      )}
      <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} style={styles.chevron} />
    </TouchableOpacity>
  );
}

// ─── Task row ─────────────────────────────────────────────────────────────
function TaskRow({ item, onPress }: { item: any; onPress: () => void }) {
  const st = item.status || 'PENDING';
  const sc = STATUS_COLORS[st] ?? { color: '#374151', bg: '#f3f4f6' };
  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.7} onPress={onPress}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle} numberOfLines={1}>{item.title || item.name || 'Task'}</Text>
        <Badge label={st.replace(/_/g, ' ')} color={sc.color} bg={sc.bg} />
      </View>
      {item.asset?.name && <Text style={styles.cardSub}>Asset: {item.asset.name}</Text>}
      {item.priority && (
        <View style={styles.priorityRow}>
          <View style={[styles.priorityDot, { backgroundColor: PRIORITY_COLORS[item.priority] ?? '#6b7280' }]} />
          <Text style={styles.cardMeta}>{item.priority}</Text>
        </View>
      )}
      <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} style={styles.chevron} />
    </TouchableOpacity>
  );
}

// ─── DLM Approval card ────────────────────────────────────────────────────
function ApprovalCard({
  item,
  onDecide,
  deciding,
}: {
  item: any;
  onDecide: (action: 'approve' | 'reject') => void;
  deciding: boolean;
}) {
  return (
    <View style={styles.approvalCard}>
      {/* Header */}
      <View style={styles.approvalCardHeader}>
        <View style={styles.approvalIconWrap}>
          <Ionicons name="shield-checkmark-outline" size={20} color={theme.colors.primary} />
        </View>
        <View style={styles.approvalCardInfo}>
          <Text style={styles.approvalTitle} numberOfLines={2}>{item.title || item.subject || 'Request'}</Text>
          {item.user && (
            <Text style={styles.approvalUser}>
              From {item.user.displayName || item.user.email}
            </Text>
          )}
        </View>
      </View>

      {/* Meta */}
      <View style={styles.approvalMeta}>
        {item.category && (
          <View style={styles.approvalChip}>
            <Text style={styles.approvalChipText}>{item.category.replace(/_/g, ' ')}</Text>
          </View>
        )}
        {item.priority && (
          <View style={[styles.approvalChip, { backgroundColor: PRIORITY_COLORS[item.priority] + '22' }]}>
            <Text style={[styles.approvalChipText, { color: PRIORITY_COLORS[item.priority] }]}>
              {item.priority}
            </Text>
          </View>
        )}
        {item.displayId && (
          <Text style={styles.approvalId}>#{item.displayId}</Text>
        )}
      </View>

      {item.description && (
        <Text style={styles.approvalDesc} numberOfLines={3}>{item.description}</Text>
      )}

      {/* Actions */}
      <View style={styles.approvalActions}>
        <TouchableOpacity
          style={[styles.approvalBtn, styles.approvalBtnReject, deciding && { opacity: 0.5 }]}
          onPress={() => onDecide('reject')}
          disabled={deciding}
        >
          {deciding ? (
            <ActivityIndicator size="small" color="#dc2626" />
          ) : (
            <>
              <Ionicons name="close-circle-outline" size={18} color="#dc2626" />
              <Text style={styles.approvalBtnRejectText}>Reject</Text>
            </>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.approvalBtn, styles.approvalBtnApprove, deciding && { opacity: 0.5 }]}
          onPress={() => onDecide('approve')}
          disabled={deciding}
        >
          {deciding ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
              <Text style={styles.approvalBtnApproveText}>Approve</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────
export default function WorkScreen() {
  const router    = useRouter();
  const { user }  = useAuth();

  const [tab,       setTab]       = useState<WorkTab>('tickets');
  const [tickets,   setTickets]   = useState<any[]>([]);
  const [tasks,     setTasks]     = useState<any[]>([]);
  const [approvals, setApprovals] = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // DLM decision state
  const [decidingId,   setDecidingId]   = useState<string | null>(null);
  const [commentModal, setCommentModal] = useState<{ id: string; action: 'approve' | 'reject' } | null>(null);
  const [comment,      setComment]      = useState('');

  const load = useCallback(async () => {
    try {
      const [t, g, a] = await Promise.allSettled([
        getAssignedTickets(),
        getAssignedTasks(),
        getDlmPending(),
      ]);
      setTickets(t.status === 'fulfilled' && Array.isArray(t.value) ? t.value : []);
      setTasks(g.status === 'fulfilled'   && Array.isArray(g.value) ? g.value : []);
      setApprovals(a.status === 'fulfilled' && Array.isArray(a.value) ? a.value : []);
    } catch {
      setTickets([]); setTasks([]); setApprovals([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, [load]);

  const promptDecide = (id: string, action: 'approve' | 'reject') => {
    setComment('');
    setCommentModal({ id, action });
  };

  const confirmDecide = async () => {
    if (!commentModal) return;
    const { id, action } = commentModal;
    setCommentModal(null);
    setDecidingId(id);
    try {
      await decideDlm(id, action, comment.trim() || undefined);
      setApprovals(prev => prev.filter(a => a.id !== id));
      Alert.alert(
        action === 'approve' ? '✅ Approved' : '❌ Rejected',
        action === 'approve'
          ? 'The ticket has been approved and is now open for IT processing.'
          : 'The ticket has been rejected and the requester has been notified.',
      );
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to process decision.');
    } finally {
      setDecidingId(null);
    }
  };

  const isManager = approvals.length > 0; // show tab if there are pending items

  return (
    <View style={styles.container}>
      {/* Tab selector */}
      <View style={styles.toggle}>
        <TouchableOpacity
          style={[styles.toggleBtn, tab === 'tickets' && styles.toggleBtnActive]}
          onPress={() => setTab('tickets')}
        >
          <Ionicons name="ticket" size={16} color={tab === 'tickets' ? '#fff' : theme.colors.textSecondary} />
          <Text style={[styles.toggleText, tab === 'tickets' && styles.toggleTextActive]}>Tickets</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, tab === 'tasks' && styles.toggleBtnActive]}
          onPress={() => setTab('tasks')}
        >
          <Ionicons name="checkbox" size={16} color={tab === 'tasks' ? '#fff' : theme.colors.textSecondary} />
          <Text style={[styles.toggleText, tab === 'tasks' && styles.toggleTextActive]}>Tasks</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, tab === 'approvals' && styles.toggleBtnActive]}
          onPress={() => setTab('approvals')}
        >
          <Ionicons name="shield-checkmark" size={16} color={tab === 'approvals' ? '#fff' : theme.colors.textSecondary} />
          <Text style={[styles.toggleText, tab === 'approvals' && styles.toggleTextActive]}>
            Approvals{approvals.length > 0 ? ` (${approvals.length})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Tickets ── */}
      {tab === 'tickets' && (
        loading && tickets.length === 0 ? (
          <ActivityIndicator size="large" color={theme.colors.primary} style={styles.loader} />
        ) : (
          <FlatList
            data={tickets}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <TicketRow item={item} onPress={() => router.push(`/ticket/${item.id}` as any)} />
            )}
            contentContainerStyle={tickets.length === 0 ? styles.emptyList : styles.list}
            ListEmptyComponent={
              <EmptyState
                icon="ticket-outline"
                title="No tickets assigned"
                subtitle="Tickets assigned to you for resolution will appear here"
              />
            }
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
          />
        )
      )}

      {/* ── Tasks ── */}
      {tab === 'tasks' && (
        loading && tasks.length === 0 ? (
          <ActivityIndicator size="large" color={theme.colors.primary} style={styles.loader} />
        ) : (
          <FlatList
            data={tasks}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <TaskRow item={item} onPress={() => router.push(`/task/${item.id}` as any)} />
            )}
            contentContainerStyle={tasks.length === 0 ? styles.emptyList : styles.list}
            ListEmptyComponent={
              <EmptyState
                icon="checkbox-outline"
                title="No tasks assigned"
                subtitle="Planner tasks assigned to you will appear here"
              />
            }
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
          />
        )
      )}

      {/* ── DLM Approvals ── */}
      {tab === 'approvals' && (
        loading && approvals.length === 0 ? (
          <ActivityIndicator size="large" color={theme.colors.primary} style={styles.loader} />
        ) : (
          <FlatList
            data={approvals}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <ApprovalCard
                item={item}
                deciding={decidingId === item.id}
                onDecide={(action) => promptDecide(item.id, action)}
              />
            )}
            contentContainerStyle={approvals.length === 0 ? styles.emptyList : styles.approvalList}
            ListHeaderComponent={
              approvals.length > 0 ? (
                <View style={styles.approvalHeader}>
                  <Ionicons name="shield-half-outline" size={20} color={theme.colors.primary} />
                  <Text style={styles.approvalHeaderText}>
                    {approvals.length} pending approval{approvals.length !== 1 ? 's' : ''}
                  </Text>
                </View>
              ) : null
            }
            ListEmptyComponent={
              <EmptyState
                icon="shield-checkmark-outline"
                title="No pending approvals"
                subtitle="Team member IT requests awaiting your sign-off will appear here"
              />
            }
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
          />
        )
      )}

      {/* ── DLM decision comment modal ── */}
      <Modal visible={!!commentModal} transparent animationType="slide" onRequestClose={() => setCommentModal(null)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setCommentModal(null)}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>
              {commentModal?.action === 'approve' ? '✅ Approve Request' : '❌ Reject Request'}
            </Text>
            <Text style={styles.modalSub}>Add a comment (optional)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder={
                commentModal?.action === 'approve'
                  ? "Approval note for the requester..."
                  : "Reason for rejection..."
              }
              placeholderTextColor={theme.colors.textMuted}
              value={comment}
              onChangeText={setComment}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setCommentModal(null)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalConfirm,
                  commentModal?.action === 'reject' && { backgroundColor: '#dc2626' },
                ]}
                onPress={confirmDecide}
              >
                <Text style={styles.modalConfirmText}>
                  {commentModal?.action === 'approve' ? 'Approve' : 'Reject'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: theme.colors.background },
  loader:     { marginTop: 64 },
  list:       { padding: theme.spacing.lg, paddingBottom: theme.spacing.xxxl },
  emptyList:  { flexGrow: 1, paddingBottom: theme.spacing.xxxl },
  approvalList: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xxxl },

  // ── Tab toggle
  toggle:         { flexDirection: 'row', padding: theme.spacing.lg, gap: theme.spacing.sm },
  toggleBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: theme.spacing.md, borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface, ...theme.shadows.sm,
  },
  toggleBtnActive: { backgroundColor: theme.colors.primary },
  toggleText:      { ...theme.typography.captionMedium, color: theme.colors.textSecondary },
  toggleTextActive:{ color: '#fff' },

  // ── Ticket/Task card
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    ...theme.shadows.sm,
  },
  cardHeader:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: theme.spacing.xs },
  cardTitle:    { flex: 1, ...theme.typography.bodyMedium, color: theme.colors.text },
  cardSub:      { ...theme.typography.caption, color: theme.colors.textSecondary, marginTop: 2 },
  cardMeta:     { ...theme.typography.caption, color: theme.colors.textMuted },
  priorityRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  priorityDot:  { width: 8, height: 8, borderRadius: 4 },
  chevron:      { position: 'absolute', right: theme.spacing.lg, top: theme.spacing.lg },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  badgeText: { fontSize: 11, fontWeight: '700' },

  // ── Approval card
  approvalHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: theme.colors.primary + '15',
    borderRadius: theme.radius.md, padding: theme.spacing.md, marginBottom: theme.spacing.md,
  },
  approvalHeaderText: { ...theme.typography.bodyMedium, color: theme.colors.primary },

  approvalCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    borderLeftWidth: 4, borderLeftColor: theme.colors.primary,
    ...theme.shadows.sm,
  },
  approvalCardHeader: { flexDirection: 'row', gap: theme.spacing.md, marginBottom: 10 },
  approvalIconWrap: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: theme.colors.primary + '15',
    alignItems: 'center', justifyContent: 'center',
  },
  approvalCardInfo: { flex: 1 },
  approvalTitle:    { ...theme.typography.bodyMedium, color: theme.colors.text, lineHeight: 20 },
  approvalUser:     { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  approvalMeta:     { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 8 },
  approvalChip:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, backgroundColor: theme.colors.borderLight },
  approvalChipText: { fontSize: 11, fontWeight: '600', color: theme.colors.textSecondary },
  approvalId:       { fontSize: 11, color: theme.colors.textMuted },
  approvalDesc:     { fontSize: 13, color: theme.colors.textSecondary, lineHeight: 18, marginBottom: 12 },
  approvalActions:  { flexDirection: 'row', gap: theme.spacing.md, marginTop: 4 },
  approvalBtn:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: theme.radius.md },
  approvalBtnReject:       { backgroundColor: '#fee2e2', borderWidth: 1.5, borderColor: '#fecaca' },
  approvalBtnApprove:      { backgroundColor: theme.colors.primary },
  approvalBtnRejectText:   { fontSize: 14, fontWeight: '700', color: '#dc2626' },
  approvalBtnApproveText:  { fontSize: 14, fontWeight: '700', color: '#fff' },

  // ── Decision modal
  modalOverlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: theme.spacing.xl,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  modalHandle:  { width: 40, height: 4, borderRadius: 2, backgroundColor: theme.colors.border, alignSelf: 'center', marginBottom: 16 },
  modalTitle:   { ...theme.typography.titleSmall, color: theme.colors.text, marginBottom: 4 },
  modalSub:     { ...theme.typography.caption, color: theme.colors.textMuted, marginBottom: 12 },
  modalInput: {
    borderWidth: 1.5, borderColor: theme.colors.border,
    borderRadius: theme.radius.md, padding: theme.spacing.md,
    minHeight: 80, textAlignVertical: 'top',
    fontSize: 15, color: theme.colors.text,
    marginBottom: theme.spacing.lg,
  },
  modalActions:      { flexDirection: 'row', justifyContent: 'flex-end', gap: theme.spacing.md },
  modalCancel:       { paddingVertical: 12, paddingHorizontal: 20 },
  modalCancelText:   { ...theme.typography.bodyMedium, color: theme.colors.textSecondary },
  modalConfirm:      { paddingVertical: 12, paddingHorizontal: 24, backgroundColor: theme.colors.primary, borderRadius: theme.radius.md },
  modalConfirmText:  { ...theme.typography.bodyMedium, color: '#fff' },
});
