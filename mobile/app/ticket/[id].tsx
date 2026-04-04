import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert, Platform,
  StatusBar, Animated, Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/constants/theme';
import { Badge } from '@/components/ui/Badge';
import { API_URL } from '@/constants/config';
import { getTicket, updateTicketStatus } from '@/lib/api';

// ── DLM approval progress chain ─────────────────────────────────────────────
const DLM_STEPS = [
  { key: 'submitted',     label: 'Submitted',        icon: 'send-outline'             as const },
  { key: 'dlm_review',    label: 'Manager Review',   icon: 'shield-half-outline'      as const },
  { key: 'it_processing', label: 'IT Processing',    icon: 'construct-outline'        as const },
  { key: 'resolved',      label: 'Resolved',         icon: 'checkmark-circle-outline' as const },
];

function getDlmStep(ticket: any): number {
  const s = ticket.dlmApprovalStatus;
  if (s === 'PENDING_DLM')  return 1;
  if (s === 'DLM_REJECTED') return 1;
  if (s === 'DLM_APPROVED') {
    if (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') return 3;
    return 2;
  }
  if (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') return 3;
  if (ticket.status === 'IN_PROGRESS') return 2;
  return 0;
}

function ApprovalChain({ ticket }: { ticket: any }) {
  const rejected = ticket.dlmApprovalStatus === 'DLM_REJECTED';
  const currentStep = getDlmStep(ticket);

  return (
    <View style={c.chain}>
      <Text style={c.chainTitle}>Approval Chain</Text>
      <View style={c.stepsRow}>
        {DLM_STEPS.map((step, idx) => {
          const done    = idx < currentStep;
          const active  = idx === currentStep;
          const isReject = rejected && idx === 1;
          const color = isReject ? theme.colors.error
                      : done     ? theme.colors.success
                      : active   ? theme.colors.primary
                      :            theme.colors.textMuted;
          return (
            <View key={step.key} style={{ flex: 1, alignItems: 'center' }}>
              {/* Connector line */}
              {idx > 0 && (
                <View style={[c.connector, { backgroundColor: done || active ? color : theme.colors.border }]} />
              )}
              {/* Step circle */}
              <View style={[c.stepCircle, {
                backgroundColor: (done || active) && !isReject ? color + '18' : isReject ? theme.colors.errorBg : theme.colors.borderLight,
                borderColor: color,
                borderWidth: active || done || isReject ? 2 : 1,
              }]}>
                <Ionicons
                  name={isReject ? 'close-circle-outline' : done ? 'checkmark-circle' : step.icon}
                  size={20}
                  color={color}
                  allowFontScaling={false}
                />
              </View>
              <Text style={[c.stepLabel, { color }]} numberOfLines={2}>{step.label}</Text>
            </View>
          );
        })}
      </View>
      {rejected && (
        <View style={c.rejectedBanner}>
          <Ionicons name="alert-circle-outline" size={16} color={theme.colors.error} allowFontScaling={false} />
          <Text style={c.rejectedText}>Rejected by manager — contact your DLM for details</Text>
        </View>
      )}
    </View>
  );
}

// ── Status badge variant ─────────────────────────────────────────────────────
function ticketBadgeVariant(status: string): 'info' | 'warning' | 'success' | 'muted' | 'error' {
  if (status === 'OPEN')        return 'info';
  if (status === 'IN_PROGRESS') return 'warning';
  if (status === 'RESOLVED')    return 'success';
  if (status === 'CLOSED')      return 'muted';
  return 'muted';
}

export default function TicketDetailScreen() {
  const { id }  = useLocalSearchParams<{ id: string }>();
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const [ticket,    setTicket]    = useState<any>(null);
  const [loading,   setLoading]   = useState(true);
  const [refreshing,setRefreshing]= useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

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
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const setStatus = (status: string) => {
    if (!id) return;
    Alert.alert('Update Status', `Set ticket to "${status.replace('_', ' ')}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        onPress: () => updateTicketStatus(id, status).then(load).catch(e => Alert.alert('Error', e?.message)),
      },
    ]);
  };

  if (!id || (!loading && !ticket)) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <Ionicons name="ticket-outline" size={48} color={theme.colors.textMuted} allowFontScaling={false} />
        <Text style={styles.centeredText}>Ticket not found</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
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

  const hasDlm = ticket.dlmApprovalStatus != null;
  const isPendingDlm = ticket.dlmApprovalStatus === 'PENDING_DLM';

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Gradient header */}
      <LinearGradient
        colors={['#0d9488', '#14b8a6', '#2dd4bf']}
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
              {ticket.title || ticket.subject || 'Ticket'}
            </Text>
            <View style={styles.headerMeta}>
              {ticket.displayId && <Text style={styles.headerId}>#{ticket.displayId}</Text>}
              <Badge
                label={ticket.status?.replace('_', ' ') ?? 'OPEN'}
                variant={ticketBadgeVariant(ticket.status)}
                size="sm"
              />
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
          {/* DLM pending notice */}
          {isPendingDlm && (
            <View style={styles.dlmPendingBanner}>
              <Ionicons name="hourglass-outline" size={20} color="#92400e" allowFontScaling={false} />
              <View style={{ flex: 1 }}>
                <Text style={styles.dlmPendingTitle}>Awaiting Manager Approval</Text>
                <Text style={styles.dlmPendingBody}>
                  Your request is pending approval from your Direct Line Manager before it can be actioned by the IT team.
                </Text>
              </View>
            </View>
          )}

          {/* DLM Approval Chain */}
          {hasDlm && <ApprovalChain ticket={ticket} />}

          {/* Details card */}
          <View style={styles.card}>
            {ticket.category && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Category</Text>
                <Text style={styles.detailValue}>{ticket.category.replace(/_/g, ' ')}</Text>
              </View>
            )}
            {ticket.priority && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Priority</Text>
                <Badge
                  label={ticket.priority}
                  variant={ticket.priority === 'CRITICAL' ? 'error' : ticket.priority === 'HIGH' ? 'error' : ticket.priority === 'MEDIUM' ? 'warning' : 'success'}
                  size="sm"
                />
              </View>
            )}
            {ticket.asset?.name && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Asset</Text>
                <Text style={styles.detailValue}>{ticket.asset.name}</Text>
              </View>
            )}
            {ticket.assignedTo?.name && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Assigned To</Text>
                <Text style={styles.detailValue}>{ticket.assignedTo.name}</Text>
              </View>
            )}
            {ticket.createdAt && (
              <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.detailLabel}>Submitted</Text>
                <Text style={styles.detailValue}>{new Date(ticket.createdAt).toLocaleDateString()}</Text>
              </View>
            )}
          </View>

          {/* Description */}
          {ticket.description && (
            <View style={styles.card}>
              <Text style={styles.cardSectionTitle}>Description</Text>
              <Text style={styles.descText}>{ticket.description}</Text>
            </View>
          )}

          {/* Status actions (only for IT staff — won't harm regular users) */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Update Status</Text>
            <View style={styles.actionsRow}>
              {(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const).map(s => {
                const active = ticket.status === s;
                const gradients: Record<string, [string, string]> = {
                  OPEN:        ['#0ea5e9', '#0284c7'],
                  IN_PROGRESS: ['#f59e0b', '#d97706'],
                  RESOLVED:    ['#16a34a', '#15803d'],
                  CLOSED:      ['#64748b', '#475569'],
                };
                return (
                  <TouchableOpacity
                    key={s}
                    style={[styles.actionBtn, active && styles.actionBtnActive]}
                    onPress={() => !active && setStatus(s)}
                    activeOpacity={active ? 1 : 0.75}
                  >
                    {active && (
                      <LinearGradient colors={gradients[s]} style={StyleSheet.absoluteFill} />
                    )}
                    <Text style={[styles.actionBtnText, active && { color: '#fff' }]}>
                      {s.replace('_', ' ')}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Web link */}
          <TouchableOpacity
            style={styles.webLink}
            onPress={() => Linking.openURL(`${API_URL}/tickets/${id}`)}
            activeOpacity={0.85}
          >
            <LinearGradient colors={['#0d9488', '#14b8a6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.webLinkInner}>
              <Ionicons name="globe-outline" size={20} color="#fff" allowFontScaling={false} />
              <Text style={styles.webLinkText}>Open Full Ticket on Web</Text>
              <Ionicons name="arrow-forward" size={16} color="rgba(255,255,255,0.7)" allowFontScaling={false} />
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const c = StyleSheet.create({
  chain: {
    backgroundColor: theme.colors.surface,
    margin: theme.spacing.lg,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    ...theme.shadows.md,
  },
  chainTitle: {
    fontSize: 11, fontWeight: '700', color: theme.colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: theme.spacing.lg,
  },
  stepsRow: { flexDirection: 'row', alignItems: 'flex-start', position: 'relative' },
  connector: {
    position: 'absolute', top: 20, right: '50%', left: '-50%',
    height: 2, zIndex: 0,
  },
  stepCircle: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    zIndex: 1,
  },
  stepLabel: {
    fontSize: 9, fontWeight: '700', textAlign: 'center',
    textTransform: 'uppercase', letterSpacing: 0.3,
    marginTop: 6, maxWidth: 64,
  },
  rejectedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: theme.colors.errorBg,
    borderRadius: theme.radius.lg, padding: theme.spacing.md,
    marginTop: theme.spacing.lg,
    borderWidth: 1, borderColor: '#fecaca',
  },
  rejectedText: { flex: 1, fontSize: 12, color: theme.colors.error, fontWeight: '500' },
});

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
  headerMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerId:   { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },

  dlmPendingBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: '#fef3c7',
    margin: theme.spacing.lg,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.lg,
    borderWidth: 1, borderColor: '#fcd34d',
  },
  dlmPendingTitle: { fontSize: 14, fontWeight: '700', color: '#92400e', marginBottom: 3 },
  dlmPendingBody:  { fontSize: 12, color: '#78350f', lineHeight: 18 },

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
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.sm,
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

  webLink: {
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.xxxl,
    borderRadius: theme.radius.xl,
    overflow: 'hidden',
    ...theme.shadows.md,
  },
  webLinkInner: {
    flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md,
    paddingVertical: theme.spacing.lg, paddingHorizontal: theme.spacing.xl,
  },
  webLinkText: { flex: 1, fontSize: 15, fontWeight: '700', color: '#fff' },
});
