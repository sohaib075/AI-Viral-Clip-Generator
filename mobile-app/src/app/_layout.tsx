import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AnimatedSplashOverlay } from '@/components/animated-icon';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync().catch(() => {});

// The app is designed dark-only (app.json sets userInterfaceStyle: "dark")
const theme = { ...DarkTheme, colors: { ...DarkTheme.colors, background: '#0a0a0a', card: '#0a0a0a' } };

export default function RootLayout() {
  useEffect(() => {
    // Hide the native splash screen immediately,
    // handing over the visual to our custom AnimatedSplashOverlay
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <ThemeProvider value={theme}>
      <StatusBar style="light" />
      <AnimatedSplashOverlay />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0a0a0a' } }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="processing/[jobId]" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="results" options={{ headerShown: false }} />
        <Stack.Screen name="story-to-video" options={{ headerShown: false }} />
        <Stack.Screen name="accounts" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="how-it-works" options={{ headerShown: false, presentation: 'modal' }} />
      </Stack>
    </ThemeProvider>
  );
}
