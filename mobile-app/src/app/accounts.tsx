import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  ActivityIndicator,
  TouchableOpacity,
  Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import api, { API_URL } from '@/lib/api';

interface Account {
  id: string;
  platform: string;
  account_name: string;
  status: string;
}

const PLATFORMS = [
  { id: 'youtube', name: 'YouTube Shorts', color: '#ef4444' },
  { id: 'instagram', name: 'Instagram Reels', color: '#ec4899' },
  { id: 'tiktok', name: 'TikTok', color: '#25F4EE' },
  { id: 'facebook', name: 'Facebook Reels', color: '#3b82f6' },
  { id: 'linkedin', name: 'LinkedIn', color: '#1d4ed8' },
  { id: 'x', name: 'X (Twitter)', color: '#ffffff' },
];

export default function AccountsScreen() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAccounts = async () => {
    try {
      const res = await api.get('/api/accounts');
      setAccounts(res.data);
    } catch (e) {
      console.error('Failed to fetch accounts', e);
      // Fallback for UI if backend is not reachable
      setAccounts([
        { id: '1', platform: 'youtube', account_name: 'AI Studios', status: 'connected' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const connectAccount = async (platformId: string) => {
    const url = `${API_URL}/auth/${platformId}`;
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      console.error("Don't know how to open URI: " + url);
    }
  };

  const disconnectAccount = async (id: string) => {
    try {
      await api.delete(`/api/accounts/${id}`);
      fetchAccounts();
    } catch (e) {
      console.error("Failed to disconnect", e);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.center]}>
        <ActivityIndicator size="large" color="#fff" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Social Accounts</Text>
          <Text style={styles.headerSubtitle}>Connect your social media accounts for fully automated publishing.</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        
        {PLATFORMS.map(platform => {
          const connectedAccs = accounts.filter(a => a.platform === platform.id);
          const isConnected = connectedAccs.length > 0;

          return (
            <View key={platform.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.platformIcon}>
                  {/* Fake icon for platform */}
                  <View style={[styles.colorDot, { backgroundColor: platform.color }]} />
                </View>
                {isConnected ? (
                  <View style={styles.badgeConnected}>
                    <Text style={styles.badgeConnectedText}>✓ Connected</Text>
                  </View>
                ) : (
                  <View style={styles.badgeNotConnected}>
                    <Text style={styles.badgeNotConnectedText}>✗ Not Connected</Text>
                  </View>
                )}
              </View>
              
              <Text style={styles.platformName}>{platform.name}</Text>
              
              <View style={styles.accountsList}>
                {connectedAccs.map(acc => (
                  <View key={acc.id} style={styles.accountRow}>
                    <Text style={styles.accountName} numberOfLines={1}>{acc.account_name}</Text>
                    <TouchableOpacity onPress={() => disconnectAccount(acc.id)}>
                      <Text style={styles.disconnectText}>Disconnect</Text>
                    </TouchableOpacity>
                  </View>
                ))}

                <TouchableOpacity 
                  style={styles.connectBtn}
                  onPress={() => connectAccount(platform.id)}
                >
                  <Text style={styles.connectBtnText}>+ Connect Account</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

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
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 10,
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
    marginRight: 16,
  },
  backBtnText: {
    color: '#fff',
    fontSize: 20,
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
    gap: 16,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  platformIcon: {
    width: 48,
    height: 48,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  badgeConnected: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  badgeConnectedText: {
    color: '#4ade80',
    fontSize: 12,
    fontWeight: 'bold',
  },
  badgeNotConnected: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  badgeNotConnectedText: {
    color: '#a3a3a3',
    fontSize: 12,
    fontWeight: 'bold',
  },
  platformName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
  },
  accountsList: {
    gap: 12,
  },
  accountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  accountName: {
    color: '#d4d4d4',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  disconnectText: {
    color: '#f87171',
    fontSize: 12,
    fontWeight: 'bold',
  },
  connectBtn: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  connectBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  }
});
