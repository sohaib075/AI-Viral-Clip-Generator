import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import api from '@/lib/api';

export default function SettingsScreen() {
  const [userProfile, setUserProfile] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('profile');
  
  const [apiKeys, setApiKeys] = useState([
    { id: '1', name: 'Production App', key: 'sk_live_...a8f2', created: 'Oct 12, 2023', lastUsed: '2 mins ago' },
    { id: '2', name: 'Development Testing', key: 'sk_test_...b9e4', created: 'Nov 05, 2023', lastUsed: '1 day ago' }
  ]);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await api.get('/api/user/settings');
        setUserProfile(response.data.profile || {
          firstName: 'Alex',
          lastName: 'Developer',
          email: 'alex@example.com',
          company: 'AI Studios'
        });
        if (response.data.apiKeys) {
          setApiKeys(response.data.apiKeys);
        }
      } catch (e) {
        console.error('Failed to fetch settings', e);
        setUserProfile({
          firstName: 'Alex',
          lastName: 'Developer',
          email: 'alex@example.com',
          company: 'AI Studios'
        });
      }
    };
    fetchSettings();
  }, []);

  if (!userProfile) {
    return (
      <View style={[styles.safeArea, styles.center]}>
        <ActivityIndicator size="large" color="#66fcf1" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
        <Text style={styles.headerSubtitle}>Manage account and API keys.</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll}>
          <TouchableOpacity 
            style={[styles.tabBtn, activeTab === 'profile' && styles.tabBtnActive]}
            onPress={() => setActiveTab('profile')}
          >
            <Text style={[styles.tabText, activeTab === 'profile' && styles.tabTextActive]}>Profile</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tabBtn, activeTab === 'apikeys' && styles.tabBtnActive]}
            onPress={() => setActiveTab('apikeys')}
          >
            <Text style={[styles.tabText, activeTab === 'apikeys' && styles.tabTextActive]}>API Keys</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.tabBtn}
            onPress={() => router.push('/accounts')}
          >
            <Text style={styles.tabText}>Social Accounts</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tabBtn}>
            <Text style={styles.tabText}>Billing</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        
        {activeTab === 'profile' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Profile Information</Text>
            
            <View style={styles.avatarRow}>
              <View style={styles.avatarContainer}>
                <Image 
                  source={{ uri: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=800&auto=format&fit=crop&q=80' }} 
                  style={styles.avatar} 
                />
              </View>
              <View style={styles.avatarActions}>
                <TouchableOpacity style={styles.changeAvatarBtn}>
                  <Text style={styles.changeAvatarText}>Change Avatar</Text>
                </TouchableOpacity>
                <Text style={styles.avatarHint}>JPG, GIF or PNG. 1MB max.</Text>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>FIRST NAME</Text>
              <TextInput style={styles.input} defaultValue={userProfile.firstName} placeholderTextColor="#666" />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>LAST NAME</Text>
              <TextInput style={styles.input} defaultValue={userProfile.lastName} placeholderTextColor="#666" />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>EMAIL ADDRESS</Text>
              <TextInput style={styles.input} defaultValue={userProfile.email} keyboardType="email-address" autoCapitalize="none" placeholderTextColor="#666" />
            </View>

            <TouchableOpacity style={styles.saveBtn}>
              <Text style={styles.saveBtnText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        )}

        {activeTab === 'apikeys' && (
          <View style={styles.section}>
            <View style={styles.apiHeaderRow}>
              <Text style={styles.sectionTitle}>API Keys</Text>
              <TouchableOpacity style={styles.newKeyBtn}>
                <Text style={styles.newKeyBtnText}>+ New Key</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.warningBox}>
              <Text style={styles.warningTitle}>⚠ Keep your keys secure</Text>
              <Text style={styles.warningText}>
                Do not share your API keys in publicly accessible areas. We automatically scan for exposed keys.
              </Text>
            </View>

            {apiKeys.map(k => (
              <View key={k.id} style={styles.keyCard}>
                <View style={styles.keyHeader}>
                  <Text style={styles.keyName}>{k.name}</Text>
                  <View style={styles.keyActions}>
                    <TouchableOpacity style={styles.iconBtn}>
                      <Text style={styles.iconText}>⎘</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.iconBtn, {backgroundColor: 'rgba(239, 68, 68, 0.1)'}]}>
                      <Text style={[styles.iconText, {color: '#ef4444'}]}>🗑</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                
                <Text style={styles.keyValue}>{k.key}</Text>
                
                <View style={styles.keyFooter}>
                  <Text style={styles.keyMeta}>Created: {k.created}</Text>
                  <Text style={styles.keyMeta}>Last Used: {k.lastUsed}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

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
  },
  tabsContainer: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  tabsScroll: {
    paddingHorizontal: 20,
    gap: 24,
  },
  tabBtn: {
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: '#66fcf1',
  },
  tabText: {
    color: '#737373',
    fontWeight: 'bold',
    fontSize: 15,
  },
  tabTextActive: {
    color: '#fff',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  section: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    marginBottom: 24,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    padding: 2,
    backgroundColor: '#66fcf1',
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 40,
    borderWidth: 2,
    borderColor: '#000',
  },
  avatarActions: {
    flex: 1,
  },
  changeAvatarBtn: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  changeAvatarText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  avatarHint: {
    color: '#737373',
    fontSize: 11,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    color: '#a3a3a3',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 14,
  },
  saveBtn: {
    backgroundColor: '#fff',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  saveBtnText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 15,
  },
  apiHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  newKeyBtn: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  newKeyBtnText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 12,
  },
  warningBox: {
    backgroundColor: 'rgba(234, 179, 8, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(234, 179, 8, 0.2)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  warningTitle: {
    color: '#facc15',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  warningText: {
    color: 'rgba(250, 204, 21, 0.8)',
    fontSize: 12,
    lineHeight: 18,
  },
  keyCard: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  keyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  keyName: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  keyActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    color: '#fff',
  },
  keyValue: {
    color: '#66fcf1',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 13,
    marginBottom: 16,
  },
  keyFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    paddingTop: 12,
  },
  keyMeta: {
    color: '#737373',
    fontSize: 10,
  }
});
