import React, { useCallback, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import api, { errorMessage, mediaUrl } from '@/lib/api';
import { formatDuration, jobRoute, STATUS_COLORS, timeAgo } from '@/lib/format';
import { JOB_TYPE_LABELS, type JobSummary } from '@/lib/types';

const FILTERS = ['All', 'Completed', 'Processing', 'Failed'] as const;
type Filter = typeof FILTERS[number];

export default function ProjectsScreen() {
  const [projects, setProjects] = useState<JobSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('All');

  const fetchProjects = useCallback(async () => {
    try {
      const response = await api.get<JobSummary[]>('/api/jobs');
      setProjects(response.data);
      setError('');
    } catch (e) {
      setError(errorMessage(e, 'Could not load your projects.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Tabs stay mounted, so reload whenever this tab comes into view
  useFocusEffect(useCallback(() => { fetchProjects(); }, [fetchProjects]));

  const query = searchQuery.trim().toLowerCase();
  const visible = projects.filter(p =>
    (filter === 'All' || p.status === filter) &&
    (!query || p.title.toLowerCase().includes(query) || p.id.toLowerCase().includes(query))
  );

  const renderProject = ({ item }: { item: JobSummary }) => {
    const colors = STATUS_COLORS[item.status] ?? STATUS_COLORS.Processing;
    const thumbnail = mediaUrl(item.thumbnail);
    const duration = formatDuration(item.sourceDuration);

    return (
      <TouchableOpacity style={styles.card} onPress={() => router.push(jobRoute(item))} accessibilityRole="button" accessibilityLabel={`${item.title}, ${item.status}`}>
        {/* Thumbnail Area */}
        <View style={styles.thumbnailContainer}>
          {thumbnail ? (
            <Image source={{ uri: thumbnail }} style={styles.thumbnail} />
          ) : (
            <View style={[styles.thumbnail, styles.thumbnailFallback]}><Text style={styles.thumbnailFallbackText}>▶</Text></View>
          )}
          <View style={styles.thumbnailOverlay} />

          <View style={styles.badgesContainer}>
            <View style={[styles.statusBadge, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Text style={[styles.statusText, { color: colors.text }]}>{item.status}</Text>
            </View>
          </View>

          {duration && (
            <View style={styles.durationBadge}>
              <Text style={styles.durationText}>{duration}</Text>
            </View>
          )}
        </View>

        {/* Details Area */}
        <View style={styles.detailsContainer}>
          <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.metaText}>{JOB_TYPE_LABELS[item.type] ?? item.type} • {timeAgo(item.createdAt)}</Text>
          {item.status === 'Failed' && item.error ? <Text style={styles.errorDetail} numberOfLines={3}>{item.error}</Text> : null}

          <View style={styles.footerRow}>
            <View>
              <Text style={styles.clipsLabel}>{item.type === 'clips' ? 'EXTRACTED CLIPS' : 'VIDEOS'}</Text>
              <Text style={styles.clipsValue}>{item.clips}</Text>
            </View>
            <Text style={styles.viewClipsBtnText}>
              {item.status === 'Completed' ? 'View Clips →' : item.status === 'Processing' ? 'View Progress →' : 'View Details →'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Text style={styles.headerTitle}>My Projects</Text>
          <TouchableOpacity style={styles.newProjectBtn} onPress={() => router.navigate('/')} accessibilityRole="button">
            <Text style={styles.newProjectBtnText}>+ New</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.headerSubtitle}>Manage and review your video jobs.</Text>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search projects..."
            placeholderTextColor="#666"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            accessibilityLabel="Search projects"
          />
        </View>
      </View>
      <View style={styles.filterRow}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f)}
            accessibilityRole="button"
            accessibilityState={{ selected: filter === f }}
          >
            <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#ffffff" />
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={item => item.id}
          renderItem={renderProject}
          contentContainerStyle={styles.listContent}
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); fetchProjects(); }}
          ListHeaderComponent={error ? <Text style={styles.errorBanner}>{error}</Text> : null}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No projects found</Text>
              <Text style={styles.emptySubtext}>{projects.length === 0 ? 'Submit a new video to get started.' : 'Try a different search or filter.'}</Text>
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
    paddingBottom: 10,
  },
  headerTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#fff',
  },
  newProjectBtn: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  newProjectBtnText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 12,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#a3a3a3',
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    paddingVertical: 12,
    fontSize: 14,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  filterChipActive: {
    backgroundColor: '#fff',
    borderColor: '#fff',
  },
  filterChipText: {
    color: '#a3a3a3',
    fontSize: 12,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#000',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 20,
    gap: 20,
  },
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
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  thumbnailContainer: {
    height: 160,
    position: 'relative',
    backgroundColor: '#000',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    opacity: 0.7,
  },
  thumbnailFallback: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111',
  },
  thumbnailFallbackText: {
    color: '#444',
    fontSize: 32,
  },
  thumbnailOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  badgesContainer: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 9,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  durationBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  durationText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  detailsContainer: {
    padding: 16,
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  metaText: {
    color: '#737373',
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 12,
  },
  errorDetail: {
    color: '#f87171',
    fontSize: 12,
    marginBottom: 12,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    paddingTop: 16,
  },
  clipsLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#737373',
    letterSpacing: 1,
    marginBottom: 2,
  },
  clipsValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  viewClipsBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptySubtext: {
    color: '#737373',
    fontSize: 14,
  }
});
