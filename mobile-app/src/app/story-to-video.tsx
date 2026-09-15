import React, { useState } from 'react';
import { router } from 'expo-router';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api, { errorMessage } from '@/lib/api';

const STYLES = ['Cinematic', 'Anime', 'Realistic', 'Cyberpunk', 'Cartoon', 'Watercolor', '3D Animation'];
const ASPECTS = [
  { id: '9:16', label: '9:16 Vertical' },
  { id: '16:9', label: '16:9 Horizontal' },
  { id: '1:1', label: '1:1 Square' },
];
const VOICES = [
  { id: 'en-US-ChristopherNeural', label: 'Christopher (Deep Male)' },
  { id: 'en-US-AriaNeural', label: 'Aria (Clear Female)' },
  { id: 'en-US-GuyNeural', label: 'Guy (Friendly Male)' },
  { id: 'en-GB-SoniaNeural', label: 'Sonia (British Female)' },
];

const Chip = ({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) => (
  <TouchableOpacity
    style={[styles.chip, selected && styles.chipActive]}
    onPress={onPress}
    accessibilityRole="button"
    accessibilityState={{ selected }}
  >
    <Text style={[styles.chipText, selected && styles.chipTextActive]}>{label}</Text>
  </TouchableOpacity>
);

export default function StoryToVideoScreen() {
  const [story, setStory] = useState('');
  const [style, setStyle] = useState('Cinematic');
  const [aspectRatio, setAspectRatio] = useState('9:16');
  const [voice, setVoice] = useState('en-US-ChristopherNeural');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!story.trim()) {
      setError('Please enter a story or script first.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const { data } = await api.post<{ jobId: string }>('/api/story-to-video', { story, style, voice, aspectRatio });
      router.replace({ pathname: '/processing/[jobId]', params: { jobId: data.jobId } });
    } catch (e) {
      setError(errorMessage(e, 'Failed to start the job.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>AI Story to Video</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.intro}>
            Paste a story, script or chapter. The AI splits it into scenes, paints the visuals, records the narration and renders a video.
          </Text>

          <Text style={styles.label}>YOUR STORY</Text>
          <TextInput
            style={styles.storyInput}
            value={story}
            onChangeText={setStory}
            placeholder="Once upon a time in a cyberpunk city..."
            placeholderTextColor="#666"
            multiline
            maxLength={20000}
            editable={!submitting}
            accessibilityLabel="Your story"
          />
          <Text style={styles.counter}>{story.length.toLocaleString()} / 20,000</Text>

          <Text style={styles.label}>VIDEO STYLE</Text>
          <View style={styles.chipRow}>
            {STYLES.map(s => <Chip key={s} label={s} selected={style === s} onPress={() => setStyle(s)} />)}
          </View>

          <Text style={styles.label}>ASPECT RATIO</Text>
          <View style={styles.chipRow}>
            {ASPECTS.map(a => <Chip key={a.id} label={a.label} selected={aspectRatio === a.id} onPress={() => setAspectRatio(a.id)} />)}
          </View>

          <Text style={styles.label}>NARRATION VOICE</Text>
          <View style={styles.chipRow}>
            {VOICES.map(v => <Chip key={v.id} label={v.label} selected={voice === v.id} onPress={() => setVoice(v.id)} />)}
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.submitBtn, (submitting || !story.trim()) && styles.submitBtnDisabled]}
            onPress={submit}
            disabled={submitting || !story.trim()}
            accessibilityRole="button"
          >
            {submitting ? <ActivityIndicator color="#000" /> : <Text style={styles.submitBtnText}>Generate Video</Text>}
          </TouchableOpacity>
          <Text style={styles.hint}>Generation usually takes 1-3 minutes.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, paddingBottom: 10, gap: 16 },
  backBtn: { width: 40, height: 40, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  backBtnText: { color: '#fff', fontSize: 20 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#fff', flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  intro: { color: '#a3a3a3', fontSize: 14, lineHeight: 20, marginBottom: 12 },
  label: { color: '#a3a3a3', fontSize: 11, fontWeight: 'bold', letterSpacing: 1, marginBottom: 8, marginTop: 16 },
  storyInput: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    color: '#fff',
    padding: 16,
    fontSize: 14,
    minHeight: 180,
    textAlignVertical: 'top',
  },
  counter: { color: '#737373', fontSize: 11, textAlign: 'right', marginTop: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  chipActive: { backgroundColor: '#fff', borderColor: '#fff' },
  chipText: { color: '#a3a3a3', fontWeight: 'bold', fontSize: 12 },
  chipTextActive: { color: '#000' },
  errorText: { color: '#f87171', fontSize: 13, marginTop: 16 },
  submitBtn: { backgroundColor: '#fff', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 24 },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: '#000', fontWeight: 'bold', fontSize: 15 },
  hint: { color: '#737373', fontSize: 12, textAlign: 'center', marginTop: 12 },
});
