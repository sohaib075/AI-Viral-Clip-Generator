import React, { useState } from 'react';
import { router } from 'expo-router';
import api from '@/lib/api';
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

export default function AutoEditScreen() {
  const [videoUrl, setVideoUrl] = useState('');
  const [layout, setLayout] = useState('9:16');
  const [style, setStyle] = useState('Cinematic');
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const STYLES = ['Cinematic', 'Viral Reels', 'TikTok', 'Podcast', 'Motivational', 'Vlog', 'Gaming'];

  const handleSubmit = async () => {
    if (!videoUrl) return;
    setIsLoading(true);
    try {
      const response = await api.post('/api/auto-edit', {
        videoUrl: videoUrl,
        layout: layout,
        style: style,
        prompt: prompt
      });
      setIsLoading(false);
      // Navigate to processing screen for auto-edit jobs
      router.push(`/processing/${response.data.jobId}` as any);
    } catch (error) {
      console.error("Failed to submit auto edit job", error);
      setIsLoading(false);
      alert('Failed to submit job. Please check the URL and backend connection.');
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
          <Text style={styles.subtitle}>AI-powered professional editing</Text>
        </View>

        <View style={styles.uploadWidget}>
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
          
          <Text style={styles.label}>TARGET ASPECT RATIO</Text>
          <View style={styles.formatRow}>
            <TouchableOpacity 
              style={[styles.formatBtn, layout === '9:16' && styles.formatBtnActive]}
              onPress={() => setLayout('9:16')}
            >
              <Text style={[styles.formatBtnText, layout === '9:16' && styles.formatBtnTextActive]}>9:16 (Reels/TikTok)</Text>
            </TouchableOpacity>
            <View style={{width: 8}} />
            <TouchableOpacity 
              style={[styles.formatBtn, layout === '16:9' && styles.formatBtnActive]}
              onPress={() => setLayout('16:9')}
            >
              <Text style={[styles.formatBtnText, layout === '16:9' && styles.formatBtnTextActive]}>16:9 (YouTube)</Text>
            </TouchableOpacity>
            <View style={{width: 8}} />
            <TouchableOpacity 
              style={[styles.formatBtn, layout === '1:1' && styles.formatBtnActive]}
              onPress={() => setLayout('1:1')}
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
            placeholder="e.g. Make it highly energetic with fast cuts..."
            placeholderTextColor="#666"
            value={prompt}
            onChangeText={setPrompt}
            multiline
          />

          <TouchableOpacity 
            style={[styles.submitBtn, !videoUrl && styles.submitBtnDisabled]}
            disabled={!videoUrl || isLoading}
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
  submitBtn: { backgroundColor: '#fff', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: '#000', fontWeight: 'bold', fontSize: 15 },
});
