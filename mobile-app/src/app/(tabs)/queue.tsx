import React, { useCallback, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import api, { errorMessage } from '@/lib/api';
import { parseJson, parseUtc } from '@/lib/format';
import { platformName, type PlatformResult, type Post } from '@/lib/types';

const POLL_INTERVAL_MS = 10000;

const STATUS_STYLES: Record<Post['status'], { label: string; background: string; border: string; text: string }> = {
  pending: { label: 'Scheduled', background: 'rgba(250, 204, 21, 0.1)', border: 'rgba(250, 204, 21, 0.3)', text: '#facc15' },
  processing: { label: 'Publishing', background: 'rgba(59, 130, 246, 0.1)', border: 'rgba(59, 130, 246, 0.3)', text: '#60a5fa' },
  uploaded: { label: 'Published', background: 'rgba(74, 222, 128, 0.1)', border: 'rgba(74, 222, 128, 0.3)', text: '#4ade80' },
  failed: { label: 'Failed', background: 'rgba(248, 113, 113, 0.1)', border: 'rgba(248, 113, 113, 0.3)', text: '#f87171' },
};

export default function QueueScreen() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchPosts = useCallback(async () => {
    try {
      const response = await api.get<Post[]>('/api/posts');
      setPosts(response.data);
      setError('');
    } catch (e) {
      setError(errorMessage(e, 'Could not load the queue.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Refresh while the tab is visible so statuses stay current
  useFocusEffect(useCallback(() => {
    fetchPosts();
    const interval = setInterval(fetchPosts, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchPosts]));

  const runAction = async (post: Post, action: 'retry' | 'delete') => {
    setBusyId(post.id);
    try {
      if (action === 'retry') await api.post(`/api/posts/${post.id}/retry`);
      else await api.delete(`/api/posts/${post.id}`);
      await fetchPosts();
    } catch (e) {
      Alert.alert(action === 'retry' ? 'Could not retry' : 'Could not remove', errorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = (post: Post) => {
    Alert.alert('Remove from queue?', post.title || 'Untitled Clip', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => runAction(post, 'delete') },
    ]);
  };

  const renderItem = ({ item }: { item: Post }) => {
    const platforms = parseJson<string[]>(item.platforms, []);
    const results = parseJson<Record<string, PlatformResult>>(item.platform_results, {});
    const status = STATUS_STYLES[item.status] ?? STATUS_STYLES.pending;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.videoIconPlaceholder}>
            <Text style={{color: '#666', fontSize: 10}}>▶</Text>
          </View>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.title || 'Untitled Clip'}</Text>
        </View>

        <View style={styles.platformsRow}>
          {platforms.map(p => {
            const result = results[p];
            const uploaded = result === 'uploaded';
            const failed = typeof result === 'object' && Boolean(result?.error);
            return (
              <View key={p} style={[styles.platformBadge, uploaded && styles.platformUploaded, failed && styles.platformFailed]}>
                <Text style={styles.platformText}>{uploaded ? '✓ ' : failed ? '✗ ' : ''}{platformName(p)}</Text>
              </View>
            );
          })}
        </View>

        <View style={styles.detailsRow}>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>SCHEDULED FOR</Text>
            <Text style={styles.detailValue}>
              {parseUtc(item.scheduled_time).toLocaleString(undefined, {
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
              })}
            </Text>
          </View>

          <View style={[styles.statusBadge, { backgroundColor: status.background, borderColor: status.border }]}>
            <Text style={[styles.statusText, { color: status.text }]}>{status.label}</Text>
          </View>
        </View>

        {(item.error_message || (item.status === 'pending' && item.retry_count > 0)) && item.status !== 'uploaded' && (
          <View style={styles.errorRow}>
            {item.status === 'pending' && item.retry_count > 0 && (
              <Text style={styles.retryText}>Retry {item.retry_count} of 3 scheduled</Text>
            )}
            {item.error_message ? (
              <Text style={item.status === 'failed' ? styles.errorText : styles.retryText}>{item.error_message}</Text>
            ) : null}
          </View>
        )}

        {(item.status === 'failed' || item.status === 'pending') && (
          <View style={styles.actionsRow}>
            {item.status === 'failed' && (
              <TouchableOpacity style={styles.actionBtn} onPress={() => runAction(item, 'retry')} disabled={busyId === item.id} accessibilityRole="button">
                <Text style={styles.actionText}>Retry</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.actionBtn, styles.actionDanger]} onPress={() => confirmDelete(item)} disabled={busyId === item.id} accessibilityRole="button">
              <Text style={[styles.actionText, { color: '#f87171' }]}>Remove</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Publishing Queue</Text>
          <Text style={styles.headerSubtitle}>Monitor and manage uploads.</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={() => { setRefreshing(true); fetchPosts(); }} accessibilityRole="button" accessibilityLabel="Refresh queue">
          <Text style={styles.refreshBtnText}>↻</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#ffffff" />
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          onRefresh={() => { setRefreshing(true); fetchPosts(); }}
          refreshing={refreshing}
          ListHeaderComponent={error ? <Text style={styles.errorBanner}>{error}</Text> : null}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>{error ? 'The queue could not be loaded.' : 'No posts in the queue.'}</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0a0a0a' },
  header: {
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  headerTitle: { fontSize: 28, fontWeight: '900', color: '#fff', marginBottom: 4 },
  headerSubtitle: { fontSize: 14, color: '#a3a3a3' },
  refreshBtn: { padding: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12 },
  refreshBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 20, gap: 16 },
  errorBanner: {
    color: '#f87171',
    backgroundColor: 'rgba(248,113,113,0.1)',
    borderColor: 'rgba(248,113,113,0.3)',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    padding: 16,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  videoIconPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: { color: '#fff', fontWeight: 'bold', fontSize: 15, flex: 1 },
  platformsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 },
  platformBadge: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  platformUploaded: { backgroundColor: 'rgba(74, 222, 128, 0.1)', borderColor: 'rgba(74, 222, 128, 0.3)' },
  platformFailed: { backgroundColor: 'rgba(248, 113, 113, 0.1)', borderColor: 'rgba(248, 113, 113, 0.3)' },
  platformText: { color: '#e5e5e5', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },
  detailsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  detailItem: {},
  detailLabel: { color: '#737373', fontSize: 9, fontWeight: 'bold', letterSpacing: 1, marginBottom: 4 },
  detailValue: { color: '#d4d4d4', fontSize: 13, fontWeight: '500' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  statusText: { fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },
  errorRow: {
    marginTop: 12,
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    gap: 4,
  },
  retryText: { color: '#facc15', fontSize: 12, fontWeight: '600' },
  errorText: { color: '#f87171', fontSize: 12, fontWeight: '500' },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.1)' },
  actionDanger: { backgroundColor: 'rgba(248,113,113,0.1)' },
  actionText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  emptyContainer: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#737373', fontSize: 14 },
});
