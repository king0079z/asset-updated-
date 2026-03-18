import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { scanAsset, postAuditComment } from '@/lib/api';

type Mode = 'count' | 'audit';

interface CountItem {
  id: string;
  name: string;
  assetId?: string;
  barcode?: string;
  status?: string;
  floorNumber?: string;
  roomNumber?: string;
  imageUrl?: string | null;
}

export default function InventoryScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('count');
  const [query, setQuery] = useState('');
  const [countList, setCountList] = useState<CountItem[]>([]);
  const [auditList, setAuditList] = useState<CountItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [commentModal, setCommentModal] = useState<CountItem | null>(null);
  const [commentText, setCommentText] = useState('');

  const list = mode === 'count' ? countList : auditList;
  const setList = mode === 'count' ? setCountList : setAuditList;

  const addByScan = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const asset = await scanAsset(query.trim());
      if (asset?.id) {
        const item: CountItem = {
          id: asset.id,
          name: asset.name,
          assetId: asset.assetId,
          barcode: asset.barcode,
          status: asset.status,
          floorNumber: asset.floorNumber,
          roomNumber: asset.roomNumber,
          imageUrl: asset.imageUrl,
        };
        setList((prev) => (prev.some((i) => i.id === item.id) ? prev : [...prev, item]));
        setQuery('');
      } else {
        Alert.alert('Not found', 'No asset found for this barcode or ID.');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Lookup failed');
    } finally {
      setLoading(false);
    }
  }, [query, mode, setList]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setRefreshing(false);
  }, []);

  const openDetail = (item: CountItem) => router.push(`/asset/${item.id}` as any);

  const submitAuditComment = async () => {
    if (!commentModal) return;
    try {
      await postAuditComment(commentModal.id, commentText);
      setCommentModal(null);
      setCommentText('');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to add comment');
    }
  }

  const renderItem = ({ item }: { item: CountItem }) => (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => openDetail(item)}
      style={styles.row}
    >
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, styles.thumbPlaceholder]}>
          <Ionicons name="cube-outline" size={28} color={theme.colors.textMuted} />
        </View>
      )}
      <View style={styles.rowBody}>
        <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.rowId}>{item.assetId || item.barcode || item.id}</Text>
        {(item.floorNumber || item.roomNumber) && (
          <Text style={styles.rowLoc}>📍 {[item.floorNumber, item.roomNumber].filter(Boolean).join(', ')}</Text>
        )}
        {item.status && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{item.status}</Text>
          </View>
        )}
      </View>
      {mode === 'audit' && (
        <TouchableOpacity
          style={styles.commentBtn}
          onPress={() => setCommentModal(item)}
        >
          <Ionicons name="chatbubble-outline" size={22} color={theme.colors.primary} />
        </TouchableOpacity>
      )}
      <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.toggle}>
        <TouchableOpacity
          style={[styles.toggleBtn, mode === 'count' && styles.toggleBtnActive]}
          onPress={() => setMode('count')}
        >
          <Text style={[styles.toggleText, mode === 'count' && styles.toggleTextActive]}>Count</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, mode === 'audit' && styles.toggleBtnActive]}
          onPress={() => setMode('audit')}
        >
          <Text style={[styles.toggleText, mode === 'audit' && styles.toggleTextActive]}>Audit</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.scanBar}>
        <TextInput
          style={styles.input}
          placeholder="Barcode or asset ID"
          placeholderTextColor={theme.colors.textMuted}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={addByScan}
          returnKeyType="done"
        />
        <TouchableOpacity style={styles.scanBtn} onPress={addByScan} disabled={loading}>
          {loading ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="add" size={24} color="#fff" />}
        </TouchableOpacity>
      </View>

      <Text style={styles.countLabel}>{list.length} item{list.length !== 1 ? 's' : ''}</Text>

      <FlatList
        data={list}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={list.length === 0 ? styles.emptyList : styles.list}
        ListEmptyComponent={
          <EmptyState
            icon="layers-outline"
            title={mode === 'count' ? 'No items in count' : 'No items in audit'}
            subtitle="Scan barcode or enter asset ID to add"
          />
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
      />

      {commentModal && (
        <View style={styles.modal}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add comment — {commentModal.name}</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Comment (optional photo via web)"
              placeholderTextColor={theme.colors.textMuted}
              value={commentText}
              onChangeText={setCommentText}
              multiline
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => { setCommentModal(null); setCommentText(''); }}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSubmit} onPress={submitAuditComment}>
                <Text style={styles.modalSubmitText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  toggle: { flexDirection: 'row', padding: theme.spacing.lg, gap: theme.spacing.sm },
  toggleBtn: { flex: 1, paddingVertical: theme.spacing.md, borderRadius: theme.radius.md, alignItems: 'center', backgroundColor: theme.colors.surface, ...theme.shadows.sm },
  toggleBtnActive: { backgroundColor: theme.colors.primary },
  toggleText: { ...theme.typography.bodyMedium, color: theme.colors.textSecondary },
  toggleTextActive: { color: '#fff' },
  scanBar: { flexDirection: 'row', paddingHorizontal: theme.spacing.lg, marginBottom: theme.spacing.sm, gap: theme.spacing.sm },
  input: { flex: 1, height: theme.touchTargetMinHeight, borderWidth: 1.5, borderColor: theme.colors.border, borderRadius: theme.radius.md, paddingHorizontal: theme.spacing.lg, fontSize: 16 },
  scanBtn: { width: theme.touchTargetMinHeight, height: theme.touchTargetMinHeight, borderRadius: theme.radius.md, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' },
  countLabel: { ...theme.typography.caption, color: theme.colors.textMuted, paddingHorizontal: theme.spacing.lg, marginBottom: theme.spacing.xs },
  list: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xxxl },
  emptyList: { flexGrow: 1, paddingBottom: theme.spacing.xxxl },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: theme.spacing.md, marginBottom: theme.spacing.sm, ...theme.shadows.sm },
  thumb: { width: 56, height: 56, borderRadius: theme.radius.md, backgroundColor: theme.colors.borderLight },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1, marginLeft: theme.spacing.md },
  rowName: { ...theme.typography.bodyMedium, color: theme.colors.text },
  rowId: { ...theme.typography.caption, color: theme.colors.textMuted, marginTop: 2 },
  rowLoc: { ...theme.typography.caption, color: theme.colors.textSecondary, marginTop: 2 },
  badge: { alignSelf: 'flex-start', marginTop: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: theme.radius.sm, backgroundColor: theme.colors.successBg },
  badgeText: { fontSize: 11, fontWeight: '600', color: theme.colors.success },
  commentBtn: { padding: theme.spacing.sm, marginRight: theme.spacing.xs },
  modal: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: theme.spacing.xl },
  modalCard: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.xl, padding: theme.spacing.xl, ...theme.shadows.lg },
  modalTitle: { ...theme.typography.titleSmall, marginBottom: theme.spacing.lg },
  modalInput: { borderWidth: 1.5, borderColor: theme.colors.border, borderRadius: theme.radius.md, padding: theme.spacing.md, minHeight: 80, textAlignVertical: 'top', marginBottom: theme.spacing.lg },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: theme.spacing.md },
  modalCancel: { paddingVertical: theme.spacing.md, paddingHorizontal: theme.spacing.lg },
  modalCancelText: { ...theme.typography.bodyMedium, color: theme.colors.textSecondary },
  modalSubmit: { paddingVertical: theme.spacing.md, paddingHorizontal: theme.spacing.xl, backgroundColor: theme.colors.primary, borderRadius: theme.radius.md },
  modalSubmitText: { ...theme.typography.bodyMedium, color: '#fff' },
});
