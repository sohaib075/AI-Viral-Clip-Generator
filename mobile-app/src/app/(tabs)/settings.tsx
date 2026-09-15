import React, { useCallback, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import api, { API_URL, errorMessage, getApiToken, saveApiToken } from '@/lib/api';
import type { Session } from '@/lib/types';

export default function SettingsScreen() {
  const [session, setSession] = useState<Session | null>(null);
  const [connectionError, setConnectionError] = useState('');
  const [hasToken, setHasToken] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const checkSession = useCallback(async () => {
    try {
      const { data } = await api.get<Session>('/api/session');
      setSession(data);
      setConnectionError('');
    } catch (e) {
      setSession(null);
      setConnectionError(errorMessage(e, 'Could not reach the server.'));
    }
    setHasToken(Boolean(await getApiToken()));
  }, []);

  useFocusEffect(useCallback(() => { checkSession(); }, [checkSession]));

  const saveToken = async () => {
    setSaving(true);
    setMessage(null);
    const previous = await getApiToken();
    try {
      await saveApiToken(tokenInput.trim());
      const { data } = await api.get<Session>('/api/session');
      if (data.tokenRequired && !data.authenticated) {
        await saveApiToken(previous);
        setMessage({ ok: false, text: 'That access token is not valid.' });
      } else {
        setTokenInput('');
        setSession(data);
        setMessage({ ok: true, text: 'Access token saved on this device.' });
      }
    } catch (e) {
      await saveApiToken(previous);
      setMessage({ ok: false, text: errorMessage(e, 'Could not check the token.') });
    } finally {
      setHasToken(Boolean(await getApiToken()));
      setSaving(false);
    }
  };

  const clearToken = async () => {
    await saveApiToken(null);
    setMessage({ ok: true, text: 'Access token removed from this device.' });
    checkSession();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
        <Text style={styles.headerSubtitle}>Server connection and access.</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Server</Text>
          <Text style={styles.label}>API ADDRESS</Text>
          <Text style={styles.value} selectable>{API_URL}</Text>
          <Text style={styles.label}>STATUS</Text>
          {session ? (
            <Text style={[styles.value, { color: '#4ade80' }]}>✓ Connected</Text>
          ) : connectionError ? (
            <Text style={[styles.value, { color: '#f87171' }]}>{connectionError}</Text>
          ) : (
            <ActivityIndicator color="#fff" style={{ alignSelf: 'flex-start' }} />
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Access Token</Text>
          <Text style={styles.sectionDesc}>
            {session?.tokenRequired
              ? 'This server requires the API_TOKEN from backend/.env. It is stored securely on this device.'
              : 'This server does not require an access token.'}
          </Text>

          <Text style={styles.label}>{hasToken ? 'REPLACE ACCESS TOKEN' : 'ACCESS TOKEN'}</Text>
          <TextInput
            style={styles.input}
            value={tokenInput}
            onChangeText={setTokenInput}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="Paste the token"
            placeholderTextColor="#666"
            accessibilityLabel="Access token"
          />
          <TouchableOpacity
            style={[styles.saveBtn, (!tokenInput.trim() || saving) && styles.btnDisabled]}
            onPress={saveToken}
            disabled={!tokenInput.trim() || saving}
            accessibilityRole="button"
          >
            {saving ? <ActivityIndicator color="#000" /> : <Text style={styles.saveBtnText}>Save Token</Text>}
          </TouchableOpacity>
          {hasToken && (
            <TouchableOpacity onPress={clearToken} style={styles.linkBtn} accessibilityRole="button">
              <Text style={styles.dangerText}>Remove stored token</Text>
            </TouchableOpacity>
          )}
          {message && <Text style={message.ok ? styles.successText : styles.errorText}>{message.text}</Text>}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>More</Text>
          {[
            { label: 'Social Accounts', onPress: () => router.push('/accounts') },
            { label: 'Analytics', onPress: () => router.push('/analytics') },
            { label: 'How It Works', onPress: () => router.push('/how-it-works') },
          ].map(item => (
            <TouchableOpacity key={item.label} style={styles.row} onPress={item.onPress} accessibilityRole="button">
              <Text style={styles.rowText}>{item.label}</Text>
              <Text style={styles.rowChevron}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { padding: 20, paddingBottom: 10 },
  headerTitle: { fontSize: 28, fontWeight: '900', color: '#fff', marginBottom: 4 },
  headerSubtitle: { fontSize: 14, color: '#a3a3a3' },
  content: { padding: 20, paddingBottom: 40, gap: 16 },
  section: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff', marginBottom: 8 },
  sectionDesc: { fontSize: 13, color: '#a3a3a3', marginBottom: 8 },
  label: { color: '#a3a3a3', fontSize: 11, fontWeight: 'bold', letterSpacing: 1, marginBottom: 6, marginTop: 12 },
  value: { color: '#fff', fontSize: 14 },
  input: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 14,
  },
  saveBtn: { backgroundColor: '#fff', paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 12 },
  saveBtnText: { color: '#000', fontWeight: 'bold', fontSize: 15 },
  btnDisabled: { opacity: 0.5 },
  linkBtn: { alignItems: 'center', paddingTop: 12 },
  dangerText: { color: '#f87171', fontWeight: 'bold', fontSize: 13 },
  successText: { color: '#4ade80', fontSize: 13, marginTop: 12 },
  errorText: { color: '#f87171', fontSize: 13, marginTop: 12 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  rowText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  rowChevron: { color: '#737373', fontSize: 22 },
});
