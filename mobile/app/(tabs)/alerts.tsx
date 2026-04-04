/**
 * Native Notifications / Alerts centre — world-class UI
 * Receives push notifications from both:
 *   • Native Expo push notifications
 *   • Web app via postMessage bridge (window.AssetXAI.notify())
 *
 * Categories auto-detected from notification content.
 * Full swipe-to-dismiss, mark read, clear all.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Platform, StatusBar, Animated, RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { theme } from '@/constants/theme';

// ── Types ────────────────────────────────────────────────────────────────
interface AlertItem {
  id: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  receivedAt: Date;
  read: boolean;
  category: Category;
}

type Category =
  | 'ticket' | 'approval' | 'dlm' | 'asset' | 'maintenance'
  | 'alert' | 'system' | 'default';

// ── Category config ───────────────────────────────────────────────────────
const CAT: Record<Category, { icon: keyof typeof Ionicons.glyphMap; bg: string; color: string; label: string }> = {
  ticket:      { icon: 'ticket-outline',           bg: '#e0f2fe', color: '#0369a1', label: 'Ticket' },
  approval:    { icon: 'shield-checkmark-outline', bg: '#dcfce7', color: '#15803d', label: 'Approval' },
  dlm:         { icon: 'person-circle-outline',    bg: '#ede9fe', color: '#7c3aed', label: 'DLM' },
  asset:       { icon: 'cube-outline',             bg: '#eef2ff', color: '#4338ca', label: 'Asset' },
  maintenance: { icon: 'construct-outline',        bg: '#fef3c7', color: '#b45309', label: 'Maintenance' },
  alert:       { icon: 'alert-circle-outline',     bg: '#fee2e2', color: '#dc2626', label: 'Alert' },
  system:      { icon: 'settings-outline',         bg: '#f1f5f9', color: '#475569', label: 'System' },
  default:     { icon: 'notifications-outline',    bg: '#f8fafc', color: '#64748b', label: 'Info' },
};

function detectCategory(title: string, body: string): Category {
  const t = `${title} ${body}`.toLowerCase();
  if (t.includes('dlm') || t.includes('manager') || t.includes('direct line')) return 'dlm';
  if (t.includes('approv') || t.includes('reject'))    return 'approval';
  if (t.includes('ticket'))                             return 'ticket';
  if (t.includes('asset'))                              return 'asset';
  if (t.includes('mainten') || t.includes('service'))  return 'maintenance';
  if (t.includes('alert') || t.includes('warn') || t.includes('critical')) return 'alert';
  if (t.includes('system') || t.includes('update'))    return 'system';
  return 'default';
}

function timeAgo(date: Date): string {
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 60)    return 'Just now';
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800)return `${Math.floor(s / 86400)}d ago`;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// ── Alert card ────────────────────────────────────────────────────────────
function AlertCard({
  item, onPress, onDismiss,
}: {
  item: AlertItem; onPress: () => void; onDismiss: () => void;
}) {
  const cat      = CAT[item.category] ?? CAT.default;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideX   = useRef(new Animated.Value(0)).current;

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(slideX,   { toValue: 80, duration: 200, useNativeDriver: true }),
    ]).start(onDismiss);
  };

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateX: slideX }] }}>
      <TouchableOpacity
        style={[styles.card, !item.read && styles.cardUnread]}
        onPress={onPress}
        activeOpacity={0.82}
      >
        {/* Unread accent bar */}
        {!item.read && <View style={[styles.accentBar, { backgroundColor: cat.color }]} />}

        {/* Icon */}
        <View style={[styles.iconBox, { backgroundColor: cat.bg }]}>
          <Ionicons name={cat.icon} size={22} color={cat.color} allowFontScaling={false} />
        </View>

        {/* Content */}
        <View style={styles.cardContent}>
          <View style={styles.cardTopRow}>
            <View style={[styles.catChip, { backgroundColor: cat.bg }]}>
              <Text style={[styles.catChipText, { color: cat.color }]}>{cat.label}</Text>
            </View>
            <Text style={styles.timeText}>{timeAgo(item.receivedAt)}</Text>
          </View>
          <Text style={[styles.cardTitle, !item.read && styles.cardTitleUnread]} numberOfLines={1}>
            {item.title || 'Notification'}
          </Text>
          <Text style={styles.cardBody} numberOfLines={2}>{item.body}</Text>
        </View>

        {/* Dismiss */}
        <TouchableOpacity
          style={styles.dismissBtn}
          onPress={dismiss}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="close-outline" size={18} color={theme.colors.textMuted} allowFontScaling={false} />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Filter pill ───────────────────────────────────────────────────────────
function FilterPill({
  label, active, onPress,
}: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.pill, active && styles.pillActive]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {active && (
        <LinearGradient colors={['#4f46e5', '#7c3aed']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
      )}
      <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────
export default function AlertsScreen() {
  const insets    = useSafeAreaInsets();
  const router    = useRouter();
  const [alerts,     setAlerts]     = useState<AlertItem[]>([]);
  const [filter,     setFilter]     = useState<'all' | Category>('all');
  const [refreshing, setRefreshing] = useState(false);

  const addAlert = useCallback((title: string, body: string, data?: Record<string, any>) => {
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
  }, []);

  // ── Subscribe to push notifications ──────────────────────────────────
  useEffect(() => {
    // Seed from delivered notifications
    Notifications.getPresentedNotificationsAsync()
      .then(ns => {
        const items = ns.map(n => ({
          id:         n.request.identifier,
          title:      n.request.content.title  || 'AssetXAI',
          body:       n.request.content.body   || '',
          data:       (n.request.content.data  || {}) as Record<string, any>,
          receivedAt: new Date((n.date || Date.now()) * 1000),
          read:       true,
          category:   detectCategory(n.request.content.title || '', n.request.content.body || '') as Category,
        }));
        setAlerts(prev => [...prev, ...items]);
      })
      .catch(() => {});

    const sub = Notifications.addNotificationReceivedListener(n => {
      addAlert(
        n.request.content.title || '',
        n.request.content.body  || '',
        (n.request.content.data || {}) as Record<string, any>,
      );
    });

    const tapSub = Notifications.addNotificationResponseReceivedListener(r => {
      const id = r.notification.request.identifier;
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, read: true } : a));
    });

    return () => {
      Notifications.removeNotificationSubscription(sub);
      Notifications.removeNotificationSubscription(tapSub);
    };
  }, [addAlert]);

  const markAllRead = () => setAlerts(prev => prev.map(a => ({ ...a, read: true })));
  const clearAll   = () => setAlerts([]);

  const displayed = filter === 'all' ? alerts : alerts.filter(a => a.category === filter);
  const unread    = alerts.filter(a => !a.read).length;
  const filters: ('all' | Category)[] = ['all', 'ticket', 'approval', 'dlm', 'asset', 'alert'];

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <LinearGradient
        colors={['#1e1b4b', '#3730a3', '#4f46e5']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + (Platform.OS === 'android' ? 36 : 16) }]}
      >
        {/* Decorative circles */}
        <View style={styles.deco1} />
        <View style={styles.deco2} />

        {/* Top row */}
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color="#fff" allowFontScaling={false} />
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          {unread > 0 && (
            <TouchableOpacity style={styles.headerAction} onPress={markAllRead}>
              <Ionicons name="checkmark-done-outline" size={18} color="#fff" allowFontScaling={false} />
              <Text style={styles.headerActionText}>Mark read</Text>
            </TouchableOpacity>
          )}
          {alerts.length > 0 && (
            <TouchableOpacity style={styles.headerAction} onPress={clearAll}>
              <Ionicons name="trash-outline" size={16} color="rgba(255,255,255,0.7)" allowFontScaling={false} />
            </TouchableOpacity>
          )}
        </View>

        {/* Title + badge */}
        <View style={styles.titleRow}>
          <View style={styles.bellWrap}>
            <Ionicons name="notifications" size={24} color="#fff" allowFontScaling={false} />
            {unread > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{unread > 9 ? '9+' : unread}</Text>
              </View>
            )}
          </View>
          <View>
            <Text style={styles.headerTitle}>Notifications</Text>
            <Text style={styles.headerSubtitle}>
              {unread > 0 ? `${unread} unread alert${unread > 1 ? 's' : ''}` : 'All caught up ✓'}
            </Text>
          </View>
        </View>

        {/* Filter pills */}
        <View style={styles.pillsRow}>
          {filters.map(f => (
            <FilterPill
              key={f}
              label={f === 'all' ? 'All' : (CAT[f as Category]?.label ?? f)}
              active={filter === f}
              onPress={() => setFilter(f)}
            />
          ))}
        </View>
      </LinearGradient>

      {/* ── List ────────────────────────────────────────────────────────── */}
      <FlatList
        data={displayed}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <AlertCard
            item={item}
            onPress={() => setAlerts(prev => prev.map(a => a.id === item.id ? { ...a, read: true } : a))}
            onDismiss={() => setAlerts(prev => prev.filter(a => a.id !== item.id))}
          />
        )}
        contentContainerStyle={[styles.list, displayed.length === 0 && { flexGrow: 1 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
        }
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <LinearGradient
              colors={['#eef2ff', '#ede9fe']}
              style={styles.emptyIconBox}
            >
              <Ionicons name="notifications-off-outline" size={44} color="#4f46e5" allowFontScaling={false} />
            </LinearGradient>
            <Text style={styles.emptyTitle}>
              {filter === 'all' ? 'No Notifications' : `No ${CAT[filter as Category]?.label} alerts`}
            </Text>
            <Text style={styles.emptyBody}>
              Alerts for ticket updates, asset changes, DLM approvals, and system events will appear here.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    overflow: 'hidden',
  },
  deco1: {
    position: 'absolute', top: -40, right: -40,
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  deco2: {
    position: 'absolute', bottom: -20, left: -30,
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  headerTop:    { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 8 },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerAction: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingVertical: 7, paddingHorizontal: 12,
    borderRadius: 20,
  },
  headerActionText: { fontSize: 12, fontWeight: '600', color: '#fff' },

  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  bellWrap: { position: 'relative' },
  bellBadge: {
    position: 'absolute', top: -4, right: -4,
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: '#ef4444',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2, borderColor: '#3730a3',
  },
  bellBadgeText: { fontSize: 9, fontWeight: '900', color: '#fff' },
  headerTitle:    { fontSize: 26, fontWeight: '800', color: '#fff', letterSpacing: -0.4 },
  headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 2 },

  pillsRow: { flexDirection: 'row', gap: 8, flexWrap: 'nowrap' },
  pill: {
    paddingVertical: 7, paddingHorizontal: 14,
    borderRadius: 20, overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  pillActive: { borderColor: 'transparent' },
  pillText:      { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.75)' },
  pillTextActive:{ fontSize: 12, fontWeight: '700', color: '#fff' },

  list:     { padding: 16, paddingBottom: 100 },
  card: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 14,
    gap: 12,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardUnread: {
    backgroundColor: '#fafafe',
    borderWidth: 1.5,
    borderColor: 'rgba(79,70,229,0.12)',
  },
  accentBar: {
    position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, borderRadius: 2,
  },
  iconBox: {
    width: 46, height: 46, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  cardContent:  { flex: 1, gap: 3 },
  cardTopRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  catChip: {
    paddingVertical: 2, paddingHorizontal: 8,
    borderRadius: 10,
  },
  catChipText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  timeText:     { fontSize: 11, color: theme.colors.textMuted, fontWeight: '500' },
  cardTitle:     { fontSize: 14, fontWeight: '600', color: '#334155' },
  cardTitleUnread:{ fontWeight: '800', color: '#1e293b' },
  cardBody:      { fontSize: 12, color: '#64748b', lineHeight: 17 },
  dismissBtn:    { padding: 4, marginTop: 2 },

  empty: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: 40, gap: 14,
  },
  emptyIconBox: {
    width: 96, height: 96, borderRadius: 30,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: '#1e293b', textAlign: 'center' },
  emptyBody: {
    fontSize: 14, color: '#64748b',
    textAlign: 'center', lineHeight: 21, maxWidth: 280,
  },
});
