import React, { useEffect, useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import api from '@/lib/api';

export default function ProcessingScreen() {
  const { jobId } = useLocalSearchParams();
  const [statusMessage, setStatusMessage] = useState('Initializing AI Pipeline...');
  const [progress, setProgress] = useState(0);
  const [startTime] = useState(Date.now());
  const [estimatedTimeLeft, setEstimatedTimeLeft] = useState('Calculating...');
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!jobId) return;
    
    const interval = setInterval(async () => {
      try {
        const response = await api.get(`/api/jobs/${jobId}`);
        const data = response.data;
        
        setStatusMessage(data.message || 'Processing...');
        const currentProgress = data.progress || 0;
        setProgress(currentProgress);
        
        if (currentProgress > 0 && currentProgress < 100) {
          const elapsedMs = Date.now() - startTime;
          const estimatedTotalMs = (elapsedMs / currentProgress) * 100;
          const remainingMs = estimatedTotalMs - elapsedMs;
          
          if (remainingMs > 0) {
            const remainingSecs = Math.floor(remainingMs / 1000);
            if (remainingSecs > 60) {
              setEstimatedTimeLeft(`~${Math.ceil(remainingSecs / 60)} mins`);
            } else {
              setEstimatedTimeLeft(`~${remainingSecs} secs`);
            }
          } else {
            setEstimatedTimeLeft('Almost done...');
          }
        } else if (currentProgress >= 100 || data.status === 'completed') {
          setEstimatedTimeLeft('Complete');
        }

        if (data.status === 'completed') {
          clearInterval(interval);
          setTimeout(() => {
            router.replace({
              pathname: '/results',
              params: { jobId: jobId as string }
            });
          }, 1000);
        } else if (data.status === 'failed') {
          clearInterval(interval);
          setStatusMessage(data.message || 'Processing Failed');
          setEstimatedTimeLeft('Failed');
          setHasError(true);
        }
      } catch (e) {
        console.error("Polling error", e);
        clearInterval(interval);
        setStatusMessage('Network Error occurred while polling');
        setEstimatedTimeLeft('Failed');
        setHasError(true);
      }
    }, 2000);
    
    return () => clearInterval(interval);
  }, [jobId, startTime]);

  if (hasError) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.center]}>
        <View style={styles.errorIcon}>
          <Text style={{fontSize: 48, color: '#ef4444'}}>❌</Text>
        </View>
        <Text style={styles.errorTitle}>Oops! Something went wrong.</Text>
        <Text style={styles.errorMessage}>{statusMessage}</Text>
        <TouchableOpacity style={styles.btn} onPress={() => router.push('/')}>
          <Text style={styles.btnText}>Return to Main Page</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, styles.center]}>
      <View style={styles.iconWrapper}>
        <ActivityIndicator size="large" color="#000" />
      </View>
      
      <Text style={styles.title}>AI Magic at Work</Text>
      <Text style={styles.subtitle}>{statusMessage}</Text>
      
      <View style={styles.progressBarContainer}>
        <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
      </View>
      
      <View style={styles.progressTextRow}>
        <Text style={styles.progressText}>{progress}% Completed</Text>
        {jobId && <Text style={styles.jobIdText}>Job ID: {jobId}</Text>}
      </View>
      
      <Text style={styles.etaText}>Estimated Time Left: {estimatedTimeLeft}</Text>
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
    backgroundColor: '#fff',
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
    borderWidth: 4,
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
    marginBottom: 40,
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
  },
  progressText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  jobIdText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
  },
  etaText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
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
  },
  btnText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 16,
  }
});
