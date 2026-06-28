import React, { useState, useEffect } from 'react';
import { router } from 'expo-router';
import api from '@/lib/api';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  ScrollView,
  Platform,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';


export default function HomeScreen() {
  const [videoUrl, setVideoUrl] = useState('');
  const [layout, setLayout] = useState('vertical');
  const [isLoading, setIsLoading] = useState(false);
  
  const [analytics, setAnalytics] = useState({
    totalClips: 0,
    hoursProcessed: 0,
    avgVirality: '0%'
  });
  
  const [recentJobs, setRecentJobs] = useState<any[]>([]);

  // Fetch dashboard data
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [analyticsRes, jobsRes] = await Promise.all([
          api.get('/api/analytics'),
          api.get('/api/jobs')
        ]);
        setAnalytics(analyticsRes.data);
        setRecentJobs(jobsRes.data.slice(0, 4));
      } catch (e) {
        console.error('Failed to fetch dashboard data:', e);
      }
    };
    fetchDashboardData();
  }, []);

  const handleSubmit = async () => {
    if (!videoUrl) return;
    setIsLoading(true);
    try {
      const response = await api.post('/api/jobs', {
        videoUrl: videoUrl,
        layout: layout
      });
      setIsLoading(false);
      router.push(`/processing/${response.data.jobId}` as any);
    } catch (error) {
      console.error("Failed to submit job", error);
      setIsLoading(false);
      alert('Failed to submit job. Please check the URL and backend connection.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Project Overview</Text>
          <Text style={styles.subtitle}>Welcome back. Manage your video pipeline.</Text>
        </View>

        {/* Analytics Row */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.analyticsScroll} contentContainerStyle={styles.analyticsContent}>
          <View style={styles.analyticsCard}>
            <Text style={styles.analyticsLabel}>TOTAL CLIPS</Text>
            <Text style={styles.analyticsValue}>{analytics.totalClips.toLocaleString()}</Text>
          </View>
          <View style={styles.analyticsCard}>
            <Text style={styles.analyticsLabel}>HOURS PROCESSED</Text>
            <Text style={styles.analyticsValue}>{analytics.hoursProcessed}h</Text>
          </View>
          <View style={styles.analyticsCard}>
            <Text style={styles.analyticsLabel}>AVG. VIRALITY</Text>
            <Text style={styles.analyticsValue}>{analytics.avgVirality}</Text>
          </View>
        </ScrollView>

        {/* Upload Widget */}
        <View style={styles.uploadWidget}>
          <Text style={styles.sectionTitle}>New Extraction Job</Text>
          
          <Text style={styles.label}>YOUTUBE OR WEB URL</Text>
          <TextInput
            style={styles.input}
            placeholder="https://www.youtube.com/watch?v=..."
            placeholderTextColor="#666"
            value={videoUrl}
            onChangeText={setVideoUrl}
            keyboardType="url"
            autoCapitalize="none"
          />

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity style={styles.uploadArea}>
            <Text style={styles.uploadText}>Tap to select video file</Text>
            <Text style={styles.uploadSubtext}>MP4, MOV up to 2GB</Text>
          </TouchableOpacity>

          <Text style={styles.label}>TARGET VIDEO FORMAT</Text>
          <View style={styles.formatRow}>
            <TouchableOpacity 
              style={[styles.formatBtn, layout === 'vertical' && styles.formatBtnActive]}
              onPress={() => setLayout('vertical')}
            >
              <Text style={[styles.formatBtnText, layout === 'vertical' && styles.formatBtnTextActive]}>9:16 Vertical</Text>
              <Text style={styles.formatBtnSub}>TikTok / Reels</Text>
            </TouchableOpacity>
            <View style={{width: 12}} />
            <TouchableOpacity 
              style={[styles.formatBtn, layout === 'horizontal' && styles.formatBtnActive]}
              onPress={() => setLayout('horizontal')}
            >
              <Text style={[styles.formatBtnText, layout === 'horizontal' && styles.formatBtnTextActive]}>16:9 Horizontal</Text>
              <Text style={styles.formatBtnSub}>Landscape Web</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            style={[styles.submitBtn, !videoUrl && styles.submitBtnDisabled]}
            disabled={!videoUrl || isLoading}
            onPress={handleSubmit}
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
            recentJobs.map(job => (
              <TouchableOpacity key={job.id} style={styles.jobCard} onPress={() => router.push(`/processing/${job.id}` as any)}>
                <View style={styles.jobHeader}>
                  <Text style={styles.jobTitle} numberOfLines={1}>{job.title}</Text>
                  <View style={[
                    styles.statusBadge, 
                    job.status === 'Completed' ? styles.statusCompleted : styles.statusProcessing
                  ]}>
                    <Text style={[
                      styles.statusText,
                      job.status === 'Completed' ? styles.statusTextCompleted : styles.statusTextProcessing
                    ]}>{job.status}</Text>
                  </View>
                </View>
                <View style={styles.jobFooter}>
                  <Text style={styles.jobMeta}>{job.clips} clips • {job.time}</Text>
                </View>
              </TouchableOpacity>
            ))
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
  analyticsScroll: {
    marginBottom: 24,
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
  input: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    color: '#fff',
    padding: 16,
    fontSize: 14,
    marginBottom: 16,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  dividerText: {
    marginHorizontal: 10,
    fontSize: 10,
    fontWeight: 'bold',
    color: '#737373',
  },
  uploadArea: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderStyle: 'dashed',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  uploadText: {
    color: '#e5e5e5',
    fontWeight: '600',
    marginBottom: 4,
  },
  uploadSubtext: {
    color: '#737373',
    fontSize: 11,
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
  statusCompleted: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  statusProcessing: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  statusText: {
    fontSize: 9,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  statusTextCompleted: {
    color: '#4ade80',
  },
  statusTextProcessing: {
    color: '#60a5fa',
  },
  jobFooter: {
    flexDirection: 'row',
  },
  jobMeta: {
    fontSize: 11,
    color: '#737373',
  }
});
