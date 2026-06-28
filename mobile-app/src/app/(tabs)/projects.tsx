import React, { useState, useEffect } from 'react';
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
import { router } from 'expo-router';
import api from '@/lib/api';

export default function ProjectsScreen() {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const response = await api.get('/api/jobs');
        setProjects(response.data);
      } catch (error) {
        console.error('Failed to fetch projects', error);
      } finally {
        setLoading(false);
      }
    };
    fetchProjects();
  }, []);

  const renderProject = ({ item }: { item: any }) => {
    const isCompleted = item.status === 'Completed';
    const isProcessing = item.status === 'Processing';

    return (
      <View style={styles.card}>
        {/* Thumbnail Area */}
        <View style={styles.thumbnailContainer}>
          <Image 
            source={{ uri: item.thumbnail }} 
            style={styles.thumbnail} 
          />
          <View style={styles.thumbnailOverlay} />
          
          <View style={styles.badgesContainer}>
            <View style={[
              styles.statusBadge,
              isCompleted ? styles.statusCompleted : isProcessing ? styles.statusProcessing : styles.statusFailed
            ]}>
              <Text style={[
                styles.statusText,
                isCompleted ? styles.statusTextCompleted : isProcessing ? styles.statusTextProcessing : styles.statusTextFailed
              ]}>
                {item.status}
              </Text>
            </View>
          </View>

          <View style={styles.durationBadge}>
            <Text style={styles.durationText}>{item.duration}</Text>
          </View>
        </View>

        {/* Details Area */}
        <View style={styles.detailsContainer}>
          <View style={styles.detailsHeader}>
            <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
            <TouchableOpacity style={styles.moreBtn}>
              <Text style={styles.moreBtnText}>⋮</Text>
            </TouchableOpacity>
          </View>
          
          <Text style={styles.metaText}>{item.id} • {item.time}</Text>

          <View style={styles.footerRow}>
            <View>
              <Text style={styles.clipsLabel}>EXTRACTED CLIPS</Text>
              <Text style={styles.clipsValue}>{item.clips}</Text>
            </View>
            {isCompleted && (
              <TouchableOpacity style={styles.viewClipsBtn} onPress={() => router.push(`/processing/${item.id}` as any)}>
                <Text style={styles.viewClipsBtnText}>View Clips →</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Text style={styles.headerTitle}>My Projects</Text>
          <TouchableOpacity style={styles.newProjectBtn}>
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
          />
        </View>
        <TouchableOpacity style={styles.filterBtn}>
          <Text style={styles.filterBtnText}>Filter</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#ffffff" />
        </View>
      ) : (
        <FlatList
          data={projects}
          keyExtractor={item => item.id}
          renderItem={renderProject}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No projects found</Text>
              <Text style={styles.emptySubtext}>Submit a new video to get started.</Text>
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
    marginBottom: 16,
    gap: 12,
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
  filterBtn: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRadius: 12,
  },
  filterBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
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
  statusCompleted: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  statusProcessing: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  statusFailed: {
    backgroundColor: 'rgba(248, 113, 113, 0.2)',
    borderColor: 'rgba(248, 113, 113, 0.3)',
  },
  statusText: {
    fontSize: 9,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  statusTextCompleted: { color: '#4ade80' },
  statusTextProcessing: { color: '#60a5fa' },
  statusTextFailed: { color: '#f87171' },
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
  detailsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
  },
  moreBtn: {
    padding: 4,
  },
  moreBtnText: {
    color: '#a3a3a3',
    fontSize: 16,
    fontWeight: 'bold',
  },
  metaText: {
    color: '#737373',
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 16,
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
  viewClipsBtn: {
    paddingVertical: 6,
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
