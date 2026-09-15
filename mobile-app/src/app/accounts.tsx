import React, { useCallback, useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import api, { API_URL, errorMessage } from '@/lib/api';
import { PLATFORMS, platformName, type Account } from '@/lib/types';

// Reasons the backend sends back after an OAuth flow (?error=...)
const OAUTH_ERRORS: Record<string, string> = {
  setup_required: "This platform isn't configured on the server yet.",
  invalid_state: 'The connection link expired or was already used. Please try again.',
  access_denied: 'The connection was cancelled.',
  oauth_failed: "The platform didn't accept the connection. Please try again.",
  encryption_key_missing: 'The server needs ENCRYPTION_KEY before accounts can be connected.',
  unauthorized: 'Your session expired. Please try connecting again.',
  platform_not_implemented: "Connecting this platform isn't supported.",
};

export default function AccountsScreen() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [connecting, setConnecting] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await api.get<Account[]>('/api/accounts');
      setAccounts(res.data);
      setError('');
    } catch (e) {
      setError(errorMessage(e, 'Could not load connected accounts.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const connectAccount = async (platformId: string) => {
    setConnecting(platformId);
    setNotice(null);
    try {
      // The backend sends the browser back to this URL (mobileapp://accounts, or exp://... in Expo Go)
      const returnTo = Linking.createURL('accounts');
      // The OAuth pages run in a browser, which can't send the access token, so get a one-time ticket first
      const { data } = await api.post<{ ticket: string }>('/api/oauth/ticket', { platform: platformId, returnTo });
      const params = new URLSearchParams({ ticket: data.ticket, return_to: returnTo });
      const result = await WebBrowser.openAuthSessionAsync(`${API_URL}/auth/${platformId}?${params}`, returnTo);

      if (result.type === 'success') {
        const { queryParams } = Linking.parse(result.url);
        const oauthError = typeof queryParams?.error === 'string' ? queryParams.error : null;
        setNotice(oauthError
          ? { ok: false, text: OAUTH_ERRORS[oauthError] || 'Connecting the account failed.' }
          : { ok: true, text: `${platformName(platformId)} connected.` });
      }
      await fetchAccounts();
    } catch (e) {
      setNotice({ ok: false, text: errorMessage(e, 'Could not start connecting the account.') });
    } finally {
      setConnecting(null);
    }
  };

  const disconnectAccount = (account: Account) => {
    Alert.alert(
      `Disconnect ${account.account_name}?`,
      `Scheduled posts to ${platformName(account.platform)} will fail until you reconnect.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/api/accounts/${encodeURIComponent(account.id)}`);
              fetchAccounts();
            } catch (e) {
              setNotice({ ok: false, text: errorMessage(e, 'Could not disconnect the account.') });
            }
          },
        },
      ]
    );
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
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Social Accounts</Text>
          <Text style={styles.headerSubtitle}>Connect your social media accounts for fully automated publishing.</Text>
        </View>
      </View>

      {loading ? (
        <View style={[styles.center, { flex: 1 }]}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {notice && (
            <Text style={[styles.notice, notice.ok ? styles.noticeOk : styles.noticeError]}>{notice.text}</Text>
          )}
          {error ? <Text style={[styles.notice, styles.noticeError]}>{error}</Text> : null}

          {PLATFORMS.map(platform => {
            const connectedAccs = accounts.filter(a => a.platform === platform.id);
            const isConnected = connectedAccs.length > 0;

            return (
              <View key={platform.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.platformIcon}>
                    <View style={[styles.colorDot, { backgroundColor: platform.color }]} />
                  </View>
                  {!error && (isConnected ? (
                    <View style={styles.badgeConnected}>
                      <Text style={styles.badgeConnectedText}>✓ Connected</Text>
                    </View>
                  ) : (
                    <View style={styles.badgeNotConnected}>
                      <Text style={styles.badgeNotConnectedText}>✗ Not Connected</Text>
                    </View>
                  ))}
                </View>

                <Text style={styles.platformName}>{platform.name}</Text>

                <View style={styles.accountsList}>
                  {connectedAccs.map(acc => (
                    <View key={acc.id} style={styles.accountRow}>
                      <Text style={styles.accountName} numberOfLines={1}>{acc.account_name}</Text>
                      <TouchableOpacity onPress={() => disconnectAccount(acc)} accessibilityRole="button">
                        <Text style={styles.disconnectText}>Disconnect</Text>
                      </TouchableOpacity>
                    </View>
                  ))}

                  <TouchableOpacity
                    style={[styles.connectBtn, connecting !== null && styles.connectBtnDisabled]}
                    onPress={() => connectAccount(platform.id)}
                    disabled={connecting !== null}
                    accessibilityRole="button"
                  >
                    {connecting === platform.id
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={styles.connectBtnText}>{isConnected ? 'Reconnect or add account' : '+ Connect Account'}</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}

          <Text style={styles.footnote}>
            The server's BASE_URL must be reachable from this phone for the connection to finish.
          </Text>
        </ScrollView>
      )}
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
  notice: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    fontWeight: '600',
  },
  noticeOk: {
    color: '#4ade80',
    backgroundColor: 'rgba(34,197,94,0.1)',
    borderColor: 'rgba(34,197,94,0.3)',
  },
  noticeError: {
    color: '#f87171',
    backgroundColor: 'rgba(248,113,113,0.1)',
    borderColor: 'rgba(248,113,113,0.3)',
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
  connectBtnDisabled: {
    opacity: 0.5,
  },
  connectBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  footnote: {
    color: '#737373',
    fontSize: 12,
    textAlign: 'center',
  },
});
