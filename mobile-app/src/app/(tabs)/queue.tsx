import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '@/lib/api';

interface Post {
    id: string;
    clip_url: string;
    platforms: string;
    title: string;
    scheduled_time: string;
    status: string;
    retry_count: number;
    error_message?: string;
}

export default function QueueScreen() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPosts = async () => {
    try {
      const response = await api.get('/api/posts');
      setPosts(response.data);
    } catch (e) {
      console.error('Failed to fetch posts', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchPosts();
  };

  const renderItem = ({ item }: { item: Post }) => {
    let platformsArr: string[] = [];
    try { platformsArr = JSON.parse(item.platforms); } catch(e) {}

    const isPending = item.status === 'pending';
    const isUploaded = item.status === 'uploaded';
    const isFailed = item.status === 'failed';

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.videoIconPlaceholder}>
            <Text style={{color: '#666', fontSize: 10}}>▶</Text>
          </View>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.title || 'Untitled Clip'}</Text>
        </View>

        <View style={styles.platformsRow}>
          {platformsArr.map((p: string) => (
            <View key={p} style={styles.platformBadge}>
              <Text style={styles.platformText}>{p}</Text>
            </View>
          ))}
        </View>

        <View style={styles.detailsRow}>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>SCHEDULED FOR</Text>
            <Text style={styles.detailValue}>
              {new Date(item.scheduled_time + 'Z').toLocaleString(undefined, {
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
              })}
            </Text>
          </View>

          <View style={[
            styles.statusBadge,
            isPending ? styles.statusPending : isUploaded ? styles.statusUploaded : styles.statusFailed
          ]}>
            <Text style={[
              styles.statusText,
              isPending ? styles.statusTextPending : isUploaded ? styles.statusTextUploaded : styles.statusTextFailed
            ]}>
              {item.status}
            </Text>
          </View>
        </View>

        {(isFailed || (isPending && item.retry_count > 0)) && (
          <View style={styles.errorRow}>
            {isPending && item.retry_count > 0 && (
              <Text style={styles.retryText}>Retrying ({item.retry_count}/3)</Text>
            )}
            {isFailed && (
              <Text style={styles.errorText}>{item.error_message || 'Upload error'}</Text>
            )}
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
        <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh}>
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
          onRefresh={onRefresh}
          refreshing={refreshing}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No posts in the queue.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#a3a3a3',
  },
  refreshBtn: {
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
  },
  refreshBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 20,
    gap: 16,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  videoIconPlaceholder: {
    width: 40,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    flex: 1,
  },
  platformsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  platformBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 6,
  },
  platformText: {
    color: '#e5e5e5',
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailItem: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#737373',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: 13,
    color: '#a3a3a3',
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusPending: {
    backgroundColor: 'rgba(250, 204, 21, 0.1)',
    borderColor: 'rgba(250, 204, 21, 0.2)',
  },
  statusUploaded: {
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
    borderColor: 'rgba(74, 222, 128, 0.2)',
  },
  statusFailed: {
    backgroundColor: 'rgba(248, 113, 113, 0.1)',
    borderColor: 'rgba(248, 113, 113, 0.2)',
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  statusTextPending: { color: '#facc15' },
  statusTextUploaded: { color: '#4ade80' },
  statusTextFailed: { color: '#f87171' },
  errorRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  retryText: {
    color: '#facc15',
    fontSize: 12,
    fontWeight: '600',
  },
  errorText: {
    color: '#f87171',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#737373',
    fontWeight: '500',
  }
});
