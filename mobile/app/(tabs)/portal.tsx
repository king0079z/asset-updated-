import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, RefreshControl, ActivityIndicator, ScrollView,
  Alert, Modal, Platform, StatusBar, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/constants/theme';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { getMyTickets, submitTicket } from '@/lib/api';

const CATEGORIES = [
  { value: 'DEVICES',        label: 'Hardware / Devices',  icon: 'desktop-outline',      requiresDlm: true  },
  { value: 'SOFTWARE',       label: 'Software',            icon: 'code-slash-outline',   requiresDlm: true  },
  { value: 'ACCESS',         label: 'Access Request',      icon: 'key-outline',          requiresDlm: true  },
  { value: 'NG_DEPLOYMENTS', label: 'Deployments',         icon: 'cloud-upload-outline', requiresDlm: true  },
  { value: 'SAP',            label: 'SAP',                 icon: 'business-outline',     requiresDlm: true  },
  { value: 'SERVICE_DESK',   label: 'IT Service Desk',     icon: 'headset-outline',      requiresDlm: true  },
  { value: 'FACILITIES',     label: 'Facilities',          icon: 'construct-outline',    requiresDlm: false },
  { value: 'HR',             label: 'HR Support',          icon: 'people-outline',       requiresDlm: false },
  { value: 'OTHER',          label: 'Other',               icon: 'help-circle-outline',  requiresDlm: false },
] as const;

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
type Priority = typeof PRIORITIES[number];

const PRIORITY_META: Record<Priority, { label: string; color: string; bg: string; gradient: [string, string] }> = {
  LOW:      { label: 'Low',      color: '#16a34a', bg: '#dcfce7', gradient: ['#16a34a', '#15803d'] },
  MEDIUM:   { label: 'Medium',   color: '#d97706', bg: '#fef3c7', gradient: ['#f59e0b', '#d97706'] },
  HIGH:     { label: 'High',     color: '#dc2626', bg: '#fee2e2', gradient: ['#ef4444', '#dc2626'] },
  CRITICAL: { label: 'Critical', color: '#7c3aed', bg: '#ede9fe', gradient: ['#8b5cf6', '#7c3aed'] },
};

type PortalTab = 'mytickets' | 'submit';

function getTicketAccent(ticket: any): { color: string; gradient: [string, string]; badge: string } {
  const s = ticket.dlmApprovalStatus;
  if (s === 'PENDING_DLM')  return { color: '#f59e0b', gradient: ['#fef3c7', '#fffbeb'], badge: '⏳ Awaiting Approval' };
  if (s === 'DLM_REJECTED') return { color: '#dc2626', gradient: ['#fee2e2', '#fef2f2'], badge: '✗ Rejected by DLM' };
  if (s === 'DLM_APPROVED') return { color: '#16a34a', gradient: ['#dcfce7', '#f0fdf4'], badge: '✓ DLM Approved' };
  const st = ticket.status || 'OPEN';
  if (st === 'OPEN')        return { color: '#0ea5e9', gradient: ['#e0f2fe', '#f0f9ff'], badge: 'Open' };
  if (st === 'IN_PROGRESS') return { color: '#d97706', gradient: ['#fef3c7', '#fffbeb'], badge: 'In Progress' };
  if (st === 'RESOLVED')    return { color: '#16a34a', gradient: ['#dcfce7', '#f0fdf4'], badge: 'Resolved' };
  if (st === 'CLOSED')      return { color: '#64748b', gradient: ['#f1f5f9', '#f8fafc'], badge: 'Closed' };
  return { color: theme.colors.textMuted, gradient: ['#f8fafc', '#f1f5f9'], badge: st };
}

function TicketCard({ item }: { item: any }) {
  const accent = getTicketAccent(item);
  const isPending  = item.dlmApprovalStatus === 'PENDING_DLM';
  const isRejected = item.dlmApprovalStatus === 'DLM_REJECTED';

  return (
    <View style={[styles.ticketCard, { borderLeftColor: accent.color }]}>
      <LinearGradient colors={accent.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ticketGradientBg}>
        <View style={styles.ticketCardTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.ticketTitle} numberOfLines={2}>
              {item.title || item.subject || 'IT Request'}
            </Text>
            <Text style={styles.ticketDate}>
              {item.displayId ? `#${item.displayId}` : ''}{item.createdAt ? `  ·  ${new Date(item.createdAt).toLocaleDateString()}` : ''}
            </Text>
          </View>
          {(isPending || isRejected) && (
            <Ionicons
              name={isPending ? 'time-outline' : 'close-circle-outline'}
              size={20}
              color={accent.color}
            />
          )}
        </View>

        <View style={styles.ticketMeta}>
          <View style={[styles.statusPill, { backgroundColor: accent.color + '22', borderColor: accent.color + '44' }]}>
            <View style={[styles.statusDot, { backgroundColor: accent.color }]} />
            <Text style={[styles.statusText, { color: accent.color }]}>{accent.badge}</Text>
          </View>
          {item.category && (
            <View style={styles.categoryChip}>
              <Text style={styles.categoryChipText}>{item.category.replace(/_/g, ' ')}</Text>
            </View>
          )}
          {item.priority && PRIORITY_META[item.priority as Priority] && (
            <View style={[styles.priorityPill, { backgroundColor: PRIORITY_META[item.priority as Priority].bg }]}>
              <Text style={[styles.priorityText, { color: PRIORITY_META[item.priority as Priority].color }]}>
                {PRIORITY_META[item.priority as Priority].label}
              </Text>
            </View>
          )}
        </View>

        {isPending && (
          <View style={[styles.ticketBanner, { backgroundColor: '#fef3c7', borderColor: '#f59e0b33' }]}>
            <Ionicons name="hourglass-outline" size={13} color="#92400e" />
            <Text style={styles.ticketBannerText}>Awaiting your Direct Line Manager's approval</Text>
          </View>
        )}
        {isRejected && (
          <View style={[styles.ticketBanner, { backgroundColor: '#fee2e2', borderColor: '#dc262633' }]}>
            <Ionicons name="alert-circle-outline" size={13} color="#dc2626" />
            <Text style={[styles.ticketBannerText, { color: '#dc2626' }]}>Rejected — contact your manager for details</Text>
          </View>
        )}
      </LinearGradient>
    </View>
  );
}

export default function PortalScreen() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<PortalTab>('mytickets');
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState<Priority>('MEDIUM');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [catModal, setCatModal] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const loadTickets = useCallback(async () => {
    try {
      const data = await getMyTickets();
      setTickets(Array.isArray(data) ? data : []);
    } catch {
      setTickets([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    }
  }, []);

  useEffect(() => {
    if (tab === 'mytickets') { fadeAnim.setValue(0); loadTickets(); }
  }, [tab, loadTickets]);

  const onRefresh = useCallback(() => { setRefreshing(true); loadTickets(); }, [loadTickets]);

  const handleSubmit = async () => {
    if (!title.trim()) { Alert.alert('Required', 'Please enter a title.'); return; }
    if (!category)     { Alert.alert('Required', 'Please select a category.'); return; }
    setSubmitting(true);
    try {
      const res = await submitTicket({ title: title.trim(), category, priority, description: description.trim() || undefined });
      const needsDlm = res?.dlmApprovalStatus === 'PENDING_DLM';
      Alert.alert(
        needsDlm ? '✅ Sent for Manager Approval' : '✅ Request Submitted',
        needsDlm
          ? 'Your request has been sent to your Direct Line Manager for approval. You will be notified once reviewed.'
          : 'Your request has been received by the IT team. Track progress in My Tickets.',
        [{ text: 'View My Tickets', onPress: () => { setTab('mytickets'); loadTickets(); } }]
      );
      setTitle(''); setCategory(''); setPriority('MEDIUM'); setDescription('');
    } catch (e: any) {
      Alert.alert('Submission Failed', e?.message || 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedCat = CATEGORIES.find(c => c.value === category);
  const pendingDlm = tickets.filter(t => t.dlmApprovalStatus === 'PENDING_DLM');
  const otherTickets = tickets.filter(t => t.dlmApprovalStatus !== 'PENDING_DLM');
  const sortedTickets = [...pendingDlm, ...otherTickets];

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Gradient Header */}
      <LinearGradient
        colors={['#0d9488', '#14b8a6', '#2dd4bf']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + (Platform.OS === 'android' ? 36 : 16) }]}
      >
        <View style={styles.headerCircle} />
        <Text style={styles.headerTitle}>IT Service Portal</Text>
        <Text style={styles.headerSubtitle}>Submit and track IT requests</Text>

        {/* Tab row */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 'mytickets' && styles.tabBtnActive]}
            onPress={() => setTab('mytickets')}
            activeOpacity={0.8}
          >
            <Ionicons name="list-outline" size={15} color={tab === 'mytickets' ? '#0d9488' : 'rgba(255,255,255,0.8)'} />
            <Text style={[styles.tabText, tab === 'mytickets' && styles.tabTextActive]}>
              My Tickets{pendingDlm.length > 0 ? `  (${pendingDlm.length})` : ''}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 'submit' && styles.tabBtnActive]}
            onPress={() => setTab('submit')}
            activeOpacity={0.8}
          >
            <Ionicons name="add-circle-outline" size={15} color={tab === 'submit' ? '#0d9488' : 'rgba(255,255,255,0.8)'} />
            <Text style={[styles.tabText, tab === 'submit' && styles.tabTextActive]}>New Request</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* ── My Tickets ── */}
      {tab === 'mytickets' && (
        loading && tickets.length === 0
          ? <View style={styles.loadingBox}><ActivityIndicator size="large" color={theme.colors.primary} /></View>
          : (
            <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
              <FlatList
                data={sortedTickets}
                keyExtractor={item => item.id}
                renderItem={({ item }) => <TicketCard item={item} />}
                contentContainerStyle={[styles.list, sortedTickets.length === 0 && { flexGrow: 1 }]}
                ListHeaderComponent={pendingDlm.length > 0 ? (
                  <View style={styles.pendingBanner}>
                    <Ionicons name="shield-half-outline" size={18} color="#92400e" />
                    <Text style={styles.pendingBannerText}>
                      {pendingDlm.length} request{pendingDlm.length !== 1 ? 's' : ''} awaiting manager approval
                    </Text>
                  </View>
                ) : null}
                ListEmptyComponent={
                  <EmptyState
                    icon="ticket-outline"
                    title="No requests yet"
                    subtitle="Submit a new IT request to get started"
                  />
                }
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
                showsVerticalScrollIndicator={false}
              />
            </Animated.View>
          )
      )}

      {/* ── Submit Form ── */}
      {tab === 'submit' && (
        <ScrollView
          contentContainerStyle={[styles.form, { paddingBottom: insets.bottom + 80 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Category */}
          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>Category *</Text>
            <TouchableOpacity style={styles.picker} onPress={() => setCatModal(true)} activeOpacity={0.8}>
              {selectedCat ? (
                <View style={styles.pickerSelected}>
                  <View style={[styles.catIcon, { backgroundColor: selectedCat.requiresDlm ? theme.colors.amberBg : theme.colors.successBg }]}>
                    <Ionicons name={selectedCat.icon as any} size={18} color={selectedCat.requiresDlm ? theme.colors.amber : theme.colors.success} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pickerValue}>{selectedCat.label}</Text>
                    {selectedCat.requiresDlm && (
                      <Text style={styles.dlmNote}>Requires manager approval</Text>
                    )}
                  </View>
                </View>
              ) : (
                <Text style={styles.pickerPlaceholder}>Select request category…</Text>
              )}
              <Ionicons name="chevron-down" size={18} color={theme.colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* DLM notice */}
          {selectedCat?.requiresDlm && (
            <View style={styles.dlmNotice}>
              <Ionicons name="shield-checkmark-outline" size={20} color="#d97706" />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.dlmNoticeTitle}>Manager Approval Required</Text>
                <Text style={styles.dlmNoticeBody}>
                  This request type requires your Direct Line Manager to approve it before the IT team can action it.
                </Text>
              </View>
            </View>
          )}

          {/* Title */}
          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>Request Title *</Text>
            <TextInput
              style={styles.textField}
              placeholder="e.g. New laptop required for onboarding"
              placeholderTextColor={theme.colors.textMuted}
              value={title}
              onChangeText={setTitle}
              maxLength={120}
            />
          </View>

          {/* Priority */}
          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>Priority</Text>
            <View style={styles.priorityRow}>
              {PRIORITIES.map(p => {
                const meta = PRIORITY_META[p];
                const active = priority === p;
                return (
                  <TouchableOpacity
                    key={p}
                    style={[styles.priorityBtn, active && { backgroundColor: meta.color, borderColor: meta.color }]}
                    onPress={() => setPriority(p)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.priorityBtnText, active && { color: '#fff' }]}>
                      {meta.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Description */}
          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput
              style={[styles.textField, styles.textArea]}
              placeholder="Provide additional details about your request…"
              placeholderTextColor={theme.colors.textMuted}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              maxLength={2000}
            />
            <Text style={styles.charCount}>{description.length}/2000</Text>
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={styles.submitBtn}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={selectedCat?.requiresDlm ? ['#f59e0b', '#d97706'] : ['#4f46e5', '#7c3aed']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.submitGradient}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name={selectedCat?.requiresDlm ? 'shield-checkmark-outline' : 'send-outline'} size={20} color="#fff" />
                  <Text style={styles.submitText}>
                    {selectedCat?.requiresDlm ? 'Submit for Manager Approval' : 'Submit Request'}
                  </Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Category modal */}
      <Modal visible={catModal} transparent animationType="slide" onRequestClose={() => setCatModal(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} onPress={() => setCatModal(false)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Select Category</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat.value}
                  style={[styles.catRow, category === cat.value && styles.catRowActive]}
                  onPress={() => { setCategory(cat.value); setCatModal(false); }}
                  activeOpacity={0.75}
                >
                  <View style={[styles.catIconLg, { backgroundColor: cat.requiresDlm ? '#fef3c7' : '#dcfce7' }]}>
                    <Ionicons name={cat.icon as any} size={22} color={cat.requiresDlm ? '#d97706' : '#16a34a'} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.catLabel}>{cat.label}</Text>
                    {cat.requiresDlm && (
                      <Text style={styles.catNote}>Requires manager approval</Text>
                    )}
                  </View>
                  {category === cat.value && <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: theme.spacing.xl,
    paddingBottom: theme.spacing.xl,
    overflow: 'hidden',
  },
  headerCircle: {
    position: 'absolute', top: -30, right: -30,
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  headerTitle: {
    fontSize: 24, fontWeight: '800', color: '#fff', letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: theme.spacing.lg,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: theme.radius.xl,
    padding: 3,
  },
  tabBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 9, borderRadius: theme.radius.lg,
  },
  tabBtnActive: { backgroundColor: '#fff' },
  tabText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },
  tabTextActive: { color: '#0d9488' },

  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: theme.spacing.lg, paddingBottom: 80 },
  form: { padding: theme.spacing.lg },

  pendingBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fef3c7',
    borderRadius: theme.radius.xl,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    borderWidth: 1, borderColor: '#fcd34d',
  },
  pendingBannerText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#92400e' },

  ticketCard: {
    borderLeftWidth: 4,
    borderRadius: theme.radius.xl,
    marginBottom: theme.spacing.md,
    overflow: 'hidden',
    ...theme.shadows.md,
  },
  ticketGradientBg: {
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  ticketCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
  },
  ticketTitle: { fontSize: 15, fontWeight: '600', color: theme.colors.text, flex: 1 },
  ticketDate: { fontSize: 11, color: theme.colors.textMuted, marginTop: 2 },
  ticketMeta: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center',
  },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: theme.radius.full,
    borderWidth: 1,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },
  categoryChip: {
    backgroundColor: theme.colors.borderLight,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: theme.radius.full,
  },
  categoryChipText: { fontSize: 11, fontWeight: '600', color: theme.colors.textSecondary },
  priorityPill: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: theme.radius.full,
  },
  priorityText: { fontSize: 11, fontWeight: '700' },
  ticketBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: theme.spacing.sm,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    marginTop: 4,
  },
  ticketBannerText: { flex: 1, fontSize: 12, fontWeight: '500', color: '#92400e' },

  // Form styles
  fieldBlock: { marginBottom: theme.spacing.xl },
  fieldLabel: {
    fontSize: 13, fontWeight: '700', color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  picker: {
    flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.lg,
    borderWidth: 1.5, borderColor: theme.colors.border,
    minHeight: 60,
    ...theme.shadows.sm,
  },
  pickerSelected: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  pickerValue: { fontSize: 15, fontWeight: '600', color: theme.colors.text },
  pickerPlaceholder: { flex: 1, fontSize: 15, color: theme.colors.textMuted },
  catIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  dlmNote: { fontSize: 11, color: theme.colors.amber, fontWeight: '500', marginTop: 1 },

  dlmNotice: {
    flexDirection: 'row', gap: 12, alignItems: 'flex-start',
    backgroundColor: '#fffbeb',
    borderRadius: theme.radius.xl,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
    borderWidth: 1, borderColor: '#fcd34d',
  },
  dlmNoticeTitle: { fontSize: 14, fontWeight: '700', color: '#92400e', marginBottom: 2 },
  dlmNoticeBody: { fontSize: 12, color: '#78350f', lineHeight: 18 },

  textField: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.lg,
    fontSize: 15,
    color: theme.colors.text,
    borderWidth: 1.5, borderColor: theme.colors.border,
    minHeight: 50,
    ...theme.shadows.sm,
  },
  textArea: { minHeight: 120, paddingTop: theme.spacing.lg },
  charCount: { fontSize: 11, color: theme.colors.textMuted, textAlign: 'right', marginTop: 4 },

  priorityRow: { flexDirection: 'row', gap: theme.spacing.sm, flexWrap: 'wrap' },
  priorityBtn: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 10,
    borderRadius: theme.radius.xl,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  priorityBtnText: { fontSize: 13, fontWeight: '700', color: theme.colors.textSecondary },

  submitBtn: {
    borderRadius: theme.radius.xl,
    overflow: 'hidden',
    ...theme.shadows.colored,
  },
  submitGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, padding: theme.spacing.xl,
  },
  submitText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: theme.spacing.xl,
    maxHeight: '80%',
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: theme.colors.border,
    alignSelf: 'center', marginBottom: theme.spacing.lg,
  },
  modalTitle: {
    ...theme.typography.titleSmall,
    color: theme.colors.text,
    marginBottom: theme.spacing.lg,
  },
  catRow: {
    flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.borderLight,
  },
  catRowActive: { backgroundColor: theme.colors.primaryXLight },
  catIconLg: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  catLabel: { fontSize: 15, fontWeight: '600', color: theme.colors.text },
  catNote: { fontSize: 11, color: theme.colors.amber, fontWeight: '500', marginTop: 1 },
});
