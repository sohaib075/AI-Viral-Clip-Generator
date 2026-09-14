import axios from 'axios';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Backend URL. Builds that don't run against the dev server need EXPO_PUBLIC_API_URL
// (set per build profile in eas.json, or in a .env file), e.g. http://192.168.1.100:5000
// for a phone on the same Wi-Fi as your PC, or an https:// URL for a deployed backend.
const getBaseUrl = () => {
  const configured = process.env.EXPO_PUBLIC_API_URL;
  if (configured) {
    return configured.replace(/\/+$/, '');
  }

  if (__DEV__) {
    // If running in Expo Go on a physical device, this will resolve the development PC's IP address.
    const debuggerHost = Constants.expoConfig?.hostUri;
    if (debuggerHost) {
      const localhost = debuggerHost.split(':')[0];
      return `http://${localhost}:5000`;
    }

    // Fallbacks
    // For Android Emulator, localhost doesn't work out of the box, use 10.0.2.2
    if (Platform.OS === 'android') {
      return 'http://10.0.2.2:5000';
    }
    return 'http://localhost:5000';
  }

  console.error('EXPO_PUBLIC_API_URL is not set, so this build cannot reach the backend. Set it in the eas.json build profile.');
  return 'http://localhost:5000';
};

export const API_URL = getBaseUrl();

export const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Global error handling
    console.error('API Error:', error.message);
    if (error.response) {
      console.error('API Error Data:', error.response.data);
    }
    return Promise.reject(error);
  }
);

export default api;
