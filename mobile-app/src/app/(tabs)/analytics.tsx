import React, { useCallback, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import api, { errorMessage } from '@/lib/api';
import { JOB_TYPE_LABELS, platformName, type Analytics, type JobType } from '@/lib/types';

const Bar = ({ label, value, total, color }: { label: string; value: number; total: number; color: string }) => {
  const percent = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <View style={styles.barRow}>
      <View style={styles.barHeader}>
        <Text style={styles.barLabel}>{label}</Text>
        <Text style={styles.barValue}>{value} ({percent}%)</Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${percent}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
};

export default function AnalyticsScreen() {
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const fetchAnalytics = useCallback(async () => {
    try {
      const response = await api.get<Analytics>('/api/analytics');
      setData(response.data);
      setError('');
    } catch (e) {
      setError(errorMessage(e, 'Could not load analytics.'));
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchAnalytics(); }, [fetchAnalytics]));

  const header = (
    <View style={styles.header}>
      <TouchableOpacity style={styles.backBtn} onPress={() => (router.canGoBack() ? router.back() : router.navigate('/'))} accessibilityRole="button" accessibilityLabel="Back">
        <Text style={styles.backBtnText}>←</Text>
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={styles.headerTitle}>Analytics</Text>
        <Text style={styles.headerSubtitle}>Measured results only; unknown values show as —.</Text>
      </View>
    </View>
  );

  if (!data) {
    return (
      <SafeAreaView style={styles.safeArea}>
        {header}
        <View style={styles.center}>
          {error ? (
            <>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={fetchAnalytics} accessibilityRole="button">
                <Text style={styles.retryText}>Try again</Text>
              </TouchableOpacity>
            </>
          ) : <ActivityIndicator size="large" color="#fff" />}
        </View>
      </SafeAreaView>
    );
  }

  const kpis = [
    { label: 'JOBS RUN', value: data.jobs.total.toLocaleString() },
    { label: 'CLIPS GENERATED', value: data.totalClips.toLocaleString() },
    { label: 'AVG VIRALITY', value: data.avgViralityScore != null ? `${data.avgViralityScore}/100` : '—' },
    { label: 'HOURS PROCESSED', value: data.hoursProcessed != null ? `${data.hoursProcessed}h` : '—' },
  ];
  const jobTypes = Object.entries(data.jobsByType) as [JobType, number][];
  const platforms = Object.entries(data.platforms);

  return (
    <SafeAreaView style={styles.safeArea}>
      {header}
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAnalytics(); }} tintColor="#fff" />}
      >
        {error ? <Text style={styles.errorBanner}>{error}</Text> : null}

        <View style={styles.kpiContainer}>
          {kpis.map(kpi => (
            <View key={kpi.label} style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>{kpi.label}</Text>
              <Text style={styles.kpiValue}>{kpi.value}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Job Outcomes</Text>
          {data.jobs.total === 0 ? <Text style={styles.muted}>No jobs yet.</Text> : (
            <>
              <Bar label="Completed" value={data.jobs.completed} total={data.jobs.total} color="#22c55e" />
              <Bar label="Failed" value={data.jobs.failed} total={data.jobs.total} color="#ef4444" />
              <Bar label="Processing" value={data.jobs.processing} total={data.jobs.total} color="#3b82f6" />
            </>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Jobs by Type</Text>
          {jobTypes.length === 0 ? <Text style={styles.muted}>No jobs yet.</Text> : jobTypes.map(([type, count]) => (
            <Bar key={type} label={JOB_TYPE_LABELS[type] ?? type} value={count} total={data.jobs.total} color="#ffffff" />
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Publishing</Text>
          <View style={styles.postStats}>
            {[
              { label: 'Published', value: data.posts.uploaded, color: '#4ade80' },
              { label: 'Scheduled', value: data.posts.scheduled, color: '#facc15' },
              { label: 'Failed', value: data.posts.failed, color: '#f87171' },
            ].map(item => (
              <View key={item.label} style={styles.postStat}>
                <Text style={[styles.postStatValue, { color: item.color }]}>{item.value}</Text>
                <Text style={styles.postStatLabel}>{item.label}</Text>
              </View>
            ))}
          </View>
          {platforms.length === 0 ? <Text style={styles.muted}>Nothing has been published yet.</Text> : platforms.map(([platform, counts]) => (
            <View key={platform} style={styles.platformRow}>
              <Text style={styles.platformName}>{platformName(platform)}</Text>
              <Text style={styles.platformCounts}>
                <Text style={{ color: '#4ade80' }}>{counts.uploaded} uploaded</Text>
                {'  '}
                <Text style={{ color: '#f87171' }}>{counts.failed} failed</Text>
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0a0a0a' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, paddingBottom: 10, gap: 16 },
  backBtn: { width: 40, height: 40, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  backBtnText: { color: '#fff', fontSize: 20 },
  headerTitle: { fontSize: 28, fontWeight: '900', color: '#fff', marginBottom: 4 },
  headerSubtitle: { fontSize: 13, color: '#a3a3a3' },
  content: { padding: 20, paddingBottom: 40, gap: 16 },
  errorBanner: {
    color: '#f87171',
    backgroundColor: 'rgba(248,113,113,0.1)',
    borderColor: 'rgba(248,113,113,0.3)',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
  },
  errorText: { color: '#f87171', fontSize: 14, textAlign: 'center', marginBottom: 16 },
  retryBtn: { backgroundColor: '#fff', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  retryText: { color: '#000', fontWeight: 'bold' },
  kpiContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  kpiCard: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 16,
  },
  kpiLabel: { color: '#a3a3a3', fontSize: 10, fontWeight: 'bold', letterSpacing: 1, marginBottom: 8 },
  kpiValue: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  section: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 24,
    padding: 20,
    gap: 12,
  },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  muted: { color: '#737373', fontSize: 13 },
  barRow: { gap: 6 },
  barHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  barLabel: { color: '#d4d4d4', fontWeight: 'bold', fontSize: 13 },
  barValue: { color: '#a3a3a3', fontSize: 12 },
  barTrack: { height: 8, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  postStats: { flexDirection: 'row', gap: 8 },
  postStat: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 12, padding: 12, alignItems: 'center' },
  postStatValue: { fontSize: 22, fontWeight: 'bold' },
  postStatLabel: { color: '#737373', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },
  platformRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  platformName: { color: '#fff', fontWeight: '600' },
  platformCounts: { fontSize: 12, fontWeight: 'bold' },
});
