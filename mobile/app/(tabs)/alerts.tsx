/**
 * Notifications Centre — world-class UI
 *
 * • Live native push notifications via expo-notifications
 * • Real-time badge on bell icon feeds into this list
 * • No Ionicons — all icons drawn with Views (100% reliable on Android)
 * • Categories auto-detected · filter pills · swipe/tap to dismiss
 * • Mark-all-read · Clear-all · grouped time headers · pull-to-refresh
 * • Haptic feedback on interactions
 */
import {
  useState, useEffect, useCallback, useRef, useMemo,
} from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Platform, StatusBar, Animated, RefreshControl, Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import { theme } from '@/constants/theme';

// ─── Types ─────────────────────────────────────────────────────────────────
interface AlertItem {
  id:         string;
  title:      string;
  body:       string;
  data?:      Record<string, unknown>;
  receivedAt: Date;
  read:       boolean;
  category:   Category;
}

type Category =
  | 'ticket' | 'approval' | 'dlm' | 'asset' | 'maintenance'
  | 'alert'  | 'system'   | 'default';

// ─── View-drawn icon primitives ────────────────────────────────────────────
function Row({ children, style }: any) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center' }, style]}>{children}</View>;
}

/** Back arrow */
function BackArrow({ color = '#fff', size = 18 }: { color?: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: size * 0.55, height: size * 0.55, borderLeftWidth: 2.5, borderBottomWidth: 2.5, borderColor: color, transform: [{ rotate: '45deg' }], marginLeft: size * 0.2 }} />
    </View>
  );
}

/** Bell */
function BellSVG({ color = '#fff', size = 22 }: { color?: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center' }}>
      <View style={{ position: 'absolute', top: size * 0.14, left: size * 0.1, right: size * 0.1, height: size * 0.62, backgroundColor: color, borderRadius: size * 0.24 }} />
      <View style={{ position: 'absolute', top: 0, width: size * 0.14, height: size * 0.22, backgroundColor: color, borderRadius: 2, alignSelf: 'center' }} />
      <View style={{ position: 'absolute', bottom: 0, width: size * 0.34, height: size * 0.16, backgroundColor: color, borderRadius: size * 0.08, alignSelf: 'center' }} />
    </View>
  );
}

/** Check-all (two overlapping checks) */
function CheckAllSVG({ color = '#fff', size = 18 }: { color?: string; size?: number }) {
  const t = size * 0.13;
  return (
    <View style={{ width: size, height: size }}>
      <View style={{ position: 'absolute', left: size * 0.04, top: size * 0.42, width: size * 0.28, height: t, backgroundColor: color, transform: [{ rotate: '45deg' }] }} />
      <View style={{ position: 'absolute', left: size * 0.16, top: size * 0.28, width: size * 0.48, height: t, backgroundColor: color, transform: [{ rotate: '-45deg' }] }} />
      <View style={{ position: 'absolute', left: size * 0.24, top: size * 0.48, width: size * 0.22, height: t, backgroundColor: color, transform: [{ rotate: '45deg' }] }} />
      <View style={{ position: 'absolute', left: size * 0.36, top: size * 0.34, width: size * 0.44, height: t, backgroundColor: color, transform: [{ rotate: '-45deg' }] }} />
    </View>
  );
}

/** Trash */
function TrashSVG({ color = '#fff', size = 16 }: { color?: string; size?: number }) {
  const t = size * 0.14;
  return (
    <View style={{ width: size, height: size }}>
      <View style={{ position: 'absolute', top: size * 0.1, left: size * 0.14, right: size * 0.14, height: t, backgroundColor: color, borderRadius: 2 }} />
      <View style={{ position: 'absolute', top: size * 0.26, left: size * 0.18, right: size * 0.18, bottom: size * 0.06, backgroundColor: color, borderRadius: 3 }} />
      <View style={{ position: 'absolute', top: size * 0.06, left: size * 0.38, width: size * 0.24, height: size * 0.2, backgroundColor: color, borderRadius: 2 }} />
    </View>
  );
}

/** Category-specific icons — all view-drawn */
function CatIcon({ cat, size = 20 }: { cat: Category; size?: number }) {
  const t = size * 0.13;
  switch (cat) {
    case 'ticket':
      return (
        <View style={{ width: size, height: size }}>
          <View style={{ position: 'absolute', inset: 0, borderRadius: size * 0.18, borderWidth: t, borderColor: CAT.ticket.color }} />
          <View style={{ position: 'absolute', top: size * 0.36, left: size * 0.24, right: size * 0.24, height: t, backgroundColor: CAT.ticket.color }} />
          <View style={{ position: 'absolute', top: size * 0.55, left: size * 0.24, right: size * 0.42, height: t, backgroundColor: CAT.ticket.color }} />
        </View>
      );
    case 'approval':
      return (
        <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: size * 0.28, height: size * 0.5, borderLeftWidth: t * 1.2, borderBottomWidth: t * 1.2, borderColor: CAT.approval.color, transform: [{ rotate: '-45deg' }], marginTop: -size * 0.1 }} />
        </View>
      );
    case 'dlm':
      return (
        <View style={{ width: size, height: size, alignItems: 'center' }}>
          <View style={{ position: 'absolute', top: 0, width: size * 0.46, height: size * 0.46, borderRadius: size * 0.23, backgroundColor: CAT.dlm.color, opacity: 0.9 }} />
          <View style={{ position: 'absolute', bottom: 0, left: size * 0.06, right: size * 0.06, height: size * 0.38, borderRadius: size * 0.12, backgroundColor: CAT.dlm.color, opacity: 0.9 }} />
        </View>
      );
    case 'asset':
      return (
        <View style={{ width: size, height: size }}>
          <View style={{ position: 'absolute', top: size * 0.08, left: size * 0.14, right: size * 0.14, bottom: size * 0.08, borderRadius: 4, borderWidth: t, borderColor: CAT.asset.color }} />
          <View style={{ position: 'absolute', top: size * 0.28, left: size * 0.28, right: size * 0.28, bottom: size * 0.28, backgroundColor: CAT.asset.color, borderRadius: 2 }} />
        </View>
      );
    case 'maintenance':
      return (
        <View style={{ width: size, height: size }}>
          <View style={{ position: 'absolute', top: size * 0.08, left: size * 0.08, width: size * 0.84, height: size * 0.18, borderRadius: 3, backgroundColor: CAT.maintenance.color }} />
          <View style={{ position: 'absolute', top: size * 0.36, left: size * 0.08, width: size * 0.84, height: size * 0.18, borderRadius: 3, backgroundColor: CAT.maintenance.color }} />
          <View style={{ position: 'absolute', top: size * 0.64, left: size * 0.08, width: size * 0.84, height: size * 0.18, borderRadius: 3, backgroundColor: CAT.maintenance.color }} />
          <View style={{ position: 'absolute', top: size * 0.02, left: size * 0.42, width: size * 0.18, height: size * 0.96, borderRadius: 3, backgroundColor: CAT.maintenance.color }} />
        </View>
      );
    case 'alert':
      return (
        <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 0, height: 0, borderLeftWidth: size * 0.48, borderRightWidth: size * 0.48, borderBottomWidth: size * 0.84, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: CAT.alert.color, opacity: 0.9 }} />
          <View style={{ position: 'absolute', top: size * 0.3, width: t * 1.2, height: size * 0.32, backgroundColor: '#fff', borderRadius: 2 }} />
          <View style={{ position: 'absolute', bottom: size * 0.14, width: t * 1.2, height: t * 1.2, backgroundColor: '#fff', borderRadius: 1 }} />
        </View>
      );
    case 'system':
      return (
        <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ position: 'absolute', width: size * 0.36, height: size * 0.36, borderRadius: size * 0.18, backgroundColor: CAT.system.color }} />
          {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
            <View key={i} style={{ position: 'absolute', width: t * 1.2, height: size * 0.22, backgroundColor: CAT.system.color, borderRadius: 2, top: 0, left: size / 2 - t * 0.6, transform: [{ rotate: `${i * 45}deg` }, { translateY: -(size / 2) + size * 0.08 }] }} />
          ))}
        </View>
      );
    default:
      return <BellSVG color={CAT.default.color} size={size} />;
  }
}

/** Close × */
function CloseIcon({ color = '#94a3b8', size = 16 }: { color?: string; size?: number }) {
  const t = size * 0.14;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ position: 'absolute', width: size * 0.85, height: t, backgroundColor: color, borderRadius: 2, transform: [{ rotate: '45deg' }] }} />
      <View style={{ position: 'absolute', width: size * 0.85, height: t, backgroundColor: color, borderRadius: 2, transform: [{ rotate: '-45deg' }] }} />
    </View>
  );
}

// ─── Category config ────────────────────────────────────────────────────────
const CAT: Record<Category, { bg: string; color: string; label: string; grad: [string, string] }> = {
  ticket:      { bg: '#e0f2fe', color: '#0369a1', label: 'Ticket',      grad: ['#0ea5e9', '#0369a1'] },
  approval:    { bg: '#dcfce7', color: '#15803d', label: 'Approval',    grad: ['#22c55e', '#15803d'] },
  dlm:         { bg: '#ede9fe', color: '#7c3aed', label: 'DLM',         grad: ['#a855f7', '#7c3aed'] },
  asset:       { bg: '#eef2ff', color: '#4338ca', label: 'Asset',       grad: ['#6366f1', '#4338ca'] },
  maintenance: { bg: '#fef3c7', color: '#b45309', label: 'Maintenance', grad: ['#f59e0b', '#b45309'] },
  alert:       { bg: '#fee2e2', color: '#dc2626', label: 'Alert',       grad: ['#f87171', '#dc2626'] },
  system:      { bg: '#f1f5f9', color: '#475569', label: 'System',      grad: ['#94a3b8', '#475569'] },
  default:     { bg: '#f8fafc', color: '#64748b', label: 'Info',        grad: ['#94a3b8', '#64748b'] },
};

function detectCategory(title: string, body: string): Category {
  const t = `${title} ${body}`.toLowerCase();
  if (t.includes('dlm') || t.includes('direct line') || t.includes('line manager')) return 'dlm';
  if (t.includes('approv') || t.includes('reject') || t.includes('authoris'))       return 'approval';
  if (t.includes('ticket') || t.includes('request') || t.includes('issue'))         return 'ticket';
  if (t.includes('asset') || t.includes('inventory') || t.includes('equipment'))    return 'asset';
  if (t.includes('mainten') || t.includes('service') || t.includes('repair'))       return 'maintenance';
  if (t.includes('alert') || t.includes('warn') || t.includes('critical') || t.includes('urgent')) return 'alert';
  if (t.includes('system') || t.includes('update') || t.includes('deploy'))         return 'system';
  return 'default';
}

function timeAgo(date: Date): string {
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 60)     return 'Just now';
  if (s < 3600)   return `${Math.floor(s / 60)}m ago`;
  if (s < 86400)  return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function groupLabel(date: Date): string {
  const now  = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7)  return 'This week';
  return 'Earlier';
}

// ─── Alert card ──────────────────────────────────────────────────────────────
function AlertCard({ item, onPress, onDismiss }: {
  item: AlertItem; onPress: () => void; onDismiss: () => void;
}) {
  const cat      = CAT[item.category] ?? CAT.default;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const slideX   = useRef(new Animated.Value(0)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.97, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  const dismiss = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 220, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
      Animated.timing(slideX,   { toValue: 100, duration: 220, useNativeDriver: true, easing: Easing.in(Easing.quad) }),
    ]).start(onDismiss);
  };

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateX: slideX }, { scale: scaleAnim }] }}>
      <TouchableOpacity
        style={[styles.card, !item.read && styles.cardUnread]}
        onPress={handlePress}
        activeOpacity={0.9}
      >
        {/* Unread accent */}
        {!item.read && (
          <LinearGradient
            colors={cat.grad}
            start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
            style={styles.accentBar}
          />
        )}

        {/* Category icon */}
        <View style={[styles.iconBox, { backgroundColor: cat.bg }]}>
          <CatIcon cat={item.category} size={20} />
        </View>

        {/* Content */}
        <View style={styles.cardContent}>
          <Row style={styles.cardTopRow}>
            <View style={[styles.catChip, { backgroundColor: cat.bg }]}>
              <Text style={[styles.catChipText, { color: cat.color }]}>{cat.label}</Text>
            </View>
            <Text style={styles.timeText}>{timeAgo(item.receivedAt)}</Text>
          </Row>
          <Text
            style={[styles.cardTitle, !item.read && styles.cardTitleUnread]}
            numberOfLines={1}
          >
            {item.title || 'AssetXAI Notification'}
          </Text>
          <Text style={styles.cardBody} numberOfLines={2}>{item.body}</Text>
        </View>

        {/* Unread dot */}
        {!item.read && <View style={[styles.unreadDot, { backgroundColor: cat.color }]} />}

        {/* Dismiss */}
        <TouchableOpacity
          style={styles.dismissBtn}
          onPress={dismiss}
          hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
        >
          <CloseIcon color="#cbd5e1" size={14} />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Filter pill ───────────────────────────────────────────────────────────
function FilterPill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.pill, active && styles.pillActive]}
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }}
      activeOpacity={0.75}
    >
      {active && (
        <LinearGradient
          colors={['#4f46e5', '#7c3aed']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      )}
      <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Stats summary bar ───────────────────────────────────────────────────────
function StatBar({ total, unread }: { total: number; unread: number }) {
  if (total === 0) return null;
  const readPct = total > 0 ? ((total - unread) / total) * 100 : 100;
  return (
    <View style={stats.wrap}>
      <View style={stats.item}>
        <Text style={stats.count}>{total}</Text>
        <Text style={stats.label}>Total</Text>
      </View>
      <View style={stats.divider} />
      <View style={stats.item}>
        <Text style={[stats.count, { color: '#ef4444' }]}>{unread}</Text>
        <Text style={stats.label}>Unread</Text>
      </View>
      <View style={stats.divider} />
      <View style={[stats.item, { flex: 1 }]}>
        <View style={stats.progressTrack}>
          <LinearGradient
            colors={['#22c55e', '#15803d']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={[stats.progressBar, { width: `${readPct}%` as any }]}
          />
        </View>
        <Text style={stats.label}>{Math.round(readPct)}% read</Text>
      </View>
    </View>
  );
}

// ─── Empty state ───────────────────────────────────────────────────────────
function EmptyState({ filter }: { filter: 'all' | Category }) {
  const label = filter === 'all' ? 'No Notifications' : `No ${CAT[filter]?.label ?? filter} alerts`;
  return (
    <View style={empty.wrap}>
      <LinearGradient colors={['#eef2ff', '#ede9fe']} style={empty.iconBox}>
        <BellSVG color="#6366f1" size={44} />
      </LinearGradient>
      <Text style={empty.title}>{label}</Text>
      <Text style={empty.body}>
        {filter === 'all'
          ? 'Alerts for ticket updates, DLM approvals, asset changes, and system events will appear here in real-time.'
          : `No ${CAT[filter as Category]?.label} notifications yet. They'll show here as soon as they arrive.`}
      </Text>
      <View style={empty.hint}>
        <Text style={empty.hintText}>Push notifications deliver instantly</Text>
      </View>
    </View>
  );
}

// ─── Group header ──────────────────────────────────────────────────────────
function GroupHeader({ label }: { label: string }) {
  return (
    <View style={grp.wrap}>
      <View style={grp.line} />
      <Text style={grp.label}>{label}</Text>
      <View style={grp.line} />
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function AlertsScreen() {
  const insets      = useSafeAreaInsets();
  const router      = useRouter();
  const [alerts,     setAlerts]     = useState<AlertItem[]>([]);
  const [filter,     setFilter]     = useState<'all' | Category>('all');
  const [refreshing, setRefreshing] = useState(false);

  const addAlert = useCallback((title: string, body: string, data?: Record<string, unknown>) => {
    const item: AlertItem = {
      id:         `${Date.now()}-${Math.random()}`,
      title:      title || 'AssetXAI',
      body:       body  || '',
      data,
      receivedAt: new Date(),
      read:       false,
      category:   detectCategory(title, body),
    };
    setAlerts(prev => [item, ...prev].slice(0, 100));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  // ── Seed from delivered + subscribe ──────────────────────────────────────
  useEffect(() => {
    Notifications.getPresentedNotificationsAsync()
      .then(ns => {
        const items: AlertItem[] = ns.map(n => ({
          id:         n.request.identifier,
          title:      n.request.content.title  ?? 'AssetXAI',
          body:       n.request.content.body   ?? '',
          data:       (n.request.content.data  ?? {}) as Record<string, unknown>,
          receivedAt: new Date((n.date ?? Date.now()) * 1000),
          read:       true,
          category:   detectCategory(n.request.content.title ?? '', n.request.content.body ?? '') as Category,
        }));
        if (items.length) setAlerts(prev => [...prev, ...items]);
      })
      .catch(() => {});

    const sub = Notifications.addNotificationReceivedListener(n =>
      addAlert(n.request.content.title ?? '', n.request.content.body ?? '',
        (n.request.content.data ?? {}) as Record<string, unknown>)
    );
    const tapSub = Notifications.addNotificationResponseReceivedListener(r => {
      const id = r.notification.request.identifier;
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, read: true } : a));
    });
    return () => {
      Notifications.removeNotificationSubscription(sub);
      Notifications.removeNotificationSubscription(tapSub);
    };
  }, [addAlert]);

  const markAllRead = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setAlerts(prev => prev.map(a => ({ ...a, read: true })));
  }, []);

  const clearAll = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setAlerts([]);
  }, []);

  const displayed = useMemo(
    () => filter === 'all' ? alerts : alerts.filter(a => a.category === filter),
    [alerts, filter]
  );

  const unread = useMemo(() => alerts.filter(a => !a.read).length, [alerts]);

  const filters: ('all' | Category)[] = ['all', 'ticket', 'approval', 'dlm', 'asset', 'alert'];

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Notifications.getPresentedNotificationsAsync()
      .then(ns => {
        const ids = new Set(alerts.map(a => a.id));
        const newItems: AlertItem[] = ns
          .filter(n => !ids.has(n.request.identifier))
          .map(n => ({
            id:         n.request.identifier,
            title:      n.request.content.title  ?? 'AssetXAI',
            body:       n.request.content.body   ?? '',
            data:       (n.request.content.data  ?? {}) as Record<string, unknown>,
            receivedAt: new Date((n.date ?? Date.now()) * 1000),
            read:       true,
            category:   detectCategory(n.request.content.title ?? '', n.request.content.body ?? '') as Category,
          }));
        if (newItems.length) setAlerts(prev => [...newItems, ...prev]);
        setRefreshing(false);
      })
      .catch(() => setRefreshing(false));
  }, [alerts]);

  // Build FlatList data: insert group headers
  const listData = useMemo(() => {
    const result: ({ type: 'header'; label: string; key: string } | (AlertItem & { type: 'item' }))[] = [];
    let lastGroup = '';
    displayed.forEach(item => {
      const g = groupLabel(item.receivedAt);
      if (g !== lastGroup) { result.push({ type: 'header', label: g, key: `hdr-${g}` }); lastGroup = g; }
      result.push({ ...item, type: 'item' });
    });
    return result;
  }, [displayed]);

  const topPad = insets.top + (Platform.OS === 'android' ? 36 : 16);

  return (
    <View style={{ flex: 1, backgroundColor: '#f0f4ff' }}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <LinearGradient
        colors={['#0f0c2e', '#1e1b4b', '#3730a3']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: topPad }]}
      >
        {/* Decorative orbs */}
        <View style={[styles.orb, { top: -60, right: -50, width: 200, height: 200, opacity: 0.07 }]} />
        <View style={[styles.orb, { bottom: -40, left: -30, width: 140, height: 140, opacity: 0.05 }]} />

        {/* Top row: back · spacer · mark-read · clear */}
        <Row style={styles.headerTop}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <BackArrow color="#fff" size={18} />
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          {unread > 0 && (
            <TouchableOpacity style={styles.hdrAction} onPress={markAllRead}>
              <CheckAllSVG color="#fff" size={16} />
              <Text style={styles.hdrActionText}>Mark read</Text>
            </TouchableOpacity>
          )}
          {alerts.length > 0 && (
            <TouchableOpacity style={[styles.hdrAction, { backgroundColor: 'rgba(239,68,68,0.18)', borderColor: 'rgba(239,68,68,0.35)' }]} onPress={clearAll}>
              <TrashSVG color="#fca5a5" size={14} />
            </TouchableOpacity>
          )}
        </Row>

        {/* Bell + title */}
        <Row style={styles.titleRow}>
          <View style={styles.bellOuter}>
            <LinearGradient colors={['rgba(99,102,241,0.35)', 'rgba(124,58,237,0.35)']} style={styles.bellGradBox}>
              <BellSVG color="#fff" size={26} />
            </LinearGradient>
            {unread > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{unread > 9 ? '9+' : unread}</Text>
              </View>
            )}
          </View>
          <View style={{ gap: 3 }}>
            <Text style={styles.headerTitle}>Notifications</Text>
            <Text style={styles.headerSubtitle}>
              {unread > 0
                ? `${unread} unread alert${unread > 1 ? 's' : ''}`
                : 'All caught up — nothing to review'}
            </Text>
          </View>
        </Row>

        {/* Stats */}
        <StatBar total={alerts.length} unread={unread} />

        {/* Filter pills */}
        <FlatList
          data={filters}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={f => f}
          contentContainerStyle={styles.pillsRow}
          renderItem={({ item: f }) => (
            <FilterPill
              label={f === 'all' ? 'All' : (CAT[f as Category]?.label ?? f)}
              active={filter === f}
              onPress={() => setFilter(f)}
            />
          )}
        />
      </LinearGradient>

      {/* ── List ──────────────────────────────────────────────────────────── */}
      <FlatList
        data={listData}
        keyExtractor={item => item.key ?? (item as AlertItem).id}
        renderItem={({ item }) => {
          if (item.type === 'header') {
            return <GroupHeader label={item.label} />;
          }
          const a = item as AlertItem;
          return (
            <AlertCard
              item={a}
              onPress={() => setAlerts(prev => prev.map(x => x.id === a.id ? { ...x, read: true } : x))}
              onDismiss={() => setAlerts(prev => prev.filter(x => x.id !== a.id))}
            />
          );
        }}
        contentContainerStyle={[styles.list, listData.length === 0 && { flexGrow: 1 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" colors={['#4f46e5']} />
        }
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        ListEmptyComponent={<EmptyState filter={filter} />}
      />
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingBottom: 18,
    overflow: 'hidden',
  },
  orb: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: '#fff',
  },

  headerTop:    { marginBottom: 24, gap: 8 },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  hdrAction: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
    paddingVertical: 8, paddingHorizontal: 12,
    borderRadius: 20,
  },
  hdrActionText: { fontSize: 12, fontWeight: '700', color: '#fff' },

  titleRow:   { gap: 14, marginBottom: 16, alignItems: 'center' },
  bellOuter:  { position: 'relative' },
  bellGradBox:{ width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  bellBadge:  { position: 'absolute', top: -6, right: -6, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 2.5, borderColor: '#1e1b4b' },
  bellBadgeText: { fontSize: 9, fontWeight: '900', color: '#fff' },
  headerTitle:    { fontSize: 26, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '500' },

  pillsRow: { gap: 8, paddingVertical: 2 },
  pill: {
    paddingVertical: 8, paddingHorizontal: 16,
    borderRadius: 22, overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
  },
  pillActive:     { borderColor: 'transparent' },
  pillText:       { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.72)' },
  pillTextActive: { fontSize: 13, fontWeight: '700', color: '#fff' },

  list: { padding: 14, paddingBottom: 120 },
  card: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: '#fff',
    borderRadius: 20, padding: 14, gap: 12,
    overflow: 'hidden', position: 'relative',
    shadowColor: '#1e1b4b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 10,
    elevation: 4,
  },
  cardUnread: {
    backgroundColor: '#fafbff',
    borderWidth: 1.5, borderColor: 'rgba(79,70,229,0.14)',
    shadowOpacity: 0.12,
  },
  accentBar: {
    position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, borderRadius: 2,
  },
  iconBox: {
    width: 48, height: 48, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  cardContent:      { flex: 1, gap: 4 },
  cardTopRow:       { justifyContent: 'space-between', marginBottom: 1 },
  catChip: {
    paddingVertical: 3, paddingHorizontal: 9,
    borderRadius: 10,
  },
  catChipText:     { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  timeText:        { fontSize: 11, color: theme.colors.textMuted, fontWeight: '500' },
  cardTitle:       { fontSize: 14, fontWeight: '600', color: '#334155', lineHeight: 19 },
  cardTitleUnread: { fontWeight: '800', color: '#0f172a' },
  cardBody:        { fontSize: 12, color: '#64748b', lineHeight: 17 },
  unreadDot: {
    width: 8, height: 8, borderRadius: 4,
    alignSelf: 'flex-start', marginTop: 4,
    flexShrink: 0,
  },
  dismissBtn: { padding: 4, marginTop: 2, flexShrink: 0 },
});

const stats = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16, paddingVertical: 10, paddingHorizontal: 14,
    marginBottom: 14, gap: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  item:   { alignItems: 'center', gap: 2, minWidth: 44 },
  count:  { fontSize: 18, fontWeight: '900', color: '#fff' },
  label:  { fontSize: 10, color: 'rgba(255,255,255,0.55)', fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.3 },
  divider:{ width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.15)' },
  progressTrack: { width: 70, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.15)', overflow: 'hidden' },
  progressBar:   { height: 5, borderRadius: 3 },
});

const empty = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 16 },
  iconBox: {
    width: 100, height: 100, borderRadius: 34,
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
    shadowColor: '#6366f1', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 20,
  },
  title: { fontSize: 22, fontWeight: '900', color: '#1e293b', textAlign: 'center' },
  body:  { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 21, maxWidth: 280 },
  hint:  {
    backgroundColor: '#eef2ff', paddingVertical: 8, paddingHorizontal: 16,
    borderRadius: 20, borderWidth: 1, borderColor: '#c7d2fe',
  },
  hintText: { fontSize: 12, color: '#4f46e5', fontWeight: '600' },
});

const grp = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 10, marginHorizontal: 2 },
  line: { flex: 1, height: 1, backgroundColor: '#e2e8f0' },
  label: { fontSize: 11, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.6 },
});
