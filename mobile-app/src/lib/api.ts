import axios from 'axios';
import { Platform } from 'react-native';

// For Android Emulator, localhost doesn't work out of the box, use 10.0.2.2
// For physical devices on the same WiFi, you would change this to your computer's IP address
// e.g. 'http://192.168.1.100:5000'
import Constants from 'expo-constants';

const getBaseUrl = () => {
  if (__DEV__) {
    // If running in Expo Go on a physical device, this will resolve the development PC's IP address.
    const debuggerHost = Constants.expoConfig?.hostUri;
    if (debuggerHost) {
      const localhost = debuggerHost.split(':')[0];
      return `http://${localhost}:5000`;
    }
    
    // Fallbacks
    if (Platform.OS === 'android') {
      return 'http://10.0.2.2:5000';
    }
    return 'http://localhost:5000';
  }
  // Production URL
  return 'https://api.yourdomain.com';
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
