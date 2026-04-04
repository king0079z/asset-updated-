import { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, ActivityIndicator, Image, Alert, Platform, StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/constants/theme';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { scanAsset, postAuditComment } from '@/lib/api';

type Mode = 'count' | 'audit';

interface CountItem {
  id: string; name: string; assetId?: string; barcode?: string;
  status?: string; floorNumber?: string; roomNumber?: string; imageUrl?: string | null;
}

const STATUS_VARIANT: Record<string, 'success' | 'info' | 'warning' | 'error' | 'muted'> = {
  ACTIVE: 'success', AVAILABLE: 'success', IN_USE: 'info',
  UNDER_MAINTENANCE: 'warning', DECOMMISSIONED: 'error', DISPOSED: 'error',
};

export default function InventoryScreen() {
  const router   = useRouter();
  const insets   = useSafeAreaInsets();
  const [mode,    setMode]    = useState<Mode>('count');
  const [query,   setQuery]   = useState('');
  const [countList, setCountList] = useState<CountItem[]>([]);
  const [auditList, setAuditList] = useState<CountItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [commentModal, setCommentModal] = useState<CountItem | null>(null);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  const list    = mode === 'count' ? countList : auditList;
  const setList = mode === 'count' ? setCountList : setAuditList;

  const addByScan = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const asset = await scanAsset(query.trim());
      if (asset?.id) {
        const item: CountItem = {
          id: asset.id, name: asset.name, assetId: asset.assetId,
          barcode: asset.barcode, status: asset.status,
          floorNumber: asset.floorNumber, roomNumber: asset.roomNumber,
          imageUrl: asset.imageUrl,
        };
        setList(prev => prev.some(i => i.id === item.id) ? prev : [...prev, item]);
        setQuery('');
      } else {
        Alert.alert('Not Found', 'No asset found for this barcode or ID.');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Lookup failed');
    } finally {
      setLoading(false);
    }
  }, [query, setList]);

  const submitComment = async () => {
    if (!commentModal) return;
    setSubmittingComment(true);
    try {
      await postAuditComment(commentModal.id, commentText);
      Alert.alert('Saved', 'Audit comment recorded.');
      setCommentModal(null);
      setCommentText('');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to add comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  const removeItem = (id: string) => setList(prev => prev.filter(i => i.id !== id));

  const renderItem = ({ item }: { item: CountItem }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/asset/${item.id}` as any)}
      activeOpacity={0.75}
    >
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={styles.thumb} />
      ) : (
        <LinearGradient colors={['#eef2ff', '#e0e7ff']} style={styles.thumbPlaceholder}>
          <Ionicons name="cube-outline" size={24} color={theme.colors.primary} allowFontScaling={false} />
        </LinearGradient>
      )}
      <View style={styles.cardBody}>
        <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.cardId}>{item.assetId || item.barcode || item.id.slice(0, 8)}</Text>
        <View style={styles.cardMeta}>
          {item.status && <Badge label={item.status} variant={STATUS_VARIANT[item.status] ?? 'muted'} size="sm" />}
          {(item.floorNumber || item.roomNumber) && (
            <View style={styles.locChip}>
              <Ionicons name="location-outline" size={10} color={theme.colors.textMuted} allowFontScaling={false} />
              <Text style={styles.locText}>{[item.floorNumber, item.roomNumber].filter(Boolean).join(', ')}</Text>
            </View>
          )}
        </View>
      </View>
      <View style={styles.cardActions}>
        {mode === 'audit' && (
          <TouchableOpacity
            style={styles.commentIconBtn}
            onPress={e => { e.stopPropagation?.(); setCommentModal(item); }}
          >
            <Ionicons name="chatbubble-outline" size={18} color={theme.colors.primary} allowFontScaling={false} />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.removeIconBtn}
          onPress={e => { e.stopPropagation?.(); removeItem(item.id); }}
        >
          <Ionicons name="close-circle-outline" size={18} color={theme.colors.error} allowFontScaling={false} />
        </TouchableOpacity>
        <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} allowFontScaling={false} />
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Gradient header */}
      <LinearGradient
        colors={['#15803d', '#16a34a', '#22c55e']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + (Platform.OS === 'android' ? 36 : 16) }]}
      >
        <View style={styles.headerCircle} />
        <Text style={styles.headerTitle}>Handheld Audit</Text>
        <Text style={styles.headerSubtitle}>Scan and audit assets in the field</Text>

        {/* Mode tabs */}
        <View style={styles.tabRow}>
          {(['count', 'audit'] as Mode[]).map(m => (
            <TouchableOpacity
              key={m}
              style={[styles.tabBtn, mode === m && styles.tabBtnActive]}
              onPress={() => setMode(m)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={m === 'count' ? 'layers-outline' : 'clipboard-outline'}
                size={15}
                color={mode === m ? '#16a34a' : 'rgba(255,255,255,0.8)'}
                allowFontScaling={false}
              />
              <Text style={[styles.tabText, mode === m && styles.tabTextActive]}>
                {m === 'count' ? 'Count Mode' : 'Audit Mode'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </LinearGradient>

      {/* Scan bar */}
      <View style={styles.scanBarWrap}>
        <View style={styles.scanBar}>
          <Ionicons name="barcode-outline" size={20} color={theme.colors.textMuted} allowFontScaling={false} />
          <TextInput
            style={styles.scanInput}
            placeholder="Enter barcode or asset ID…"
            placeholderTextColor={theme.colors.textMuted}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={addByScan}
            returnKeyType="done"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity style={styles.addBtn} onPress={addByScan} disabled={loading}>
            {loading
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="add" size={22} color="#fff" allowFontScaling={false} />}
          </TouchableOpacity>
        </View>
        {list.length > 0 && (
          <Text style={styles.countBadge}>{list.length} item{list.length !== 1 ? 's' : ''} scanned</Text>
        )}
      </View>

      <FlatList
        data={list}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={[styles.list, list.length === 0 && { flexGrow: 1 }]}
        ListEmptyComponent={
          <EmptyState
            icon="scan-outline"
            title={mode === 'count' ? 'No items in count' : 'No items in audit'}
            subtitle="Scan a barcode or enter an asset ID above to begin"
          />
        }
        showsVerticalScrollIndicator={false}
      />

      {/* Comment modal */}
      {commentModal && (
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} onPress={() => setCommentModal(null)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Audit Note</Text>
            <Text style={styles.modalSubtitle}>{commentModal.name}</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Add your audit observation…"
              placeholderTextColor={theme.colors.textMuted}
              value={commentText}
              onChangeText={setCommentText}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => { setCommentModal(null); setCommentText(''); }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSubmit} onPress={submitComment} disabled={submittingComment}>
                {submittingComment
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.modalSubmitText}>Save Note</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
  headerTitle:    { fontSize: 24, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: theme.spacing.lg },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: theme.radius.xl,
    padding: 3,
  },
  tabBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 9, borderRadius: theme.radius.lg,
  },
  tabBtnActive: { backgroundColor: '#fff' },
  tabText:       { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },
  tabTextActive: { color: '#16a34a' },

  scanBarWrap: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.background,
  },
  scanBar: {
    flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    paddingHorizontal: theme.spacing.lg,
    height: 50,
    ...theme.shadows.sm,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  scanInput: { flex: 1, fontSize: 14, color: theme.colors.text },
  addBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: theme.colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  countBadge: {
    fontSize: 11, fontWeight: '700', color: theme.colors.success,
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginTop: theme.spacing.sm, marginLeft: 4,
  },

  list: { padding: theme.spacing.lg, paddingBottom: 100 },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    marginBottom: theme.spacing.md,
    overflow: 'hidden',
    ...theme.shadows.md,
  },
  thumb: { width: 68, height: 68 },
  thumbPlaceholder: { width: 68, height: 68, alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.md, gap: 3 },
  cardName: { fontSize: 15, fontWeight: '600', color: theme.colors.text },
  cardId:   { fontSize: 11, color: theme.colors.textMuted },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 4 },
  locChip: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: theme.colors.borderLight,
    paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4,
  },
  locText: { fontSize: 10, color: theme.colors.textMuted, fontWeight: '500' },
  cardActions: { flexDirection: 'row', alignItems: 'center', paddingRight: theme.spacing.md, gap: 6 },
  commentIconBtn: { padding: 6 },
  removeIconBtn:  { padding: 6 },

  modalOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  modalSheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: theme.spacing.xl,
    gap: theme.spacing.md,
    ...theme.shadows.xl,
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: theme.colors.border,
    alignSelf: 'center', marginBottom: 4,
  },
  modalTitle:    { fontSize: 18, fontWeight: '800', color: theme.colors.text },
  modalSubtitle: { fontSize: 13, color: theme.colors.textSecondary, marginTop: -8 },
  modalInput: {
    backgroundColor: theme.colors.surfaceDim,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.lg,
    fontSize: 15, color: theme.colors.text,
    borderWidth: 1.5, borderColor: theme.colors.border,
    minHeight: 100,
  },
  modalActions:     { flexDirection: 'row', gap: theme.spacing.md, justifyContent: 'flex-end' },
  modalCancel:      { paddingVertical: 12, paddingHorizontal: 20 },
  modalCancelText:  { fontSize: 15, fontWeight: '600', color: theme.colors.textSecondary },
  modalSubmit:      {
    paddingVertical: 12, paddingHorizontal: 24,
    backgroundColor: theme.colors.success,
    borderRadius: theme.radius.xl,
  },
  modalSubmitText:  { fontSize: 15, fontWeight: '700', color: '#fff' },
});
