import React, { useState } from 'react';
import { router } from 'expo-router';
import api, { errorMessage, postForm } from '@/lib/api';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  ScrollView,
  ActivityIndicator,
  Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { VideoSourceInput } from '@/components/video-source-input';
import { videoFormData, type PickedVideo } from '@/lib/pick-video';

export default function AutoEditScreen() {
  const [videoUrl, setVideoUrl] = useState('');
  const [video, setVideo] = useState<PickedVideo | null>(null);
  const [submitError, setSubmitError] = useState('');
  const [layout, setLayout] = useState('9:16');
  const [style, setStyle] = useState('Cinematic');
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const STYLES = ['Cinematic', 'Viral Reels', 'TikTok', 'Podcast', 'Motivational', 'Vlog', 'Gaming'];

  const handleSubmit = async () => {
    if (!videoUrl && !video) return;
    setIsLoading(true);
    setSubmitError('');
    try {
      const fields = { layout, style, prompt };
      const data = video
        ? await postForm<{ jobId: string }>('/api/auto-edit', videoFormData(video, fields))
        : (await api.post<{ jobId: string }>('/api/auto-edit', { videoUrl: videoUrl.trim(), ...fields })).data;
      setVideo(null);
      setVideoUrl('');
      router.push({ pathname: '/processing/[jobId]', params: { jobId: data.jobId } });
    } catch (error) {
      setSubmitError(errorMessage(error, 'Failed to submit the job.'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <Image source={require('@/assets/images/icon.png')} style={{ width: 40, height: 40, marginRight: 12, borderRadius: 8 }} />
            <Text style={styles.title}>Auto Video Editor</Text>
          </View>
          <Text style={styles.subtitle}>AI cuts your video into a tight story with zooms, color grading and animated subtitles.</Text>
        </View>

        <View style={styles.uploadWidget}>
          <VideoSourceInput url={videoUrl} onUrlChange={setVideoUrl} video={video} onVideoChange={setVideo} disabled={isLoading} />
          
          <Text style={styles.label}>TARGET ASPECT RATIO</Text>
          <View style={styles.formatRow}>
            <TouchableOpacity 
              style={[styles.formatBtn, layout === '9:16' && styles.formatBtnActive]}
              onPress={() => setLayout('9:16')}
              accessibilityRole="button"
              accessibilityState={{ selected: layout === '9:16' }}
            >
              <Text style={[styles.formatBtnText, layout === '9:16' && styles.formatBtnTextActive]}>9:16 (Reels/TikTok)</Text>
            </TouchableOpacity>
            <View style={{width: 8}} />
            <TouchableOpacity 
              style={[styles.formatBtn, layout === '16:9' && styles.formatBtnActive]}
              onPress={() => setLayout('16:9')}
              accessibilityRole="button"
              accessibilityState={{ selected: layout === '16:9' }}
            >
              <Text style={[styles.formatBtnText, layout === '16:9' && styles.formatBtnTextActive]}>16:9 (YouTube)</Text>
            </TouchableOpacity>
            <View style={{width: 8}} />
            <TouchableOpacity 
              style={[styles.formatBtn, layout === '1:1' && styles.formatBtnActive]}
              onPress={() => setLayout('1:1')}
              accessibilityRole="button"
              accessibilityState={{ selected: layout === '1:1' }}
            >
              <Text style={[styles.formatBtnText, layout === '1:1' && styles.formatBtnTextActive]}>1:1 (Instagram)</Text>
            </TouchableOpacity>
          </View>
          
          <Text style={styles.label}>EDITING STYLE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 16}}>
            <View style={{flexDirection: 'row', gap: 8}}>
              {STYLES.map((s) => (
                <TouchableOpacity 
                  key={s}
                  style={[styles.chipBtn, style === s && styles.chipBtnActive]}
                  onPress={() => setStyle(s)}
                >
                  <Text style={[styles.chipText, style === s && styles.chipTextActive]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <Text style={styles.label}>CUSTOM PROMPT (OPTIONAL)</Text>
          <TextInput
            style={[styles.input, {height: 80, textAlignVertical: 'top'}]}
            placeholder="e.g. Keep only the funniest moments..."
            placeholderTextColor="#666"
            value={prompt}
            onChangeText={setPrompt}
            multiline
          />

          {submitError ? <Text style={styles.errorText}>{submitError}</Text> : null}

          <TouchableOpacity 
            style={[styles.submitBtn, (!videoUrl && !video) && styles.submitBtnDisabled]}
            disabled={(!videoUrl && !video) || isLoading}
            accessibilityRole="button"
            onPress={handleSubmit}
          >
            {isLoading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.submitBtnText}>Start Auto Edit</Text>
            )}
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0a0a0a' },
  container: { padding: 20, paddingBottom: 40 },
  header: { marginBottom: 24 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#a3a3a3' },
  uploadWidget: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    borderRadius: 24,
    padding: 20,
    marginBottom: 24,
  },
  label: { fontSize: 11, fontWeight: 'bold', color: '#a3a3a3', letterSpacing: 1, marginBottom: 8, marginTop: 8 },
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
  formatRow: { flexDirection: 'row', marginBottom: 20 },
  formatBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  formatBtnActive: { backgroundColor: '#fff', borderColor: '#fff' },
  formatBtnText: { color: '#a3a3a3', fontWeight: 'bold', fontSize: 10, textAlign: 'center' },
  formatBtnTextActive: { color: '#000' },
  chipBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginRight: 8
  },
  chipBtnActive: {
    backgroundColor: '#fff',
    borderColor: '#fff',
  },
  chipText: { color: '#a3a3a3', fontWeight: 'bold', fontSize: 12 },
  chipTextActive: { color: '#000' },
  errorText: { color: '#f87171', fontSize: 13, marginTop: 8 },
  submitBtn: { backgroundColor: '#fff', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: '#000', fontWeight: 'bold', fontSize: 15 },
});
