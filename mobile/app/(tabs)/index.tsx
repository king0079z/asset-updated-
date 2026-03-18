import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';
import { Card } from '@/components/ui/Card';
import { getDashboardStats, scanAsset } from '@/lib/api';
import type { DashboardStats } from '@/lib/api';

export default function HomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [scanQuery, setScanQuery] = useState('');
  const [scanResult, setScanResult] = useState<any>(null);
  const [scanning, setScanning] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getDashboardStats();
      setStats(data);
    } catch {
      setStats(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
      setScanResult({ error: e?.message || 'Not found' });
    } finally {
      setScanning(false);
    }
  };

  const cardWidth = (width - theme.spacing.lg * 2 - theme.spacing.md) / 2;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
    >
      {/* Quick scan */}
      <Card>
        <Text style={styles.label}>Scan barcode or asset ID</Text>
        <View style={styles.row}>
          <TextInput
            style={styles.input}
            placeholder="Enter or scan"
            placeholderTextColor={theme.colors.textMuted}
            value={scanQuery}
            onChangeText={(t) => { setScanQuery(t); setScanResult(null); }}
            onSubmitEditing={handleScan}
            returnKeyType="search"
          />
          <TouchableOpacity
            style={styles.scanBtn}
            onPress={handleScan}
            disabled={scanning}
          >
            {scanning ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="scan" size={24} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
        {scanResult && (
          <View style={[styles.resultChip, scanResult.error ? styles.resultError : styles.resultSuccess]}>
            {scanResult.error ? (
              <Text style={styles.resultText}>{scanResult.error}</Text>
            ) : (
              <Text style={styles.resultText}>✓ {scanResult.name || scanResult.assetId}</Text>
            )}
          </View>
        )}
      </Card>

      {/* Dashboard stats */}
      <Text style={styles.sectionTitle}>Overview</Text>
      {loading && !stats ? (
        <ActivityIndicator size="large" color={theme.colors.primary} style={styles.loader} />
      ) : stats ? (
        <>
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { width: cardWidth }]}>
              <Ionicons name="cube-outline" size={28} color={theme.colors.primary} />
              <Text style={styles.statValue}>{stats.totalAssets}</Text>
              <Text style={styles.statLabel}>Assets</Text>
            </View>
            <View style={[styles.statCard, { width: cardWidth }]}>
              <Ionicons name="briefcase-outline" size={28} color={theme.colors.info} />
              <Text style={styles.statValue}>{stats.activeVehicleRentals}</Text>
              <Text style={styles.statLabel}>Active rentals</Text>
            </View>
          </View>
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { width: cardWidth }]}>
              <Ionicons name="restaurant-outline" size={28} color={theme.colors.warning} />
              <Text style={styles.statValue}>{stats.totalFoodItems}</Text>
              <Text style={styles.statLabel}>Food items</Text>
            </View>
            <View style={[styles.statCard, { width: cardWidth }]}>
              <Ionicons name="warning-outline" size={28} color={theme.colors.error} />
              <Text style={styles.statValue}>{stats.lowStockItems}</Text>
              <Text style={styles.statLabel}>Low stock</Text>
            </View>
          </View>
          {stats.assetStats?.totalValue != null && stats.assetStats.totalValue > 0 && (
            <Card>
              <Text style={styles.label}>Total asset value</Text>
              <Text style={styles.assetValue}>
                ${Number(stats.assetStats.totalValue).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </Text>
            </Card>
          )}
        </>
      ) : (
        <Card>
          <Text style={styles.muted}>Unable to load dashboard. Pull to refresh.</Text>
        </Card>
      )}

      {/* Shortcuts */}
      <View style={styles.shortcuts}>
        <TouchableOpacity style={styles.shortcut} onPress={() => router.push('/(tabs)/inventory')}>
          <Ionicons name="layers" size={24} color={theme.colors.primary} />
          <Text style={styles.shortcutLabel}>Inventory</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.shortcut} onPress={() => router.push('/(tabs)/work')}>
          <Ionicons name="briefcase" size={24} color={theme.colors.primary} />
          <Text style={styles.shortcutLabel}>Work</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.shortcut} onPress={() => router.push('/(tabs)/assets')}>
          <Ionicons name="list" size={24} color={theme.colors.primary} />
          <Text style={styles.shortcutLabel}>Assets</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xxxl },
  label: { ...theme.typography.label, color: theme.colors.textSecondary, marginBottom: theme.spacing.sm },
  sectionTitle: { ...theme.typography.titleSmall, color: theme.colors.text, marginBottom: theme.spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  input: {
    flex: 1,
    height: theme.touchTargetMinHeight,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.lg,
    fontSize: 16,
  },
  scanBtn: {
    width: theme.touchTargetMinHeight,
    height: theme.touchTargetMinHeight,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultChip: { marginTop: theme.spacing.sm, paddingVertical: theme.spacing.sm, paddingHorizontal: theme.spacing.md, borderRadius: theme.radius.sm },
  resultSuccess: { backgroundColor: theme.colors.successBg },
  resultError: { backgroundColor: theme.colors.errorBg },
  resultText: { ...theme.typography.captionMedium },
  statsRow: { flexDirection: 'row', gap: theme.spacing.md, marginBottom: theme.spacing.md },
  statCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    ...theme.shadows.sm,
  },
  statValue: { fontSize: 24, fontWeight: '700', color: theme.colors.text, marginTop: theme.spacing.sm },
  statLabel: { ...theme.typography.caption, color: theme.colors.textSecondary, marginTop: theme.spacing.xs },
  loader: { marginVertical: theme.spacing.xxl },
  assetValue: { fontSize: 20, fontWeight: '700', color: theme.colors.primary },
  muted: { ...theme.typography.caption, color: theme.colors.textMuted },
  shortcuts: { flexDirection: 'row', gap: theme.spacing.md, marginTop: theme.spacing.lg },
  shortcut: { flex: 1, backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: theme.spacing.lg, alignItems: 'center', ...theme.shadows.sm },
  shortcutLabel: { ...theme.typography.captionMedium, color: theme.colors.text, marginTop: theme.spacing.xs },
});
