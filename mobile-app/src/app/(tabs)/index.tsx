import React, { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import api, { errorMessage, postForm } from '@/lib/api';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { VideoSourceInput } from '@/components/video-source-input';
import { videoFormData, type PickedVideo } from '@/lib/pick-video';
import { jobRoute, STATUS_COLORS, timeAgo } from '@/lib/format';
import type { Analytics, JobSummary } from '@/lib/types';

export default function HomeScreen() {
  const [videoUrl, setVideoUrl] = useState('');
  const [video, setVideo] = useState<PickedVideo | null>(null);
  const [layout, setLayout] = useState('vertical');
  const [isLoading, setIsLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [recentJobs, setRecentJobs] = useState<JobSummary[]>([]);
  const [dashboardError, setDashboardError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboardData = useCallback(async () => {
    try {
      const [analyticsRes, jobsRes] = await Promise.all([
        api.get<Analytics>('/api/analytics'),
        api.get<JobSummary[]>('/api/jobs')
      ]);
      setAnalytics(analyticsRes.data);
      setRecentJobs(jobsRes.data.slice(0, 4));
      setDashboardError('');
    } catch (e) {
      setDashboardError(errorMessage(e, 'Could not load your dashboard.'));
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Tabs stay mounted, so refresh whenever Home comes back into view
  useFocusEffect(useCallback(() => { fetchDashboardData(); }, [fetchDashboardData]));

  const handleSubmit = async () => {
    if (!videoUrl && !video) return;
    setIsLoading(true);
    setSubmitError('');
    try {
      const data = video
        ? await postForm<{ jobId: string }>('/api/jobs', videoFormData(video, { layout }))
        : (await api.post<{ jobId: string }>('/api/jobs', { videoUrl: videoUrl.trim(), layout })).data;
      setVideo(null);
      setVideoUrl('');
      router.push({ pathname: '/processing/[jobId]', params: { jobId: data.jobId } });
    } catch (error) {
      setSubmitError(errorMessage(error, 'Failed to submit the job.'));
    } finally {
      setIsLoading(false);
    }
  };

  const stats = [
    { label: 'TOTAL CLIPS', value: analytics ? analytics.totalClips.toLocaleString() : '—' },
    { label: 'HOURS PROCESSED', value: analytics?.hoursProcessed != null ? `${analytics.hoursProcessed}h` : '—' },
    { label: 'AVG. VIRALITY', value: analytics?.avgViralityScore != null ? `${analytics.avgViralityScore}/100` : '—' },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchDashboardData(); }} tintColor="#fff" />}
      >

        {/* Header */}
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <Image source={require('@/assets/images/icon.png')} style={{ width: 40, height: 40, marginRight: 12, borderRadius: 8 }} />
            <Text style={styles.title}>Project Overview</Text>
          </View>
          <Text style={styles.subtitle}>Welcome back. Manage your video pipeline.</Text>
        </View>

        {dashboardError ? <Text style={styles.errorBanner}>{dashboardError}</Text> : null}

        {/* Analytics Row */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.analyticsScroll} contentContainerStyle={styles.analyticsContent}>
          {stats.map(stat => (
            <View key={stat.label} style={styles.analyticsCard}>
              <Text style={styles.analyticsLabel}>{stat.label}</Text>
              <Text style={styles.analyticsValue}>{stat.value}</Text>
            </View>
          ))}
          <TouchableOpacity style={[styles.analyticsCard, styles.analyticsLink]} onPress={() => router.push('/analytics')} accessibilityRole="button">
            <Text style={styles.analyticsLabel}>MORE</Text>
            <Text style={styles.analyticsLinkText}>View analytics →</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Shortcuts */}
        <TouchableOpacity style={styles.storyCard} onPress={() => router.push('/story-to-video')} accessibilityRole="button">
          <Text style={styles.storyTitle}>📖 AI Story to Video</Text>
          <Text style={styles.storyDesc}>Turn a story or script into a narrated video with AI visuals.</Text>
        </TouchableOpacity>

        {/* Upload Widget */}
        <View style={styles.uploadWidget}>
          <Text style={styles.sectionTitle}>New Extraction Job</Text>

          <VideoSourceInput url={videoUrl} onUrlChange={setVideoUrl} video={video} onVideoChange={setVideo} disabled={isLoading} />

          <Text style={styles.label}>TARGET VIDEO FORMAT</Text>
          <View style={styles.formatRow}>
            {[
              { id: 'vertical', title: '9:16 Vertical', sub: 'TikTok / Reels' },
              { id: 'horizontal', title: '16:9 Horizontal', sub: 'Landscape Web' },
            ].map((option, i) => (
              <React.Fragment key={option.id}>
                {i > 0 && <View style={{ width: 12 }} />}
                <TouchableOpacity
                  style={[styles.formatBtn, layout === option.id && styles.formatBtnActive]}
                  onPress={() => setLayout(option.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: layout === option.id }}
                >
                  <Text style={[styles.formatBtnText, layout === option.id && styles.formatBtnTextActive]}>{option.title}</Text>
                  <Text style={styles.formatBtnSub}>{option.sub}</Text>
                </TouchableOpacity>
              </React.Fragment>
            ))}
          </View>

          {submitError ? <Text style={styles.errorText}>{submitError}</Text> : null}

          <TouchableOpacity
            style={[styles.submitBtn, (!videoUrl && !video) && styles.submitBtnDisabled]}
            disabled={(!videoUrl && !video) || isLoading}
            onPress={handleSubmit}
            accessibilityRole="button"
          >
            {isLoading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.submitBtnText}>Process Video Pipeline</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Recent Jobs */}
        <View style={styles.jobsWidget}>
          <Text style={styles.sectionTitle}>Recent Jobs</Text>
          {recentJobs.length === 0 ? (
            <Text style={{color: '#a3a3a3', textAlign: 'center', marginTop: 20}}>No recent jobs found</Text>
          ) : (
            recentJobs.map(job => {
              const colors = STATUS_COLORS[job.status] ?? STATUS_COLORS.Processing;
              return (
                <TouchableOpacity key={job.id} style={styles.jobCard} onPress={() => router.push(jobRoute(job))} accessibilityRole="button">
                  <View style={styles.jobHeader}>
                    <Text style={styles.jobTitle} numberOfLines={1}>{job.title}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: colors.background, borderColor: colors.border }]}>
                      <Text style={[styles.statusText, { color: colors.text }]}>{job.status}</Text>
                    </View>
                  </View>
                  <View style={styles.jobFooter}>
                    <Text style={styles.jobMeta}>
                      {job.status === 'Failed' ? 'Tap for details' : `${job.clips} clip${job.clips === 1 ? '' : 's'}`} • {timeAgo(job.createdAt)}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  container: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#a3a3a3',
  },
  errorBanner: {
    color: '#f87171',
    backgroundColor: 'rgba(248,113,113,0.1)',
    borderColor: 'rgba(248,113,113,0.3)',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    fontSize: 13,
  },
  analyticsScroll: {
    marginBottom: 16,
  },
  analyticsContent: {
    gap: 16,
    paddingRight: 20,
  },
  analyticsCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 16,
    width: 140,
  },
  analyticsLabel: {
    fontSize: 10,
    color: '#737373',
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8,
  },
  analyticsValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  analyticsLink: {
    justifyContent: 'center',
  },
  analyticsLinkText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  storyCard: {
    backgroundColor: 'rgba(102,252,241,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(102,252,241,0.2)',
    borderRadius: 20,
    padding: 16,
    marginBottom: 24,
  },
  storyTitle: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 4,
  },
  storyDesc: {
    color: '#a3a3a3',
    fontSize: 13,
  },
  uploadWidget: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    borderRadius: 24,
    padding: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  label: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#a3a3a3',
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 8,
  },
  formatRow: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  formatBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  formatBtnActive: {
    backgroundColor: '#fff',
    borderColor: '#fff',
  },
  formatBtnText: {
    color: '#a3a3a3',
    fontWeight: 'bold',
    marginBottom: 2,
  },
  formatBtnTextActive: {
    color: '#000',
  },
  formatBtnSub: {
    fontSize: 9,
    color: '#737373',
    textTransform: 'uppercase',
  },
  errorText: {
    color: '#f87171',
    fontSize: 13,
    marginBottom: 12,
  },
  submitBtn: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 15,
  },
  jobsWidget: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    borderRadius: 24,
    padding: 20,
  },
  jobCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  jobTitle: {
    color: '#fff',
    fontWeight: '600',
    flex: 1,
    marginRight: 10,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 9,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  jobFooter: {
    flexDirection: 'row',
  },
  jobMeta: {
    fontSize: 11,
    color: '#737373',
  }
});
