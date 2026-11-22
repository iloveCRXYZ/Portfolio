import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Screen, T, Gap, Button } from '@/components/ui';
import { Field, isEmail } from '@/components/form';
import { OAuthButtons } from '@/components/oauth';
import { api, errMsg } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function Login() {
  const { setSession } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errs, setErrs] = useState<{ email?: string; password?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const e: typeof errs = {};
    if (!isEmail(email)) e.email = 'Enter a valid email address, like you@example.com.';
    if (!password) e.password = 'Enter your password.';
    setErrs(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await setSession(await api('/auth/login', { body: { email: email.trim(), password }, auth: false }));
    } catch (err) {
      setErrs({ form: errMsg(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <Button title="Back" icon="arrow-back" kind="ghost" size="sm" style={{ alignSelf: 'flex-start', marginLeft: -10 }} onPress={() => router.back()} />
      <Gap h={12} />
      <T v="h1">Welcome back</T>
      <T c="text2" style={{ marginTop: 6 }}>
        Log in to keep your streak going.
      </T>
      <Gap h={24} />
      <View style={{ gap: 12 }}>
        <OAuthButtons verb="Log in" />
      </View>
      <Gap h={20} />
      <View style={{ gap: 16 }}>
        <Field label="Email" value={email} onChangeText={setEmail} error={errs.email} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" placeholder="you@example.com" />
        <Field label="Password" value={password} onChangeText={setPassword} error={errs.password} secureTextEntry autoComplete="current-password" textContentType="password" placeholder="Your password" onSubmitEditing={submit} />
        <Button title="Forgot password?" kind="ghost" size="sm" style={{ alignSelf: 'flex-end' }} onPress={() => router.push('/forgot')} />
        {errs.form ? <T c="scam">{errs.form}</T> : null}
        <Button title={busy ? 'Logging in…' : 'Log in'} size="lg" full loading={busy} onPress={submit} />
      </View>
    </Screen>
  );
}
