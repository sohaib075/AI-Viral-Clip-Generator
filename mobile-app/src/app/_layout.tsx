import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useColorScheme } from 'react-native';
import { Stack } from 'expo-router';
import { AnimatedSplashOverlay } from '@/components/animated-icon';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="processing/[jobId]" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="results" options={{ headerShown: false }} />
        <Stack.Screen name="accounts" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="how-it-works" options={{ headerShown: false, presentation: 'modal' }} />
      </Stack>
    </ThemeProvider>
  );
}
