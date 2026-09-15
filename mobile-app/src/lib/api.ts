import axios, { isAxiosError } from 'axios';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { getSecret, setSecret } from './storage';

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

// ---------------------------------------------------------------------------
// Access token (when the backend sets API_TOKEN). Kept in secure storage and cached in memory.
// ---------------------------------------------------------------------------
const TOKEN_KEY = 'clipgenius.apiToken';
let apiToken: string | null = process.env.EXPO_PUBLIC_API_TOKEN || null;
let tokenLoaded: Promise<void> | null = null;

const ensureTokenLoaded = () => {
  tokenLoaded ??= getSecret(TOKEN_KEY)
    .then((stored) => { if (stored) apiToken = stored; })
    .catch(() => {});
  return tokenLoaded;
};

export const getApiToken = async () => {
  await ensureTokenLoaded();
  return apiToken;
};

export const saveApiToken = async (token: string | null) => {
  await ensureTokenLoaded();
  apiToken = token || process.env.EXPO_PUBLIC_API_TOKEN || null;
  await setSecret(TOKEN_KEY, token || null);
};

export const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
});

api.interceptors.request.use(async (config) => {
  const token = await getApiToken();
  if (token) config.headers.set('Authorization', `Bearer ${token}`);
  return config;
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

// Multipart uploads use fetch: React Native's fetch reliably streams { uri, name, type } file parts
export async function postForm<T>(path: string, form: FormData): Promise<T> {
  const token = await getApiToken();
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      body: form,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
  } catch {
    throw new Error(`Could not reach the server at ${API_URL}.`);
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error || (response.status === 401 ? 'This server needs an access token. Add it in Settings.' : `Upload failed (${response.status})`));
  }
  return data as T;
}

// Rendered media is served by the backend under /temp/...
export const mediaUrl = (path?: string | null) => {
  if (!path) return null;
  return /^https?:\/\//.test(path) ? path : `${API_URL}${path}`;
};

export const errorStatus = (error: unknown) => (isAxiosError(error) ? error.response?.status : undefined);

// A message fit to show the user, preferring the server's explanation
export const errorMessage = (error: unknown, fallback = 'Something went wrong.') => {
  if (isAxiosError(error)) {
    const serverMessage = (error.response?.data as { error?: string } | undefined)?.error;
    if (serverMessage) return serverMessage;
    if (error.response?.status === 401) return 'This server needs an access token. Add it in Settings.';
    if (!error.response) return `Could not reach the server at ${API_URL}.`;
  }
  return error instanceof Error && error.message ? error.message : fallback;
};

export default api;
