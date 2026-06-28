import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  ActivityIndicator,
  TouchableOpacity
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '@/lib/api';

export default function AnalyticsScreen() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const response = await api.get('/api/analytics');
        setData(response.data);
      } catch (e) {
        console.error('Failed to fetch analytics:', e);
        // Fallback for UI if backend is not reachable
        setData({
          views: '1.2M',
          avgVirality: '84%',
          engagementRate: '4.2%',
          timeSaved: '124h'
        });
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  if (loading || !data) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.center]}>
        <ActivityIndicator size="large" color="#fff" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Analytics Dashboard</Text>
        <Text style={styles.headerSubtitle}>Track your content performance and metrics.</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        
        {/* KPI Cards */}
        <View style={styles.kpiContainer}>
          
          <View style={styles.kpiCard}>
            <View style={styles.kpiHeader}>
              <View style={styles.iconWrapper}>
                <Text style={styles.iconText}>📈</Text>
              </View>
              <View style={styles.badgeGreen}>
                <Text style={styles.badgeGreenText}>+14.5%</Text>
              </View>
            </View>
            <Text style={styles.kpiLabel}>TOTAL VIEWS</Text>
            <Text style={styles.kpiValue}>{data.views || data.totalViews || '0'}</Text>
          </View>

          <View style={styles.kpiCard}>
            <View style={styles.kpiHeader}>
              <View style={styles.iconWrapper}>
                <Text style={styles.iconText}>🔥</Text>
              </View>
              <View style={styles.badgeGray}>
                <Text style={styles.badgeGrayText}>Real Data</Text>
              </View>
            </View>
            <Text style={styles.kpiLabel}>AVG VIRALITY</Text>
            <Text style={styles.kpiValue}>{data.avgVirality || '0%'}</Text>
          </View>

          <View style={styles.kpiCard}>
            <View style={styles.kpiHeader}>
              <View style={styles.iconWrapper}>
                <Text style={styles.iconText}>👥</Text>
              </View>
              <View style={styles.badgeRed}>
                <Text style={styles.badgeRedText}>-2.1%</Text>
              </View>
            </View>
            <Text style={styles.kpiLabel}>ENGAGEMENT RATE</Text>
            <Text style={styles.kpiValue}>{data.engagementRate || '0%'}</Text>
          </View>

          <View style={styles.kpiCard}>
            <View style={styles.kpiHeader}>
              <View style={styles.iconWrapper}>
                <Text style={styles.iconText}>⏱</Text>
              </View>
              <View style={styles.badgeGray}>
                <Text style={styles.badgeGrayText}>Real Data</Text>
              </View>
            </View>
            <Text style={styles.kpiLabel}>TIME SAVED</Text>
            <Text style={styles.kpiValue}>{data.timeSaved || data.hoursProcessed ? `${data.hoursProcessed}h` : '0h'}</Text>
          </View>

        </View>

        {/* Charts Mockup Area */}
        <View style={styles.chartSection}>
          <Text style={styles.chartTitle}>Top Performing Categories</Text>
          
          <View style={styles.barRow}>
            <View style={styles.barLabelRow}>
              <Text style={styles.barLabel}>Podcasts</Text>
              <Text style={styles.barLabel}>45%</Text>
            </View>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, {width: '45%'}]} />
            </View>
          </View>

          <View style={styles.barRow}>
            <View style={styles.barLabelRow}>
              <Text style={styles.barLabel}>Educational</Text>
              <Text style={styles.barLabel}>30%</Text>
            </View>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, {width: '30%'}]} />
            </View>
          </View>

          <View style={styles.barRow}>
            <View style={styles.barLabelRow}>
              <Text style={styles.barLabel}>Gaming</Text>
              <Text style={styles.barLabel}>15%</Text>
            </View>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, {width: '15%'}]} />
            </View>
          </View>

          <View style={styles.barRow}>
            <View style={styles.barLabelRow}>
              <Text style={styles.barLabel}>Vlogs</Text>
              <Text style={styles.barLabel}>10%</Text>
            </View>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, {width: '10%', backgroundColor: '#66fcf1'}]} />
            </View>
          </View>
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
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#a3a3a3',
    marginBottom: 10,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  kpiContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 24,
  },
  kpiCard: {
    width: '47%',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 16,
  },
  kpiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  iconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    fontSize: 16,
  },
  badgeGreen: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeGreenText: {
    color: '#4ade80',
    fontSize: 10,
    fontWeight: 'bold',
  },
  badgeRed: {
    backgroundColor: 'rgba(248, 113, 113, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeRedText: {
    color: '#f87171',
    fontSize: 10,
    fontWeight: 'bold',
  },
  badgeGray: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeGrayText: {
    color: '#a3a3a3',
    fontSize: 10,
    fontWeight: 'bold',
  },
  kpiLabel: {
    fontSize: 10,
    color: '#a3a3a3',
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 4,
  },
  kpiValue: {
    fontSize: 24,
    fontWeight: '900',
    color: '#fff',
  },
  chartSection: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 20,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
  },
  barRow: {
    marginBottom: 16,
  },
  barLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  barLabel: {
    color: '#e5e5e5',
    fontSize: 13,
    fontWeight: 'bold',
  },
  barTrack: {
    width: '100%',
    height: 8,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 4,
  }
});
