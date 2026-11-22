import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen, T, Gap, Button, EmptyState } from '@/components/ui';
import { Field } from '@/components/form';
import { api, errMsg } from '@/lib/api';
import { useAuth } from '@/lib/auth';

/** Opened from the email link: scamscout://reset-password?token=… */
export default function ResetPassword() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const { setSession } = useAuth();
  const [pw, setPw] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!token)
    return (
      <Screen>
        <EmptyState icon="link-off" title="This link is missing its code" body="Open the reset link from your email again, or request a new one." actions={<Button title="Request a new link" onPress={() => router.replace('/forgot')} />} />
      </Screen>
    );

  const submit = async () => {
    if (pw.length < 8) return setErr('Use at least 8 characters.');
    setBusy(true);
    try {
      await setSession(await api('/auth/reset-password', { body: { token, password: pw }, auth: false }));
      router.replace('/');
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <Gap h={24} />
      <T v="h1">Choose a new password</T>
      <Gap h={24} />
      <View style={{ gap: 16 }}>
        <Field label="New password" value={pw} onChangeText={setPw} error={err} secureTextEntry autoComplete="new-password" placeholder="At least 8 characters" onSubmitEditing={submit} />
        <Button title="Save and log in" size="lg" full loading={busy} onPress={submit} />
      </View>
    </Screen>
  );
}
