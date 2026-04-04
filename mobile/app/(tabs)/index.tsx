import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, RefreshControl, ActivityIndicator, Platform,
  StatusBar, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/constants/theme';
import { StatCard } from '@/components/ui/StatCard';
import { QuickAction } from '@/components/ui/QuickAction';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { getDashboardStats, scanAsset, getMyTickets } from '@/lib/api';
import type { DashboardStats } from '@/lib/api';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentTickets, setRecentTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [scanQuery, setScanQuery] = useState('');
  const [scanResult, setScanResult] = useState<any>(null);
  const [scanning, setScanning] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    try {
      const [data, tickets] = await Promise.all([
        getDashboardStats(),
        getMyTickets().catch(() => []),
      ]);
      setStats(data);
      setRecentTickets(Array.isArray(tickets) ? tickets.slice(0, 5) : []);
    } catch {
      setStats(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setScanResult(null);
    load();
  }, [load]);

  const handleScan = async () => {
    if (!scanQuery.trim()) return;
    setScanning(true);
    setScanResult(null);
    try {
      const asset = await scanAsset(scanQuery.trim());
      setScanResult(asset);
      if (asset?.id) setTimeout(() => router.push(`/asset/${asset.id}` as any), 800);
    } catch (e: any) {
      setScanResult({ error: e?.message || 'Asset not found' });
    } finally {
      setScanning(false);
    }
  };

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);

  const ticketStatusColor = (s: string) => {
    if (s === 'OPEN') return theme.colors.info;
    if (s === 'IN_PROGRESS') return theme.colors.warning;
    if (s === 'RESOLVED' || s === 'CLOSED') return theme.colors.success;
    if (s === 'PENDING_DLM') return theme.colors.amber;
    return theme.colors.textMuted;
  };

  const ticketStatusLabel = (s: string) => {
    const map: Record<string, string> = {
      OPEN: 'Open', IN_PROGRESS: 'In Progress', RESOLVED: 'Resolved',
      CLOSED: 'Closed', PENDING_DLM: 'Awaiting Approval', DLM_APPROVED: 'Approved', DLM_REJECTED: 'Rejected',
    };
    return map[s] ?? s;
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Gradient Header */}
      <LinearGradient
        colors={['#3730a3', '#4f46e5', '#7c3aed']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + (Platform.OS === 'android' ? 36 : 16) }]}
      >
        {/* Background decoration */}
        <View style={styles.headerCircle1} />
        <View style={styles.headerCircle2} />

        <View style={styles.headerContent}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>{getGreeting()} 👋</Text>
            <Text style={styles.appName}>AssetXAI</Text>
            <Text style={styles.appSubtitle}>Enterprise Asset Management</Text>
          </View>
          <TouchableOpacity
            style={styles.notifBtn}
            onPress={() => router.push('/(tabs)/portal' as any)}
          >
            <Ionicons name="notifications-outline" size={22} color="#fff" />
            {recentTickets.some(t => t.dlmApprovalStatus === 'PENDING_DLM') && (
              <View style={styles.notifDot} />
            )}
          </TouchableOpacity>
        </View>

        {/* Scan bar */}
        <View style={styles.scanBar}>
          <Ionicons name="search-outline" size={18} color={theme.colors.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Scan barcode or enter asset ID…"
            placeholderTextColor={theme.colors.textMuted}
            value={scanQuery}
            onChangeText={t => { setScanQuery(t); setScanResult(null); }}
            onSubmitEditing={handleScan}
            returnKeyType="search"
          />
          <TouchableOpacity style={styles.scanBtn} onPress={handleScan} disabled={scanning}>
            {scanning
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="scan-outline" size={18} color="#fff" />}
          </TouchableOpacity>
        </View>

        {scanResult && (
          <View style={[styles.scanResult, scanResult.error ? styles.scanError : styles.scanSuccess]}>
            <Ionicons
              name={scanResult.error ? 'close-circle' : 'checkmark-circle'}
              size={16}
              color={scanResult.error ? theme.colors.error : theme.colors.success}
            />
            <Text style={[styles.scanResultText, { color: scanResult.error ? theme.colors.error : theme.colors.success }]}>
              {scanResult.error ? scanResult.error : `Found: ${scanResult.name || scanResult.assetId}`}
            </Text>
          </View>
        )}
      </LinearGradient>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeAnim }}>

          {/* Quick Actions */}
          <View style={styles.section}>
            <SectionHeader title="Quick Actions" />
            <View style={styles.quickActions}>
              <QuickAction
                icon="camera-outline"
                label="Scan Asset"
                color="#4f46e5"
                bgColor="#eef2ff"
                onPress={() => router.push('/(tabs)/inventory' as any)}
              />
              <QuickAction
                icon="ticket-outline"
                label="IT Ticket"
                color="#0ea5e9"
                bgColor="#e0f2fe"
                onPress={() => router.push('/(tabs)/portal' as any)}
              />
              <QuickAction
                icon="clipboard-outline"
                label="Audit"
                color="#16a34a"
                bgColor="#dcfce7"
                onPress={() => router.push('/(tabs)/inventory' as any)}
              />
              <QuickAction
                icon="briefcase-outline"
                label="Work Queue"
                color="#d97706"
                bgColor="#fef3c7"
                onPress={() => router.push('/(tabs)/work' as any)}
              />
              <QuickAction
                icon="ellipsis-horizontal"
                label="All Apps"
                color="#7c3aed"
                bgColor="#f5f3ff"
                onPress={() => router.push('/(tabs)/more' as any)}
              />
            </View>
          </View>

          {/* KPI Stats */}
          <View style={styles.section}>
            <SectionHeader
              title="Dashboard Overview"
              actionLabel="All Assets"
              onAction={() => router.push('/(tabs)/assets' as any)}
            />
            {loading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={styles.loadingText}>Loading dashboard…</Text>
              </View>
            ) : stats ? (
              <>
                <View style={styles.statsRow}>
                  <StatCard
                    label="Total Assets"
                    value={stats.totalAssets ?? 0}
                    icon="cube-outline"
                    gradient={['#4f46e5', '#7c3aed']}
                    onPress={() => router.push('/(tabs)/assets' as any)}
                  />
                  <StatCard
                    label="Active Rentals"
                    value={stats.activeVehicleRentals ?? 0}
                    icon="car-outline"
                    gradient={['#0ea5e9', '#0284c7']}
                    onPress={() => router.push('/(tabs)/more' as any)}
                  />
                </View>
                <View style={styles.statsRow}>
                  <StatCard
                    label="Food Items"
                    value={stats.totalFoodItems ?? 0}
                    icon="restaurant-outline"
                    gradient={['#f59e0b', '#d97706']}
                    onPress={() => router.push('/(tabs)/more' as any)}
                  />
                  <StatCard
                    label="Low Stock"
                    value={stats.lowStockItems ?? 0}
                    icon="warning-outline"
                    gradient={stats.lowStockItems > 0 ? ['#ef4444', '#dc2626'] : ['#16a34a', '#15803d']}
                    onPress={() => router.push('/(tabs)/assets' as any)}
                  />
                </View>

                {/* Asset value banner */}
                {stats.assetStats?.totalValue != null && stats.assetStats.totalValue > 0 && (
                  <LinearGradient
                    colors={['#1e293b', '#0f172a']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.valueBanner}
                  >
                    <View>
                      <Text style={styles.valueBannerLabel}>Total Portfolio Value</Text>
                      <Text style={styles.valueBannerValue}>
                        {formatCurrency(Number(stats.assetStats.totalValue))}
                      </Text>
                    </View>
                    <View style={styles.valueBannerIcon}>
                      <Ionicons name="trending-up" size={28} color="#818cf8" />
                    </View>
                  </LinearGradient>
                )}
              </>
            ) : (
              <View style={styles.emptyCard}>
                <Ionicons name="cloud-offline-outline" size={40} color={theme.colors.textMuted} />
                <Text style={styles.emptyText}>Unable to load dashboard</Text>
                <Text style={styles.emptySubtext}>Pull down to refresh</Text>
              </View>
            )}
          </View>

          {/* Recent Tickets */}
          {recentTickets.length > 0 && (
            <View style={styles.section}>
              <SectionHeader
                title="Recent IT Tickets"
                icon="ticket-outline"
                actionLabel="View All"
                onAction={() => router.push('/(tabs)/portal' as any)}
              />
              <View style={styles.ticketList}>
                {recentTickets.map(ticket => (
                  <TouchableOpacity
                    key={ticket.id}
                    style={[
                      styles.ticketRow,
                      ticket.dlmApprovalStatus === 'PENDING_DLM' && styles.ticketRowPending,
                    ]}
                    onPress={() => router.push(`/ticket/${ticket.id}` as any)}
                    activeOpacity={0.75}
                  >
                    <View style={[
                      styles.ticketStatusBar,
                      { backgroundColor: ticketStatusColor(ticket.dlmApprovalStatus ?? ticket.status) }
                    ]} />
                    <View style={{ flex: 1, paddingLeft: 12 }}>
                      <Text style={styles.ticketTitle} numberOfLines={1}>{ticket.title}</Text>
                      <View style={styles.ticketMeta}>
                        <Text style={styles.ticketCategory}>{ticket.category}</Text>
                        <Text style={styles.ticketDot}>·</Text>
                        <Text style={[styles.ticketStatus, { color: ticketStatusColor(ticket.dlmApprovalStatus ?? ticket.status) }]}>
                          {ticketStatusLabel(ticket.dlmApprovalStatus ?? ticket.status)}
                        </Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Bottom spacer */}
          <View style={{ height: 32 }} />
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: theme.spacing.xl,
    paddingBottom: theme.spacing.xl,
    overflow: 'hidden',
  },
  headerCircle1: {
    position: 'absolute', top: -40, right: -40,
    width: 180, height: 180, borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  headerCircle2: {
    position: 'absolute', top: 40, right: 60,
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.xl,
  },
  greeting: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.75)',
    marginBottom: 2,
  },
  appName: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
  },
  appSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  notifBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  notifDot: {
    position: 'absolute', top: 8, right: 8,
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#ef4444',
    borderWidth: 1.5, borderColor: '#4f46e5',
  },
  scanBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: theme.radius.xl,
    paddingLeft: theme.spacing.md,
    height: 48,
    ...theme.shadows.sm,
  },
  searchIcon: { marginRight: 6 },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.text,
    height: 48,
  },
  scanBtn: {
    width: 48,
    height: 48,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanResult: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: theme.spacing.sm,
    backgroundColor: '#fff',
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
  },
  scanSuccess: { backgroundColor: theme.colors.successLight },
  scanError:   { backgroundColor: theme.colors.errorLight },
  scanResultText: { fontSize: 13, fontWeight: '600', flex: 1 },

  content: {
    padding: theme.spacing.xl,
    paddingBottom: 120,
  },
  section: {
    marginBottom: theme.spacing.xxl,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    ...theme.shadows.md,
  },
  statsRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  loadingBox: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xxxl,
    gap: theme.spacing.md,
  },
  loadingText: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  valueBanner: {
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...theme.shadows.lg,
  },
  valueBannerLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  valueBannerValue: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
  },
  valueBannerIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xxxl,
    alignItems: 'center',
    gap: theme.spacing.sm,
    ...theme.shadows.sm,
  },
  emptyText: { ...theme.typography.bodyMedium, color: theme.colors.text },
  emptySubtext: { ...theme.typography.caption, color: theme.colors.textMuted },
  ticketList: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    overflow: 'hidden',
    ...theme.shadows.md,
  },
  ticketRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    paddingRight: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  ticketRowPending: {
    backgroundColor: theme.colors.amberBg,
  },
  ticketStatusBar: {
    width: 4,
    height: '80%',
    borderRadius: 2,
    marginLeft: theme.spacing.lg,
  },
  ticketTitle: {
    ...theme.typography.bodyMedium,
    color: theme.colors.text,
    marginBottom: 2,
  },
  ticketMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ticketCategory: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  ticketDot: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  ticketStatus: {
    fontSize: 12,
    fontWeight: '600',
  },
});
