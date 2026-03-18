import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';
import { API_URL } from '@/constants/config';
import { Card } from '@/components/ui/Card';
import { getAsset, updateAssetStatus } from '@/lib/api';

export default function AssetDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const [asset, setAsset] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getAsset(id);
      setAsset(data);
    } catch {
      setAsset(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (asset?.name) navigation.setOptions({ title: asset.name });
  }, [asset?.name, navigation]);

  const setStatus = (status: string) => {
    if (!id) return;
    updateAssetStatus(id, status).then(load).catch((e) => Alert.alert('Error', e?.message));
  };

  if (!id) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Invalid asset</Text>
      </View>
    );
  }

  if (loading && !asset) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!asset) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Asset not found</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const loc = [asset.floorNumber, asset.roomNumber].filter(Boolean).join(', ');

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.colors.primary} />}
    >
      {asset.imageUrl ? (
        <Image source={{ uri: asset.imageUrl }} style={styles.hero} />
      ) : (
        <View style={[styles.hero, styles.heroPlaceholder]}>
          <Ionicons name="cube-outline" size={64} color={theme.colors.textMuted} />
        </View>
      )}
      <View style={styles.header}>
        <Text style={styles.name}>{asset.name}</Text>
        <Text style={styles.id}>{asset.assetId || asset.barcode || asset.id}</Text>
        <View style={[styles.statusBadge, asset.status === 'DISPOSED' && styles.statusDisposed]}>
          <Text style={styles.statusText}>{asset.status}</Text>
        </View>
      </View>

      <Card>
        <Text style={styles.label}>Type</Text>
        <Text style={styles.value}>{asset.type || '—'}</Text>
        {loc ? (
          <>
            <Text style={[styles.label, { marginTop: theme.spacing.lg }]}>Location</Text>
            <Text style={styles.value}>📍 {loc}</Text>
          </>
        ) : null}
        {asset.description ? (
          <>
            <Text style={[styles.label, { marginTop: theme.spacing.lg }]}>Description</Text>
            <Text style={styles.value}>{asset.description}</Text>
          </>
        ) : null}
        {asset.purchaseAmount != null && (
          <>
            <Text style={[styles.label, { marginTop: theme.spacing.lg }]}>Purchase amount</Text>
            <Text style={styles.value}>${Number(asset.purchaseAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
          </>
        )}
      </Card>

      <Text style={styles.sectionTitle}>Quick actions</Text>
      <View style={styles.actions}>
        {['AVAILABLE', 'IN_USE', 'MAINTENANCE', 'RETIRED'].map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.actionBtn, asset.status === s && styles.actionBtnActive]}
            onPress={() => setStatus(s)}
          >
            <Text style={[styles.actionBtnText, asset.status === s && styles.actionBtnTextActive]}>{s.replace('_', ' ')}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.webLink} onPress={() => Linking.openURL(`${API_URL}/assets/${id}`)}>
        <Ionicons name="open-outline" size={20} color={theme.colors.primary} />
        <Text style={styles.webLinkText}>Open full details on web</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { paddingBottom: theme.spacing.xxxl },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background },
  muted: { ...theme.typography.body, color: theme.colors.textMuted },
  backBtn: { marginTop: theme.spacing.lg, paddingVertical: theme.spacing.md, paddingHorizontal: theme.spacing.xl, backgroundColor: theme.colors.primary, borderRadius: theme.radius.md },
  backBtnText: { color: '#fff', fontWeight: '600' },
  hero: { width: '100%', height: 200, backgroundColor: theme.colors.borderLight },
  heroPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  header: { padding: theme.spacing.lg },
  name: { ...theme.typography.title, color: theme.colors.text },
  id: { ...theme.typography.caption, color: theme.colors.textMuted, marginTop: theme.spacing.xs },
  statusBadge: { alignSelf: 'flex-start', marginTop: theme.spacing.md, paddingHorizontal: 12, paddingVertical: 6, borderRadius: theme.radius.md, backgroundColor: theme.colors.successBg },
  statusDisposed: { backgroundColor: theme.colors.errorBg },
  statusText: { ...theme.typography.captionMedium, color: theme.colors.success },
  label: { ...theme.typography.label, color: theme.colors.textSecondary },
  value: { ...theme.typography.body, color: theme.colors.text, marginTop: theme.spacing.xs },
  sectionTitle: { ...theme.typography.titleSmall, color: theme.colors.text, marginHorizontal: theme.spacing.lg, marginBottom: theme.spacing.md },
  actions: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: theme.spacing.lg, gap: theme.spacing.sm },
  actionBtn: { paddingVertical: theme.spacing.sm, paddingHorizontal: theme.spacing.md, borderRadius: theme.radius.md, backgroundColor: theme.colors.surface, borderWidth: 1.5, borderColor: theme.colors.border },
  actionBtnActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  actionBtnText: { ...theme.typography.captionMedium, color: theme.colors.text },
  actionBtnTextActive: { color: '#fff' },
  webLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.spacing.sm, marginTop: theme.spacing.xxl, padding: theme.spacing.lg },
  webLinkText: { ...theme.typography.bodyMedium, color: theme.colors.primary },
});
