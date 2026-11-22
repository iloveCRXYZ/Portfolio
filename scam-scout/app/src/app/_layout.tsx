import { useEffect } from 'react';
import { Stack, ThemeProvider, DarkTheme, DefaultTheme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider, useAuth } from '@/lib/auth';
import { useColors, useScheme } from '@/lib/theme';
import { ToastProvider } from '@/components/ui';

void SplashScreen.preventAutoHideAsync();

function Root() {
  const { ready, me } = useAuth();
  const scheme = useScheme();
  const c = useColors();

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);
  if (!ready) return null;

  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const theme = { ...base, colors: { ...base.colors, background: c.bg, card: c.bg, text: c.text, border: c.line, primary: c.accent } };
  const signedIn = !!me;
  const onboarded = !!me?.usernameLocked;

  return (
    <ThemeProvider value={theme}>
      <ToastProvider>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
          <Stack.Protected guard={!signedIn}>
            <Stack.Screen name="(auth)" />
          </Stack.Protected>
          <Stack.Protected guard={signedIn && !onboarded}>
            <Stack.Screen name="onboarding" />
          </Stack.Protected>
          <Stack.Protected guard={signedIn && onboarded}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="modes" options={{ presentation: 'modal' }} />
            <Stack.Screen name="matchmaking" options={{ gestureEnabled: false }} />
            <Stack.Screen name="game/[id]" options={{ gestureEnabled: false }} />
            <Stack.Screen name="results/[id]" options={{ gestureEnabled: false }} />
            <Stack.Screen name="add-friend" />
            <Stack.Screen name="challenge/[userId]" options={{ presentation: 'modal' }} />
            <Stack.Screen name="notifications" />
            <Stack.Screen name="settings" />
            <Stack.Screen name="elo" />
          </Stack.Protected>
          <Stack.Screen name="verify-email" />
          <Stack.Screen name="reset-password" />
          <Stack.Screen name="+not-found" />
        </Stack>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default function Layout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <Root />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
