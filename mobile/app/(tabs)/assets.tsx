import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';
import { EmptyState } from '@/components/ui/EmptyState';
import { getAssets, getMyAssets } from '@/lib/api';

type AssetsTab = 'all' | 'mine';

export default function AssetsScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<AssetsTab>('all');
  const [search, setSearch] = useState('');
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === 'mine') {
        const data = await getMyAssets();
        setAssets(Array.isArray(data) ? data : []);
      } else {
        const data = await getAssets(search ? { search } : undefined);
        setAssets(Array.isArray(data) ? data : []);
      }
    } catch {
      setAssets([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab, search]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.7}
      onPress={() => router.push(`/asset/${item.id}` as any)}
    >
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, styles.thumbPlaceholder]}>
          <Ionicons name="cube-outline" size={32} color={theme.colors.textMuted} />
        </View>
      )}
      <View style={styles.cardBody}>
        <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.id}>{item.assetId || item.barcode || item.id}</Text>
        {item.status && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{item.status}</Text>
          </View>
        )}
        {(item.floorNumber || item.roomNumber) && (
          <Text style={styles.loc}>📍 {[item.floorNumber, item.roomNumber].filter(Boolean).join(', ')}</Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.toggle}>
        <TouchableOpacity style={[styles.toggleBtn, tab === 'all' && styles.toggleBtnActive]} onPress={() => setTab('all')}>
          <Text style={[styles.toggleText, tab === 'all' && styles.toggleTextActive]}>All assets</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.toggleBtn, tab === 'mine' && styles.toggleBtnActive]} onPress={() => setTab('mine')}>
          <Text style={[styles.toggleText, tab === 'mine' && styles.toggleTextActive]}>My assets</Text>
        </TouchableOpacity>
      </View>

      {tab === 'all' && (
        <TextInput
          style={styles.search}
          placeholder="Search or locate by name, ID, barcode..."
          placeholderTextColor={theme.colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      )}

      {loading && assets.length === 0 ? (
        <ActivityIndicator size="large" color={theme.colors.primary} style={styles.loader} />
      ) : (
        <FlatList
          data={assets}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={assets.length === 0 ? styles.emptyList : styles.list}
          ListEmptyComponent={
            <EmptyState
              icon="cube-outline"
              title={tab === 'mine' ? 'No assets assigned to you' : 'No assets found'}
              subtitle={tab === 'all' ? 'Try a different search' : 'Assigned assets will appear here'}
            />
          }
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  toggle: { flexDirection: 'row', padding: theme.spacing.lg, paddingBottom: theme.spacing.sm, gap: theme.spacing.sm },
  toggleBtn: { flex: 1, paddingVertical: theme.spacing.md, borderRadius: theme.radius.md, alignItems: 'center', backgroundColor: theme.colors.surface, ...theme.shadows.sm },
  toggleBtnActive: { backgroundColor: theme.colors.primary },
  toggleText: { ...theme.typography.bodyMedium, color: theme.colors.textSecondary },
  toggleTextActive: { color: '#fff' },
  search: { height: 44, marginHorizontal: theme.spacing.lg, marginBottom: theme.spacing.md, paddingHorizontal: theme.spacing.lg, backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, borderWidth: 1.5, borderColor: theme.colors.border, fontSize: 16 },
  list: { padding: theme.spacing.lg, paddingTop: 0, paddingBottom: theme.spacing.xxxl },
  emptyList: { flexGrow: 1, paddingBottom: theme.spacing.xxxl },
  loader: { marginTop: 48 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: theme.spacing.lg, marginBottom: theme.spacing.md, ...theme.shadows.sm },
  thumb: { width: 56, height: 56, borderRadius: theme.radius.md, backgroundColor: theme.colors.borderLight },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1, marginLeft: theme.spacing.md },
  name: { ...theme.typography.bodyMedium, color: theme.colors.text },
  id: { ...theme.typography.caption, color: theme.colors.textMuted, marginTop: 2 },
  badge: { alignSelf: 'flex-start', marginTop: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: theme.radius.sm, backgroundColor: theme.colors.successBg },
  badgeText: { fontSize: 11, fontWeight: '600', color: theme.colors.success },
  loc: { ...theme.typography.caption, color: theme.colors.textSecondary, marginTop: 2 },
});
