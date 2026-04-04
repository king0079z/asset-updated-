import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, FlatList, StyleSheet, TouchableOpacity,
  Image, RefreshControl, ActivityIndicator, Platform, StatusBar, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/constants/theme';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { getAssets, getMyAssets } from '@/lib/api';

type Tab = 'all' | 'mine';

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'error' | 'info' | 'muted'> = {
  ACTIVE: 'success',
  AVAILABLE: 'success',
  IN_USE: 'info',
  UNDER_MAINTENANCE: 'warning',
  DECOMMISSIONED: 'error',
  DISPOSED: 'error',
};

export default function AssetsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('all');
  const [search, setSearch] = useState('');
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = tab === 'mine'
        ? await getMyAssets()
        : await getAssets(search ? { search } : undefined);
      setAssets(Array.isArray(data) ? data : []);
    } catch {
      setAssets([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    }
  }, [tab, search]);

  useEffect(() => {
    fadeAnim.setValue(0);
    load();
  }, [load]);

  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, [load]);

  const renderItem = ({ item }: { item: any }) => {
    const statusVariant = STATUS_VARIANT[item.status] ?? 'muted';
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.75}
        onPress={() => router.push(`/asset/${item.id}` as any)}
      >
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={styles.thumb} />
        ) : (
          <LinearGradient colors={['#eef2ff', '#e0e7ff']} style={styles.thumbPlaceholder}>
            <Ionicons name="cube-outline" size={26} color={theme.colors.primary} />
          </LinearGradient>
        )}
        <View style={styles.cardBody}>
          <Text style={styles.assetName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.assetId} numberOfLines={1}>
            {item.assetId || item.barcode || item.id?.slice(0, 8)}
          </Text>
          <View style={styles.cardMeta}>
            {item.status && (
              <Badge label={item.status} variant={statusVariant} size="sm" />
            )}
            {(item.floorNumber || item.roomNumber) && (
              <View style={styles.locationChip}>
                <Ionicons name="location-outline" size={10} color={theme.colors.textMuted} />
                <Text style={styles.locationText} numberOfLines={1}>
                  {[item.floorNumber, item.roomNumber].filter(Boolean).join(', ')}
                </Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.cardArrow}>
          <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Gradient Header */}
      <LinearGradient
        colors={['#0284c7', '#0ea5e9', '#38bdf8']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + (Platform.OS === 'android' ? 36 : 16) }]}
      >
        <View style={styles.headerCircle} />
        <Text style={styles.headerTitle}>Assets</Text>
        <Text style={styles.headerSubtitle}>Manage and track your assets</Text>

        {/* Tab Selector */}
        <View style={styles.tabRow}>
          {(['all', 'mine'] as Tab[]).map(t => (
            <TouchableOpacity
              key={t}
              style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
              onPress={() => setTab(t)}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {t === 'all' ? 'All Assets' : 'My Assets'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </LinearGradient>

      {/* Search bar */}
      {tab === 'all' && (
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={18} color={theme.colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search name, ID, barcode…"
              placeholderTextColor={theme.colors.textMuted}
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={18} color={theme.colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {loading && assets.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading assets…</Text>
        </View>
      ) : (
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
          <FlatList
            data={assets}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            contentContainerStyle={[
              styles.list,
              assets.length === 0 && { flexGrow: 1 },
            ]}
            ListHeaderComponent={
              assets.length > 0 ? (
                <Text style={styles.countLabel}>{assets.length} asset{assets.length !== 1 ? 's' : ''}</Text>
              ) : null
            }
            ListEmptyComponent={
              <EmptyState
                icon="cube-outline"
                title={tab === 'mine' ? 'No assets assigned to you' : 'No assets found'}
                subtitle={tab === 'all' ? 'Try a different search term' : 'Assets assigned to you will appear here'}
              />
            }
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
            }
            showsVerticalScrollIndicator={false}
          />
        </Animated.View>
      )}
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
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: theme.spacing.lg,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: theme.radius.xl,
    padding: 3,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: theme.radius.lg,
    alignItems: 'center',
  },
  tabBtnActive: {
    backgroundColor: '#fff',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
  },
  tabTextActive: {
    color: theme.colors.info,
  },
  searchContainer: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.background,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    paddingHorizontal: theme.spacing.lg,
    height: 46,
    ...theme.shadows.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.text,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
  },
  loadingText: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  list: {
    padding: theme.spacing.lg,
    paddingBottom: 100,
  },
  countLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: theme.spacing.md,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    marginBottom: theme.spacing.md,
    overflow: 'hidden',
    ...theme.shadows.md,
  },
  thumb: {
    width: 72,
    height: 72,
  },
  thumbPlaceholder: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    flex: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    gap: 3,
  },
  assetName: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
  },
  assetId: {
    fontSize: 12,
    color: theme.colors.textMuted,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  locationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: theme.colors.borderLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  locationText: {
    fontSize: 10,
    color: theme.colors.textMuted,
    fontWeight: '500',
  },
  cardArrow: {
    paddingRight: theme.spacing.md,
  },
});
