import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Image, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert, Linking, Platform,
  StatusBar, Animated,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/constants/theme';
import { Badge } from '@/components/ui/Badge';
import { API_URL } from '@/constants/config';
import { getAsset, updateAssetStatus } from '@/lib/api';

const STATUS_META: Record<string, { label: string; variant: 'success' | 'info' | 'warning' | 'error' | 'muted' }> = {
  ACTIVE:             { label: 'Active',             variant: 'success' },
  AVAILABLE:          { label: 'Available',          variant: 'success' },
  IN_USE:             { label: 'In Use',             variant: 'info'    },
  UNDER_MAINTENANCE:  { label: 'Under Maintenance',  variant: 'warning' },
  DECOMMISSIONED:     { label: 'Decommissioned',     variant: 'error'   },
  DISPOSED:           { label: 'Disposed',           variant: 'error'   },
  RETIRED:            { label: 'Retired',            variant: 'muted'   },
  MAINTENANCE:        { label: 'Maintenance',        variant: 'warning' },
};

function InfoRow({ label, value, icon }: { label: string; value: string; icon?: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={styles.infoRow}>
      {icon && <Ionicons name={icon} size={16} color={theme.colors.primary} allowFontScaling={false} style={styles.infoIcon} />}
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

export default function AssetDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const [asset, setAsset] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

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
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const setStatus = (status: string) => {
    if (!id) return;
    Alert.alert('Update Status', `Set asset to "${status.replace('_', ' ')}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', onPress: () => updateAssetStatus(id, status).then(load).catch(e => Alert.alert('Error', e?.message)) },
    ]);
  };

  if (!id || (!loading && !asset)) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <Ionicons name="cube-outline" size={48} color={theme.colors.textMuted} allowFontScaling={false} />
        <Text style={styles.centeredText}>Asset not found</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading && !asset) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.centeredText, { marginTop: 12 }]}>Loading asset…</Text>
      </View>
    );
  }

  const loc = [asset.floorNumber, asset.roomNumber].filter(Boolean).join(', ');
  const statusMeta = STATUS_META[asset.status] ?? { label: asset.status, variant: 'muted' as const };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.hero}>
          {asset.imageUrl ? (
            <Image source={{ uri: asset.imageUrl }} style={styles.heroImage} resizeMode="cover" />
          ) : (
            <LinearGradient colors={['#3730a3', '#4f46e5', '#7c3aed']} style={styles.heroImage}>
              <View style={styles.heroIconWrap}>
                <Ionicons name="cube-outline" size={72} color="rgba(255,255,255,0.7)" allowFontScaling={false} />
              </View>
            </LinearGradient>
          )}
          {/* Gradient overlay at bottom of hero */}
          <LinearGradient
            colors={['transparent', 'rgba(15,23,42,0.7)']}
            style={styles.heroOverlay}
          />
          {/* Back button */}
          <TouchableOpacity
            style={[styles.backCircle, { top: insets.top + (Platform.OS === 'android' ? 28 : 8) }]}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={20} color="#fff" allowFontScaling={false} />
          </TouchableOpacity>
          {/* Open web button */}
          <TouchableOpacity
            style={[styles.webCircle, { top: insets.top + (Platform.OS === 'android' ? 28 : 8) }]}
            onPress={() => Linking.openURL(`${API_URL}/assets/${id}`)}
          >
            <Ionicons name="open-outline" size={18} color="#fff" allowFontScaling={false} />
          </TouchableOpacity>
          {/* Name + status overlay */}
          <View style={styles.heroFooter}>
            <Text style={styles.heroName} numberOfLines={2}>{asset.name}</Text>
            <View style={styles.heroMeta}>
              <Text style={styles.heroId}>{asset.assetId || asset.barcode || ''}</Text>
              <Badge label={statusMeta.label} variant={statusMeta.variant} size="sm" />
            </View>
          </View>
        </View>

        <Animated.View style={{ opacity: fadeAnim }}>
          {/* Info card */}
          <View style={styles.infoCard}>
            {asset.type && <InfoRow icon="pricetag-outline" label="Asset Type" value={asset.type} />}
            {loc ? <InfoRow icon="location-outline" label="Location" value={loc} /> : null}
            {asset.purchaseAmount != null && (
              <InfoRow
                icon="cash-outline"
                label="Purchase Value"
                value={`$${Number(asset.purchaseAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
              />
            )}
            {asset.vendor?.name && <InfoRow icon="business-outline" label="Vendor" value={asset.vendor.name} />}
            {asset.assignedUser?.name && <InfoRow icon="person-outline" label="Assigned To" value={asset.assignedUser.name} />}
            {asset.purchaseDate && (
              <InfoRow icon="calendar-outline" label="Purchase Date" value={new Date(asset.purchaseDate).toLocaleDateString()} />
            )}
            {asset.description && (
              <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
                <Ionicons name="document-text-outline" size={16} color={theme.colors.primary} allowFontScaling={false} style={styles.infoIcon} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoLabel}>Description</Text>
                  <Text style={[styles.infoValue, { lineHeight: 20 }]}>{asset.description}</Text>
                </View>
              </View>
            )}
          </View>

          {/* Status actions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Update Status</Text>
            <View style={styles.actionsGrid}>
              {['AVAILABLE', 'IN_USE', 'MAINTENANCE', 'RETIRED'].map(s => {
                const active = asset.status === s || asset.status === s.replace('MAINTENANCE', 'UNDER_MAINTENANCE');
                const meta = STATUS_META[s] ?? { label: s.replace('_', ' '), variant: 'muted' as const };
                const colors: Record<string, [string, string]> = {
                  AVAILABLE: ['#16a34a', '#15803d'],
                  IN_USE:    ['#0ea5e9', '#0284c7'],
                  MAINTENANCE: ['#d97706', '#b45309'],
                  RETIRED:   ['#64748b', '#475569'],
                };
                return (
                  <TouchableOpacity
                    key={s}
                    style={[styles.actionBtn, active && styles.actionBtnActive]}
                    onPress={() => !active && setStatus(s)}
                    activeOpacity={active ? 1 : 0.75}
                  >
                    {active ? (
                      <LinearGradient colors={colors[s] ?? ['#4f46e5', '#7c3aed']} style={StyleSheet.absoluteFill} />
                    ) : null}
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
            onPress={() => Linking.openURL(`${API_URL}/assets/${id}`)}
            activeOpacity={0.8}
          >
            <LinearGradient colors={['#4f46e5', '#7c3aed']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.webLinkGradient}>
              <Ionicons name="globe-outline" size={20} color="#fff" allowFontScaling={false} />
              <Text style={styles.webLinkText}>Open Full Details on Web</Text>
              <Ionicons name="arrow-forward" size={16} color="rgba(255,255,255,0.7)" allowFontScaling={false} />
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: theme.colors.background, gap: 12,
  },
  centeredText: { ...theme.typography.body, color: theme.colors.textMuted },
  backBtn: {
    paddingHorizontal: 24, paddingVertical: 10,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.xl,
  },
  backBtnText: { color: '#fff', fontWeight: '700' },

  hero: { position: 'relative', height: 260 },
  heroImage: { width: '100%', height: 260 },
  heroIconWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  heroOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 140,
  },
  backCircle: {
    position: 'absolute', left: 16,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center', justifyContent: 'center',
  },
  webCircle: {
    position: 'absolute', right: 16,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center', justifyContent: 'center',
  },
  heroFooter: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: theme.spacing.xl,
    paddingBottom: theme.spacing.lg,
  },
  heroName: {
    fontSize: 22, fontWeight: '800', color: '#fff',
    letterSpacing: -0.3, marginBottom: 6,
  },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroId: { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },

  infoCard: {
    backgroundColor: theme.colors.surface,
    margin: theme.spacing.lg,
    borderRadius: theme.radius.xl,
    overflow: 'hidden',
    ...theme.shadows.md,
  },
  infoRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.borderLight,
    gap: theme.spacing.md,
  },
  infoIcon: { marginTop: 2 },
  infoLabel: {
    fontSize: 11, fontWeight: '700', color: theme.colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3,
  },
  infoValue: { fontSize: 15, fontWeight: '500', color: theme.colors.text },

  section: { paddingHorizontal: theme.spacing.lg, marginBottom: theme.spacing.lg },
  sectionTitle: {
    fontSize: 11, fontWeight: '700', color: theme.colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: theme.spacing.md,
  },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
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
    margin: theme.spacing.lg,
    borderRadius: theme.radius.xl,
    overflow: 'hidden',
    ...theme.shadows.colored,
  },
  webLinkGradient: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  webLinkText: { flex: 1, fontSize: 15, fontWeight: '700', color: '#fff' },
});
