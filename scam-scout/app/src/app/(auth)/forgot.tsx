import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Screen, T, Gap, Button, EmptyState } from '@/components/ui';
import { Field, isEmail } from '@/components/form';
import { api, errMsg } from '@/lib/api';

export default function Forgot() {
  const [email, setEmail] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<{ email: string; devToken?: string } | null>(null);

  const submit = async () => {
    if (!isEmail(email)) return setErr('Enter a valid email address, like you@example.com.');
    setErr(null);
    setBusy(true);
    try {
      const r = await api<{ devToken?: string }>('/auth/forgot-password', { body: { email: email.trim() }, auth: false });
      setSent({ email: email.trim(), devToken: r.devToken });
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  if (sent)
    return (
      <Screen edges={['top', 'bottom']}>
        <Gap h={60} />
        <EmptyState
          icon="mark-email-read"
          title="Check your email"
          body={`If ${sent.email} has an account, we sent a reset link. It expires in 1 hour.`}
          actions={
            <>
              <Button title="Back to log in" onPress={() => router.replace('/login')} />
              {sent.devToken ? <Button title="Open reset link (dev)" kind="outline" onPress={() => router.push({ pathname: '/reset-password', params: { token: sent.devToken } })} /> : null}
            </>
          }
        />
      </Screen>
    );

  return (
    <Screen edges={['top', 'bottom']}>
      <Button title="Back" icon="arrow-back" kind="ghost" size="sm" style={{ alignSelf: 'flex-start', marginLeft: -10 }} onPress={() => router.back()} />
      <Gap h={12} />
      <T v="h1">Reset your password</T>
      <T c="text2" style={{ marginTop: 6 }}>
        Enter the email you signed up with and we'll send you a link.
      </T>
      <Gap h={24} />
      <View style={{ gap: 16 }}>
        <Field label="Email" value={email} onChangeText={setEmail} error={err} keyboardType="email-address" autoCapitalize="none" placeholder="you@example.com" onSubmitEditing={submit} />
        <Button title="Send reset link" size="lg" full loading={busy} onPress={submit} />
      </View>
    </Screen>
  );
}
