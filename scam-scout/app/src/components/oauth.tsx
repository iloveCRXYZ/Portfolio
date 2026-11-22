import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { api, errMsg } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button, useToast } from './ui';

WebBrowser.maybeCompleteAuthSession();

/**
 * Google and Apple buttons. Google needs client IDs in app/.env:
 * EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID, EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID, EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.
 * Apple works on iOS devices with "Sign in with Apple" enabled for the bundle ID.
 */
export function OAuthButtons({ verb = 'Continue' }: { verb?: 'Continue' | 'Log in' }) {
  const { setSession } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState<null | 'google' | 'apple'>(null);
  const [appleOk, setAppleOk] = useState(false);
  const googleConfigured = !!(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID);
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || 'not-configured',
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || 'not-configured',
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || 'not-configured',
  });

  useEffect(() => {
    if (Platform.OS === 'ios') AppleAuthentication.isAvailableAsync().then(setAppleOk).catch(() => setAppleOk(false));
  }, []);

  useEffect(() => {
    if (response?.type !== 'success') {
      if (response) setBusy(null);
      return;
    }
    const idToken = response.params.id_token;
    if (!idToken) return;
    api('/auth/google', { body: { idToken }, auth: false })
      .then(setSession)
      .catch((e) => toast(errMsg(e), 'error-outline'))
      .finally(() => setBusy(null));
  }, [response, setSession, toast]);

  const google = async () => {
    if (!googleConfigured) return toast('Google sign-in is not set up yet. Use email for now.', 'info-outline');
    setBusy('google');
    await promptAsync();
  };

  const apple = async () => {
    if (!appleOk) return toast('Sign in with Apple works on iPhone and iPad.', 'info-outline');
    setBusy('apple');
    try {
      const cred = await AppleAuthentication.signInAsync({ requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL] });
      if (!cred.identityToken) throw new Error('No token');
      await setSession(await api('/auth/apple', { body: { idToken: cred.identityToken }, auth: false }));
    } catch (e: any) {
      if (e?.code !== 'ERR_REQUEST_CANCELED') toast(errMsg(e), 'error-outline');
    } finally {
      setBusy(null);
    }
  };

  const appleBtn = <Button key="a" title={`${verb} with Apple`} icon="phone-iphone" kind={Platform.OS === 'ios' ? 'ink' : 'outline'} size="lg" full loading={busy === 'apple'} onPress={apple} />;
  const googleBtn = <Button key="g" title={`${verb} with Google`} icon="mail-outline" kind={Platform.OS === 'ios' ? 'outline' : 'ink'} size="lg" full loading={busy === 'google'} disabled={googleConfigured && !request} onPress={google} />;
  // iOS shows Apple first, Android shows Google first.
  return <>{Platform.OS === 'ios' ? [appleBtn, googleBtn] : [googleBtn, appleBtn]}</>;
}
