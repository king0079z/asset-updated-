import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
  Alert,
  Modal,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';
import { EmptyState } from '@/components/ui/EmptyState';
import { getMyTickets, submitTicket } from '@/lib/api';

// ─── Category definitions mirroring the web app ───────────────────────────
const CATEGORIES = [
  { value: 'DEVICES',         label: 'Hardware / Devices',   icon: 'desktop-outline',       requiresDlm: true  },
  { value: 'SOFTWARE',        label: 'Software',             icon: 'code-slash-outline',    requiresDlm: true  },
  { value: 'ACCESS',          label: 'Access Request',       icon: 'key-outline',           requiresDlm: true  },
  { value: 'NG_DEPLOYMENTS',  label: 'Deployments',          icon: 'cloud-upload-outline',  requiresDlm: true  },
  { value: 'SAP',             label: 'SAP',                  icon: 'business-outline',      requiresDlm: true  },
  { value: 'SERVICE_DESK',    label: 'IT Service Desk',      icon: 'headset-outline',       requiresDlm: true  },
  { value: 'FACILITIES',      label: 'Facilities',           icon: 'construct-outline',     requiresDlm: false },
  { value: 'HR',              label: 'HR Support',           icon: 'people-outline',        requiresDlm: false },
  { value: 'OTHER',           label: 'Other',                icon: 'help-circle-outline',   requiresDlm: false },
] as const;

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
type Priority = typeof PRIORITIES[number];

const PRIORITY_COLORS: Record<Priority, string> = {
  LOW:      '#22c55e',
  MEDIUM:   '#f59e0b',
  HIGH:     '#ef4444',
  CRITICAL: '#7c3aed',
};

type PortalTab = 'mytickets' | 'submit';

// ─── DLM status helpers ───────────────────────────────────────────────────
function getDlmCardStyle(ticket: any) {
  const s = ticket.dlmApprovalStatus;
  if (s === 'PENDING_DLM')   return { border: '#f59e0b', bg: '#fffbeb' };
  if (s === 'DLM_REJECTED')  return { border: '#dc2626', bg: '#fef2f2' };
  return { border: theme.colors.borderLight, bg: theme.colors.surface };
}

function getDlmBadge(ticket: any): { label: string; color: string; bg: string } {
  const s = ticket.dlmApprovalStatus;
  if (s === 'PENDING_DLM')   return { label: '⏳ Pending DLM',     color: '#92400e', bg: '#fef3c7' };
  if (s === 'DLM_REJECTED')  return { label: '✗ Rejected by DLM',  color: '#dc2626', bg: '#fee2e2' };
  if (s === 'DLM_APPROVED')  return { label: '✓ DLM Approved',     color: '#065f46', bg: '#d1fae5' };
  const st = ticket.status || 'OPEN';
  const colors: Record<string, { color: string; bg: string }> = {
    OPEN:        { color: '#1d4ed8', bg: '#dbeafe' },
    IN_PROGRESS: { color: '#92400e', bg: '#fef3c7' },
    RESOLVED:    { color: '#065f46', bg: '#d1fae5' },
    CLOSED:      { color: '#374151', bg: '#f3f4f6' },
  };
  const c = colors[st] ?? { color: '#374151', bg: '#f3f4f6' };
  return { label: st.replace('_', ' '), ...c };
}

// ─── Ticket card ──────────────────────────────────────────────────────────
function TicketCard({ item }: { item: any }) {
  const cardStyle = getDlmCardStyle(item);
  const badge = getDlmBadge(item);
  const isPending  = item.dlmApprovalStatus === 'PENDING_DLM';
  const isRejected = item.dlmApprovalStatus === 'DLM_REJECTED';

  return (
    <View style={[styles.ticketCard, { borderLeftColor: cardStyle.border, backgroundColor: cardStyle.bg }]}>
      <View style={styles.ticketCardHeader}>
        <Text style={styles.ticketTitle} numberOfLines={2}>
          {item.title || item.subject || 'Ticket'}
        </Text>
        {isPending  && <Ionicons name="time"         size={18} color="#f59e0b" />}
        {isRejected && <Ionicons name="close-circle" size={18} color="#dc2626" />}
      </View>

      <View style={styles.ticketMeta}>
        <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
          <Text style={[styles.statusBadgeText, { color: badge.color }]}>{badge.label}</Text>
        </View>
        {item.category && (
          <Text style={styles.metaChip}>{item.category.replace(/_/g, ' ')}</Text>
        )}
        {item.priority && (
          <View style={[styles.priorityDot, { backgroundColor: PRIORITY_COLORS[item.priority as Priority] ?? '#6b7280' }]} />
        )}
      </View>

      {isPending && (
        <View style={styles.dlmFooter}>
          <Ionicons name="hourglass-outline" size={13} color="#92400e" />
          <Text style={styles.dlmFooterText}>Awaiting your manager's approval · DLM REVIEW</Text>
        </View>
      )}
      {isRejected && (
        <View style={[styles.dlmFooter, { borderTopColor: '#fecaca' }]}>
          <Ionicons name="alert-circle-outline" size={13} color="#dc2626" />
          <Text style={[styles.dlmFooterText, { color: '#dc2626' }]}>
            Rejected by manager — contact your DLM for details
          </Text>
        </View>
      )}

      {item.displayId && (
        <Text style={styles.ticketId}>#{item.displayId}</Text>
      )}
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────
export default function PortalScreen() {
  const [tab, setTab]             = useState<PortalTab>('mytickets');
  const [tickets, setTickets]     = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Form state
  const [title,       setTitle]       = useState('');
  const [category,    setCategory]    = useState('');
  const [priority,    setPriority]    = useState<Priority>('MEDIUM');
  const [description, setDescription] = useState('');
  const [submitting,  setSubmitting]  = useState(false);
  const [catModal,    setCatModal]    = useState(false);

  const loadTickets = useCallback(async () => {
    try {
      const data = await getMyTickets();
      setTickets(Array.isArray(data) ? data : []);
    } catch {
      setTickets([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'mytickets') loadTickets();
  }, [tab, loadTickets]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadTickets();
  }, [loadTickets]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Required', 'Please enter a request title.');
      return;
    }
    if (!category) {
      Alert.alert('Required', 'Please select a category.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await submitTicket({
        title: title.trim(),
        category,
        priority,
        description: description.trim() || undefined,
      });
      const needsDlm = res?.dlmApprovalStatus === 'PENDING_DLM';
      Alert.alert(
        needsDlm ? '✅ Sent for Manager Approval' : '✅ Ticket Submitted',
        needsDlm
          ? 'Your request has been sent to your Direct Line Manager for approval. You will receive an email once it is reviewed. Track the status in My Tickets.'
          : 'Your request has been received by the IT support team. You can track its progress in My Tickets.',
        [{ text: 'OK', onPress: () => { setTab('mytickets'); loadTickets(); } }]
      );
      setTitle('');
      setCategory('');
      setPriority('MEDIUM');
      setDescription('');
    } catch (e: any) {
      Alert.alert('Submission Failed', e?.message || 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedCat = CATEGORIES.find(c => c.value === category);

  // ── Pending DLM highlight group ──
  const pendingDlm = tickets.filter(t => t.dlmApprovalStatus === 'PENDING_DLM');
  const otherTickets = tickets.filter(t => t.dlmApprovalStatus !== 'PENDING_DLM');
  const sortedTickets = [...pendingDlm, ...otherTickets];

  return (
    <View style={styles.container}>
      {/* Tab Toggle */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'mytickets' && styles.tabBtnActive]}
          onPress={() => setTab('mytickets')}
        >
          <Ionicons name="list"        size={16} color={tab === 'mytickets' ? '#fff' : theme.colors.textSecondary} />
          <Text style={[styles.tabText, tab === 'mytickets' && styles.tabTextActive]}>
            My Tickets{pendingDlm.length > 0 ? ` (${pendingDlm.length})` : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'submit' && styles.tabBtnActive]}
          onPress={() => setTab('submit')}
        >
          <Ionicons name="add-circle"  size={16} color={tab === 'submit' ? '#fff' : theme.colors.textSecondary} />
          <Text style={[styles.tabText, tab === 'submit' && styles.tabTextActive]}>New Request</Text>
        </TouchableOpacity>
      </View>

      {/* ── My Tickets ── */}
      {tab === 'mytickets' && (
        loading && tickets.length === 0 ? (
          <ActivityIndicator size="large" color={theme.colors.primary} style={styles.loader} />
        ) : (
          <FlatList
            data={sortedTickets}
            keyExtractor={item => item.id}
            renderItem={({ item }) => <TicketCard item={item} />}
            contentContainerStyle={sortedTickets.length === 0 ? styles.emptyList : styles.list}
            ListHeaderComponent={
              pendingDlm.length > 0 ? (
                <View style={styles.pendingBanner}>
                  <Ionicons name="shield-half-outline" size={18} color="#92400e" />
                  <Text style={styles.pendingBannerText}>
                    {pendingDlm.length} request{pendingDlm.length !== 1 ? 's' : ''} awaiting manager approval
                  </Text>
                </View>
              ) : null
            }
            ListEmptyComponent={
              <EmptyState
                icon="ticket-outline"
                title="No requests yet"
                subtitle="Your submitted IT requests will appear here"
              />
            }
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
            }
          />
        )
      )}

      {/* ── Submit Request Form ── */}
      {tab === 'submit' && (
        <ScrollView
          style={styles.form}
          contentContainerStyle={styles.formContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Title */}
          <Text style={styles.fieldLabel}>Request title *</Text>
          <TextInput
            style={styles.input}
            placeholder="Brief description of your request"
            placeholderTextColor={theme.colors.textMuted}
            value={title}
            onChangeText={setTitle}
          />

          {/* Category */}
          <Text style={styles.fieldLabel}>Category *</Text>
          <TouchableOpacity style={styles.selector} onPress={() => setCatModal(true)}>
            {selectedCat ? (
              <View style={styles.selectorRow}>
                <Ionicons name={selectedCat.icon as any} size={20} color={theme.colors.primary} />
                <Text style={styles.selectorText}>{selectedCat.label}</Text>
                {selectedCat.requiresDlm && (
                  <View style={styles.dlmPill}><Text style={styles.dlmPillText}>DLM</Text></View>
                )}
              </View>
            ) : (
              <Text style={styles.selectorPlaceholder}>Select category</Text>
            )}
            <Ionicons name="chevron-down" size={20} color={theme.colors.textMuted} />
          </TouchableOpacity>

          {selectedCat?.requiresDlm && (
            <View style={styles.dlmNotice}>
              <Ionicons name="information-circle-outline" size={16} color="#92400e" />
              <Text style={styles.dlmNoticeText}>
                This category requires approval from your Direct Line Manager before the IT team can action it.
              </Text>
            </View>
          )}

          {/* Priority */}
          <Text style={styles.fieldLabel}>Priority</Text>
          <View style={styles.priorityRow}>
            {PRIORITIES.map(p => (
              <TouchableOpacity
                key={p}
                style={[
                  styles.priorityChip,
                  priority === p && { backgroundColor: PRIORITY_COLORS[p], borderColor: PRIORITY_COLORS[p] },
                ]}
                onPress={() => setPriority(p)}
              >
                <Text style={[styles.priorityChipText, priority === p && { color: '#fff' }]}>{p}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Description */}
          <Text style={styles.fieldLabel}>Details (optional)</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            placeholder="Provide any additional context, steps to reproduce, or requirements..."
            placeholderTextColor={theme.colors.textMuted}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="send" size={18} color="#fff" />
                <Text style={styles.submitBtnText}>Submit Request</Text>
              </>
            )}
          </TouchableOpacity>

          <Text style={styles.submitHint}>
            All requests are logged and tracked. DLM-gated categories require manager sign-off first.
          </Text>
        </ScrollView>
      )}

      {/* ── Category picker modal ── */}
      <Modal visible={catModal} transparent animationType="slide" onRequestClose={() => setCatModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setCatModal(false)}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Select Category</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat.value}
                  style={[styles.modalItem, category === cat.value && styles.modalItemActive]}
                  onPress={() => { setCategory(cat.value); setCatModal(false); }}
                >
                  <View style={[styles.modalIconWrap, category === cat.value && { backgroundColor: theme.colors.primary + '22' }]}>
                    <Ionicons name={cat.icon as any} size={22} color={category === cat.value ? theme.colors.primary : theme.colors.textSecondary} />
                  </View>
                  <View style={styles.modalItemBody}>
                    <Text style={[styles.modalItemText, category === cat.value && { color: theme.colors.primary }]}>
                      {cat.label}
                    </Text>
                    {cat.requiresDlm && (
                      <Text style={styles.modalItemSub}>Requires manager approval</Text>
                    )}
                  </View>
                  {category === cat.value && <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: theme.colors.background },
  loader:             { marginTop: 64 },

  // ── Tab bar
  tabBar:             { flexDirection: 'row', padding: theme.spacing.lg, gap: theme.spacing.sm },
  tabBtn:             { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: theme.spacing.md, borderRadius: theme.radius.md, backgroundColor: theme.colors.surface, ...theme.shadows.sm },
  tabBtnActive:       { backgroundColor: theme.colors.primary },
  tabText:            { ...theme.typography.bodyMedium, color: theme.colors.textSecondary },
  tabTextActive:      { color: '#fff' },

  // ── My Tickets list
  list:               { paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxxl },
  emptyList:          { flexGrow: 1, paddingBottom: theme.spacing.xxxl },

  pendingBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a',
    borderRadius: theme.radius.md, padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  pendingBannerText:  { flex: 1, fontSize: 13, fontWeight: '600', color: '#92400e' },

  ticketCard: {
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    borderLeftWidth: 4,
    ...theme.shadows.sm,
  },
  ticketCardHeader:   { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  ticketTitle:        { flex: 1, ...theme.typography.bodyMedium, color: theme.colors.text },
  ticketMeta:         { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  statusBadge:        { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  statusBadgeText:    { fontSize: 11, fontWeight: '700' },
  metaChip:           { fontSize: 11, color: theme.colors.textMuted, backgroundColor: theme.colors.borderLight, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 99 },
  priorityDot:        { width: 8, height: 8, borderRadius: 4 },
  dlmFooter: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 8, paddingTop: 8,
    borderTopWidth: 1, borderTopColor: '#fde68a',
  },
  dlmFooterText:      { flex: 1, fontSize: 12, fontWeight: '600', color: '#92400e' },
  ticketId:           { ...theme.typography.caption, color: theme.colors.textMuted, marginTop: 6 },

  // ── Submit form
  form:               { flex: 1 },
  formContent:        { padding: theme.spacing.lg, paddingBottom: 48 },
  fieldLabel:         { ...theme.typography.label, color: theme.colors.textSecondary, marginBottom: theme.spacing.xs, marginTop: theme.spacing.lg },
  input: {
    borderWidth: 1.5, borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.lg, paddingVertical: 14,
    fontSize: 16, backgroundColor: theme.colors.surface, color: theme.colors.text,
  },
  textarea:           { minHeight: 100, paddingTop: 14, textAlignVertical: 'top' },

  selector: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1.5, borderColor: theme.colors.border, borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.lg, paddingVertical: 14,
    backgroundColor: theme.colors.surface,
  },
  selectorRow:        { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  selectorText:       { fontSize: 16, color: theme.colors.text, flex: 1 },
  selectorPlaceholder:{ fontSize: 16, color: theme.colors.textMuted },
  dlmPill:            { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 99, backgroundColor: '#fef3c7' },
  dlmPillText:        { fontSize: 10, fontWeight: '800', color: '#92400e' },

  dlmNotice: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a',
    borderRadius: theme.radius.md, padding: theme.spacing.md, marginTop: 8,
  },
  dlmNoticeText:      { flex: 1, fontSize: 13, color: '#92400e', lineHeight: 18 },

  priorityRow:        { flexDirection: 'row', gap: theme.spacing.sm, marginTop: 4 },
  priorityChip: {
    flex: 1, paddingVertical: 10, borderRadius: theme.radius.md,
    alignItems: 'center', borderWidth: 1.5, borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  priorityChipText:   { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary },

  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: theme.spacing.sm, height: 56, borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.primary, marginTop: theme.spacing.xl,
    ...theme.shadows.md,
  },
  submitBtnText:      { fontSize: 16, fontWeight: '700', color: '#fff' },
  submitHint:         { fontSize: 12, color: theme.colors.textMuted, textAlign: 'center', marginTop: 12 },

  // ── Category modal
  modalOverlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: theme.spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    maxHeight: '80%',
  },
  modalHandle:        { width: 40, height: 4, borderRadius: 2, backgroundColor: theme.colors.border, alignSelf: 'center', marginBottom: 16 },
  modalTitle:         { ...theme.typography.titleSmall, color: theme.colors.text, marginBottom: theme.spacing.md },
  modalItem: {
    flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.borderLight,
  },
  modalItemActive:    { opacity: 1 },
  modalIconWrap:      { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.borderLight },
  modalItemBody:      { flex: 1 },
  modalItemText:      { ...theme.typography.body, color: theme.colors.text },
  modalItemSub:       { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
});
