/**
 * Native Alerts / Notifications screen.
 * Shows received push notifications with a native UI.
 * Notifications from both the web app (via bridge) and native triggers appear here.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Platform, StatusBar, RefreshControl, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { theme } from '@/constants/theme';

interface AlertItem {
  id: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  receivedAt: Date;
  read: boolean;
  category?: string;
}

const CATEGORY_META: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  ticket:      { icon: 'ticket-outline',           color: '#0ea5e9' },
  asset:       { icon: 'cube-outline',             color: '#4f46e5' },
  approval:    { icon: 'shield-checkmark-outline', color: '#16a34a' },
  dlm:         { icon: 'person-outline',           color: '#7c3aed' },
  maintenance: { icon: 'construct-outline',        color: '#d97706' },
  alert:       { icon: 'alert-circle-outline',     color: '#dc2626' },
  default:     { icon: 'notifications-outline',    color: '#64748b' },
};

function detectCategory(title: string, body: string): string {
  const text = `${title} ${body}`.toLowerCase();
  if (text.includes('ticket'))                return 'ticket';
  if (text.includes('asset'))                 return 'asset';
  if (text.includes('dlm') || text.includes('manager')) return 'dlm';
  if (text.includes('approv') || text.includes('reject')) return 'approval';
  if (text.includes('mainten'))               return 'maintenance';
  if (text.includes('alert') || text.includes('warn')) return 'alert';
  return 'default';
}

function timeAgo(date: Date): string {
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 60)   return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400)return `${Math.floor(secs / 3600)}h ago`;
  return date.toLocaleDateString();
}

function AlertCard({ item, onPress, onDismiss }: { item: AlertItem; onPress: () => void; onDismiss: () => void }) {
  const meta = CATEGORY_META[item.category ?? 'default'] ?? CATEGORY_META.default;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const dismiss = () => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 220, useNativeDriver: true }).start(onDismiss);
  };

  return (
    <Animated.View style={{ opacity: fadeAnim }}>
      <TouchableOpacity
        style={[styles.card, !item.read && styles.cardUnread]}
        onPress={onPress}
        activeOpacity={0.8}
      >
        {!item.read && <View style={styles.unreadDot} />}
        <View style={[styles.iconBox, { backgroundColor: meta.color + '18', borderColor: meta.color + '30' }]}>
          <Ionicons name={meta.icon} size={22} color={meta.color} allowFontScaling={false} />
        </View>
        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.title || 'Notification'}</Text>
            <Text style={styles.cardTime}>{timeAgo(item.receivedAt)}</Text>
          </View>
          <Text style={styles.cardBody} numberOfLines={2}>{item.body}</Text>
        </View>
        <TouchableOpacity style={styles.dismissBtn} onPress={dismiss} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="close-outline" size={18} color={theme.colors.textMuted} allowFontScaling={false} />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function AlertsScreen() {
  const insets = useSafeAreaInsets();
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const addAlert = useCallback((title: string, body: string, data?: Record<string, any>) => {
    const item: AlertItem = {
      id:         Date.now().toString() + Math.random(),
      title:      title || 'AssetXAI',
      body:       body  || '',
      data:       data,
      receivedAt: new Date(),
      read:       false,
      category:   detectCategory(title, body),
    };
    setAlerts(prev => [item, ...prev].slice(0, 100)); // keep last 100
  }, []);

  // ── Subscribe to push notifications ──────────────────────────────────────
  useEffect(() => {
    // Load notification history from delivered notifications
    Notifications.getPresentedNotificationsAsync().then(notifs => {
      const items: AlertItem[] = notifs.map(n => ({
        id:         n.request.identifier,
        title:      n.request.content.title  || 'AssetXAI',
        body:       n.request.content.body   || '',
        data:       (n.request.content.data  || {}) as Record<string, any>,
        receivedAt: new Date((n.date || Date.now()) * 1000),
        read:       true,
        category:   detectCategory(n.request.content.title || '', n.request.content.body || ''),
      }));
      setAlerts(prev => [...prev, ...items]);
    }).catch(() => {});

    const sub = Notifications.addNotificationReceivedListener(notification => {
      addAlert(
        notification.request.content.title || '',
        notification.request.content.body  || '',
        (notification.request.content.data || {}) as Record<string, any>,
      );
    });

    const tapSub = Notifications.addNotificationResponseReceivedListener(response => {
      // Mark as read when tapped
      const id = response.notification.request.identifier;
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, read: true } : a));
    });

    return () => {
      Notifications.removeNotificationSubscription(sub);
      Notifications.removeNotificationSubscription(tapSub);
    };
  }, [addAlert]);

  const markAllRead = () => setAlerts(prev => prev.map(a => ({ ...a, read: true })));
  const clearAll   = () => setAlerts([]);

  const unreadCount = alerts.filter(a => !a.read).length;

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 600);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Gradient header */}
      <LinearGradient
        colors={['#1e1b4b', '#3730a3', '#4f46e5']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + (Platform.OS === 'android' ? 36 : 16) }]}
      >
        <View style={styles.headerCircle} />
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>Notifications</Text>
            <Text style={styles.headerSubtitle}>
              {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
            </Text>
          </View>
          <View style={styles.headerActions}>
            {unreadCount > 0 && (
              <TouchableOpacity style={styles.headerBtn} onPress={markAllRead}>
                <Ionicons name="checkmark-done-outline" size={20} color="#fff" allowFontScaling={false} />
              </TouchableOpacity>
            )}
            {alerts.length > 0 && (
              <TouchableOpacity style={styles.headerBtn} onPress={clearAll}>
                <Ionicons name="trash-outline" size={18} color="#fff" allowFontScaling={false} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </LinearGradient>

      <FlatList
        data={alerts}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <AlertCard
            item={item}
            onPress={() => setAlerts(prev => prev.map(a => a.id === item.id ? { ...a, read: true } : a))}
            onDismiss={() => setAlerts(prev => prev.filter(a => a.id !== item.id))}
          />
        )}
        contentContainerStyle={[styles.list, alerts.length === 0 && styles.emptyList]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="notifications-outline" size={40} color={theme.colors.primary} allowFontScaling={false} />
            </View>
            <Text style={styles.emptyTitle}>No Notifications</Text>
            <Text style={styles.emptyBody}>
              You'll receive alerts for ticket updates, asset changes, DLM approvals, and system events here.
            </Text>
          </View>
        }
      />
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
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  headerTitle:    { fontSize: 26, fontWeight: '800', color: '#fff', letterSpacing: -0.4 },
  headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  headerActions:  { flexDirection: 'row', gap: 8 },
  headerBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },

  list:      { padding: theme.spacing.lg, paddingBottom: 100 },
  emptyList: { flexGrow: 1 },

  card: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    gap: theme.spacing.md,
    position: 'relative',
    ...theme.shadows.sm,
  },
  cardUnread: {
    borderWidth: 1.5,
    borderColor: theme.colors.primary + '30',
    backgroundColor: theme.colors.primaryXLight,
  },
  unreadDot: {
    position: 'absolute', top: 14, left: 14,
    width: 7, height: 7, borderRadius: 3.5,
    backgroundColor: theme.colors.primary,
    zIndex: 1,
  },
  iconBox: {
    width: 44, height: 44, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, marginLeft: 8,
  },
  cardContent: { flex: 1 },
  cardHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 },
  cardTitle:   { fontSize: 14, fontWeight: '700', color: theme.colors.text, flex: 1, marginRight: 8 },
  cardTime:    { fontSize: 11, color: theme.colors.textMuted, fontWeight: '500' },
  cardBody:    { fontSize: 13, color: theme.colors.textSecondary, lineHeight: 18 },
  dismissBtn:  { padding: 4 },

  empty: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: 40, gap: 12,
  },
  emptyIcon: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: theme.colors.primaryXLight,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: theme.colors.text },
  emptyBody: {
    fontSize: 14, color: theme.colors.textSecondary,
    textAlign: 'center', lineHeight: 20,
  },
});
