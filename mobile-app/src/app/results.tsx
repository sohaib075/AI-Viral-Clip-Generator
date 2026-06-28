import React, { useState, useEffect } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import api, { API_URL } from '@/lib/api';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TouchableOpacity,
  ActivityIndicator,
  Share,
  Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useVideoPlayer, VideoView } from 'expo-video';

export default function ResultsScreen() {
  const { jobId } = useLocalSearchParams();
  const [activeTab, setActiveTab] = useState('final');
  const [loading, setLoading] = useState(true);
  const [clip, setClip] = useState<any>(null);
  const [clips, setClips] = useState<any[]>([]);

  useEffect(() => {
    if (!jobId) {
      setLoading(false);
      return;
    }
    const fetchResults = async () => {
      try {
        const response = await api.get(`/api/jobs/${jobId}`);
        const data = response.data;
        if (data.clips && data.clips.length > 0) {
          const mappedClips = data.clips.map((c: any, i: number) => {
            const hasSegments = c.segments && c.segments.length > 0;
            const calculatedDuration = hasSegments
              ? `${Math.round(c.segments[c.segments.length - 1].end - c.segments[0].start)}s`
              : 'Full Highlight';
            return {
              id: String(i),
              url: `${API_URL}${c.video_url}`,
              base_url: c.base_url ? `${API_URL}${c.base_url}` : `${API_URL}${c.video_url}`,
              title: c.title,
              duration: calculatedDuration,
              start_time: c.start_time,
              end_time: c.end_time,
              score: c.score || 95,
              metadata: c.metadata || {},
              thumbnail: c.thumbnail_url ? `${API_URL}${c.thumbnail_url}` : null
            };
          });
          setClips(mappedClips);
          setClip(mappedClips[0]);
        }
      } catch (e) {
        console.error("Error fetching results", e);
      } finally {
        setLoading(false);
      }
    };
    fetchResults();
  }, [jobId]);

  const player = useVideoPlayer(clip?.url || '', player => {
    player.loop = true;
    player.play();
  });

  // Re-run player source when clip changes
  useEffect(() => {
    if (clip?.url && player) {
      player.replace(clip.url);
      player.play();
    }
  }, [clip?.url]);

  if (loading) {
    return (
      <View style={[styles.safeArea, styles.center]}>
        <ActivityIndicator size="large" color="#66fcf1" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{clip?.title}</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll}>
          <TouchableOpacity 
            style={[styles.tabBtn, activeTab === 'final' && styles.tabBtnActive]}
            onPress={() => setActiveTab('final')}
          >
            <Text style={[styles.tabText, activeTab === 'final' && styles.tabTextActive]}>Final Output</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tabBtn, activeTab === 'customizer' && styles.tabBtnActive]}
            onPress={() => setActiveTab('customizer')}
          >
            <Text style={[styles.tabText, activeTab === 'customizer' && styles.tabTextActive]}>Customizer</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tabBtn, activeTab === 'social' && styles.tabBtnActive]}
            onPress={() => setActiveTab('social')}
          >
            <Text style={[styles.tabText, activeTab === 'social' && styles.tabTextActive]}>Social Pack</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        
        {clip && (
          <View style={styles.videoPlayerContainer}>
            <VideoView 
              style={styles.videoPlaceholder} 
              player={player} 
              allowsFullscreen 
              allowsPictureInPicture 
              nativeControls
            />
          </View>
        )}

        {/* Clip Selection Horizontal List */}
        {clips.length > 1 && (
          <View style={styles.clipSelector}>
            <Text style={styles.sectionTitleSmall}>Select Clip</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: 12}}>
              {clips.map(c => (
                <TouchableOpacity 
                  key={c.id} 
                  onPress={() => setClip(c)}
                  style={[
                    styles.clipThumbnailWrapper, 
                    clip?.id === c.id && styles.clipThumbnailActive
                  ]}
                >
                  <Image source={{uri: c.thumbnail || 'https://via.placeholder.com/150'}} style={styles.clipThumbnail} />
                  <View style={styles.clipScoreBadge}>
                    <Text style={styles.clipScoreText}>{c.score}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {activeTab === 'final' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ready to Post</Text>
            <Text style={styles.sectionDesc}>This is the final generated video with hardcoded, synced captions.</Text>
            
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.primaryBtn} onPress={() => {}}>
                <Text style={styles.primaryBtnText}>Download Video</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => {}}>
                <Text style={styles.secondaryBtnText}>Auto-Publish</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {activeTab === 'customizer' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Caption Customizer</Text>
            
            <View style={styles.settingGroup}>
              <Text style={styles.label}>THEME</Text>
              <View style={styles.pickerFake}>
                <Text style={styles.pickerFakeText}>Viral (Yellow Highlights)</Text>
              </View>
            </View>

            <View style={styles.row}>
              <View style={[styles.settingGroup, {flex: 1, marginRight: 10}]}>
                <Text style={styles.label}>TEXT COLOR</Text>
                <View style={styles.pickerFake}>
                  <Text style={styles.pickerFakeText}>White</Text>
                </View>
              </View>
              <View style={[styles.settingGroup, {flex: 1, marginLeft: 10}]}>
                <Text style={styles.label}>HIGHLIGHT</Text>
                <View style={styles.pickerFake}>
                  <Text style={styles.pickerFakeText}>Yellow</Text>
                </View>
              </View>
            </View>

            <TouchableOpacity style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>Burn Subtitles & Export</Text>
            </TouchableOpacity>
          </View>
        )}

        {activeTab === 'social' && clip?.metadata && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Social Media Pack</Text>
            <Text style={styles.sectionDesc}>AI generated ready-to-post content.</Text>

            {clip.metadata.tiktok && (
              <View style={styles.socialCard}>
                <View style={styles.socialHeader}>
                  <Text style={styles.socialPlatform}>TikTok</Text>
                  <TouchableOpacity>
                    <Text style={styles.copyText}>Copy</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.socialTitle}>{clip.metadata.tiktok.title}</Text>
                <Text style={styles.socialDesc}>{clip.metadata.tiktok.description}</Text>
                <Text style={styles.socialHashtags}>{clip.metadata.tiktok.hashtags?.join(' ')}</Text>
              </View>
            )}
            
            {clip.metadata.youtube_shorts && (
              <View style={styles.socialCard}>
                <View style={styles.socialHeader}>
                  <Text style={styles.socialPlatform}>YouTube Shorts</Text>
                  <TouchableOpacity>
                    <Text style={styles.copyText}>Copy</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.socialTitle}>{clip.metadata.youtube_shorts.title}</Text>
                <Text style={styles.socialDesc}>{clip.metadata.youtube_shorts.description}</Text>
                <Text style={styles.socialHashtags}>{clip.metadata.youtube_shorts.hashtags?.join(' ')}</Text>
              </View>
            )}
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 10,
    gap: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backBtnText: {
    color: '#fff',
    fontSize: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
  },
  tabsContainer: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  tabsScroll: {
    paddingHorizontal: 20,
    gap: 24,
  },
  tabBtn: {
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: '#66fcf1',
  },
  tabText: {
    color: '#737373',
    fontWeight: 'bold',
    fontSize: 15,
  },
  tabTextActive: {
    color: '#fff',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  videoPlayerContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  videoPlaceholder: {
    width: 280,
    height: 498, // 9:16 aspect ratio
    backgroundColor: '#000',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden'
  },
  clipSelector: {
    marginBottom: 24,
  },
  sectionTitleSmall: {
    color: '#fff',
    fontWeight: 'bold',
    marginBottom: 12,
    fontSize: 14,
  },
  clipThumbnailWrapper: {
    width: 80,
    height: 120,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
    position: 'relative'
  },
  clipThumbnailActive: {
    borderColor: '#66fcf1',
  },
  clipThumbnail: {
    width: '100%',
    height: '100%',
  },
  clipScoreBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  clipScoreText: {
    color: '#facc15',
    fontSize: 10,
    fontWeight: 'bold',
  },
  section: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  sectionDesc: {
    fontSize: 13,
    color: '#a3a3a3',
    marginBottom: 20,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: '#fff',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 15,
  },
  secondaryBtn: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  settingGroup: {
    marginBottom: 16,
  },
  label: {
    color: '#a3a3a3',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
  },
  pickerFake: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 16,
  },
  pickerFakeText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  socialCard: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  socialHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  socialPlatform: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  copyText: {
    color: '#66fcf1',
    fontWeight: 'bold',
    fontSize: 12,
  },
  socialTitle: {
    color: '#fff',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  socialDesc: {
    color: '#a3a3a3',
    fontSize: 13,
    marginBottom: 8,
  },
  socialHashtags: {
    color: '#66fcf1',
    fontWeight: 'bold',
    fontSize: 12,
  }
});
