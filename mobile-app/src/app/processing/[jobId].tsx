import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image
} from 'react-native';
import Animated, { Easing, withRepeat, withTiming, useSharedValue, useAnimatedStyle, withSequence } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import api, { errorMessage, errorStatus } from '@/lib/api';
import type { JobStatusResponse } from '@/lib/types';

const POLL_INTERVAL_MS = 2000;
// Keep retrying through brief outages (Wi-Fi blips, the AI service restarting) before giving up
const MAX_CONSECUTIVE_ERRORS = 15;

const leave = () => {
  if (router.canGoBack()) router.back();
  else router.replace('/');
};

export default function ProcessingScreen() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const [statusMessage, setStatusMessage] = useState('Initializing AI Pipeline...');
  const [progress, setProgress] = useState(0);
  const [estimatedTimeLeft, setEstimatedTimeLeft] = useState('Calculating...');
  const [connectionIssue, setConnectionIssue] = useState('');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  const pulseScale = useSharedValue(1);

  useEffect(() => {
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) })
      ),
      -1, // infinite
      true
    );
  }, [pulseScale]);

  const animatedLogoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }]
  }));

  useEffect(() => {
    if (!jobId) return;

    const startTime = Date.now();
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let consecutiveErrors = 0;

    const poll = async () => {
      try {
        const { data } = await api.get<JobStatusResponse>(`/api/jobs/${encodeURIComponent(jobId)}`, { signal: controller.signal });
        if (controller.signal.aborted) return;
        consecutiveErrors = 0;
        setConnectionIssue('');

        if (data.status === 'failed') {
          setError(data.message || 'Processing failed');
          return;
        }

        const currentProgress = data.progress || 0;
        setProgress(currentProgress);
        setStatusMessage(data.message || 'Processing...');

        if (data.status === 'completed') {
          setEstimatedTimeLeft('Complete');
          timer = setTimeout(() => {
            router.replace({ pathname: '/results', params: { jobId } });
          }, 1000);
          return;
        }

        if (currentProgress > 0 && currentProgress < 100) {
          const elapsedMs = Date.now() - startTime;
          const remainingSecs = Math.floor(((elapsedMs / currentProgress) * 100 - elapsedMs) / 1000);
          setEstimatedTimeLeft(remainingSecs <= 0 ? 'Almost done...' : remainingSecs > 60 ? `~${Math.ceil(remainingSecs / 60)} mins` : `~${remainingSecs} secs`);
        }
      } catch (e) {
        if (controller.signal.aborted) return;
        consecutiveErrors += 1;
        const notFound = errorStatus(e) === 404;
        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          setError(notFound ? 'This job could not be found.' : errorMessage(e, 'Lost connection to the server.'));
          return;
        }
        setConnectionIssue(notFound ? 'Waiting for the job to start...' : 'Connection problem, retrying...');
      }
      timer = setTimeout(poll, POLL_INTERVAL_MS);
    };

    poll();
    return () => {
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [jobId, attempt]);

  if (error) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.center]}>
        <View style={styles.errorIcon}>
          <Text style={{fontSize: 48, color: '#ef4444'}}>❌</Text>
        </View>
        <Text style={styles.errorTitle}>Oops! Something went wrong.</Text>
        <Text style={styles.errorMessage}>{error}</Text>
        <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={() => { setError(''); setAttempt(a => a + 1); }} accessibilityRole="button">
          <Text style={styles.btnSecondaryText}>Check Again</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btn} onPress={leave} accessibilityRole="button">
          <Text style={styles.btnText}>Close</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, styles.center]}>
      <Animated.View style={[styles.iconWrapper, animatedLogoStyle]}>
        <Image source={require('@/assets/images/icon.png')} style={{ width: 80, height: 80, borderRadius: 20 }} />
      </Animated.View>

      <Text style={styles.title}>AI Magic at Work</Text>
      <Text style={styles.subtitle} accessibilityLiveRegion="polite">{statusMessage}</Text>
      <Text style={styles.connectionText}>{connectionIssue}</Text>

      <View style={styles.progressBarContainer} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: progress }}>
        <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
      </View>

      <View style={styles.progressTextRow}>
        <Text style={styles.progressText}>{progress}% Completed</Text>
        {jobId && <Text style={styles.jobIdText} numberOfLines={1}>Job ID: {jobId}</Text>}
      </View>

      <Text style={styles.etaText}>Estimated Time Left: {estimatedTimeLeft}</Text>
      <Text style={styles.hint}>You can close this screen; the job keeps running and appears in Projects.</Text>
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
    padding: 24,
  },
  iconWrapper: {
    width: 100,
    height: 100,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#fff',
    marginBottom: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  connectionText: {
    color: '#facc15',
    fontSize: 13,
    minHeight: 18,
    marginBottom: 24,
    textAlign: 'center',
  },
  progressBarContainer: {
    width: '100%',
    height: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 6,
    marginBottom: 16,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 6,
  },
  progressTextRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 12,
  },
  progressText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  jobIdText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    flexShrink: 1,
  },
  etaText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  hint: {
    color: '#737373',
    fontSize: 12,
    marginTop: 24,
    textAlign: 'center',
  },
  errorIcon: {
    marginBottom: 24,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#fff',
    marginBottom: 16,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    color: '#ef4444',
    fontWeight: 'bold',
    marginBottom: 40,
    textAlign: 'center',
  },
  btn: {
    backgroundColor: '#fff',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 12,
    minWidth: 220,
    alignItems: 'center',
  },
  btnText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 16,
  },
  btnSecondary: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  btnSecondaryText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
