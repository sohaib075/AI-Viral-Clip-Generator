import React from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TouchableOpacity
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

const STEPS = [
  {
    id: 1,
    title: "1. Video Acquisition",
    icon: "⚙️",
    desc: "Submit a YouTube link or upload a local file. The Node.js backend handles the file securely and extracts the high-quality audio track using FFmpeg."
  },
  {
    id: 2,
    title: "2. Offline Transcription",
    icon: "🎙️",
    desc: "OpenAI Whisper runs 100% locally to transcribe the audio into text with extreme accuracy, generating word-level timestamps."
  },
  {
    id: 3,
    title: "3. NLP Highlight Detection",
    icon: "🧠",
    desc: "Our custom NLP engine uses spaCy and NLTK to score segments based on keyword density (TF-IDF), sentiment, and Named Entity Recognition to find the 'viral' moments."
  },
  {
    id: 4,
    title: "4. Automated Video Editing",
    icon: "🎬",
    desc: "MoviePy crops the video into a 9:16 vertical format, and FFmpeg burns the generated SRT subtitles directly into the final MP4."
  }
];

export default function HowItWorksScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>How It Works</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        
        <View style={styles.introSection}>
          <Text style={styles.introTitle}>A fully open-source, locally run AI pipeline.</Text>
          <Text style={styles.introDesc}>
            Transforms long-form content into viral shorts with zero paid API dependencies.
          </Text>
        </View>

        <View style={styles.stepsContainer}>
          {STEPS.map(step => (
            <View key={step.id} style={styles.stepCard}>
              <View style={styles.stepIconWrapper}>
                <Text style={styles.stepIcon}>{step.icon}</Text>
              </View>
              <Text style={styles.stepTitle}>{step.title}</Text>
              <Text style={styles.stepDesc}>{step.desc}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.ctaBtn} onPress={() => router.push('/')}>
          <Text style={styles.ctaBtnText}>Try it Now</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 10,
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
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
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  introSection: {
    marginBottom: 32,
    alignItems: 'center',
  },
  introTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 12,
  },
  introDesc: {
    fontSize: 16,
    color: '#a3a3a3',
    textAlign: 'center',
    lineHeight: 24,
  },
  stepsContainer: {
    gap: 16,
    marginBottom: 40,
  },
  stepCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 24,
    alignItems: 'flex-start',
  },
  stepIconWrapper: {
    width: 56,
    height: 56,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  stepIcon: {
    fontSize: 24,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  stepDesc: {
    fontSize: 15,
    color: '#d4d4d4',
    lineHeight: 22,
  },
  ctaBtn: {
    backgroundColor: '#fff',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  ctaBtnText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 18,
  }
});
