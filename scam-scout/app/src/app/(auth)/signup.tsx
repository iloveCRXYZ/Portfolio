import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Screen, T, Gap, Button } from '@/components/ui';
import { Field, isEmail } from '@/components/form';
import { api, ApiError, errMsg } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function SignUp() {
  const { setSession } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errs, setErrs] = useState<{ email?: string; password?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const e: typeof errs = {};
    if (!isEmail(email)) e.email = 'Enter a valid email address, like you@example.com.';
    if (password.length < 8) e.password = 'Use at least 8 characters.';
    setErrs(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      // Onboarding (username + photo) opens automatically once the session is stored.
      await setSession(await api('/auth/signup', { body: { email: email.trim(), password }, auth: false }));
    } catch (err) {
      if (err instanceof ApiError && err.code === 'email_taken') setErrs({ email: err.message });
      else setErrs({ form: errMsg(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <Button title="Back" icon="arrow-back" kind="ghost" size="sm" style={{ alignSelf: 'flex-start', marginLeft: -10 }} onPress={() => router.back()} />
      <Gap h={12} />
      <T v="h1">Sign up with email</T>
      <T c="text2" style={{ marginTop: 6 }}>
        We'll send a link to confirm your address.
      </T>
      <Gap h={24} />
      <View style={{ gap: 16 }}>
        <Field label="Email" value={email} onChangeText={setEmail} error={errs.email} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" placeholder="you@example.com" />
        <Field label="Password" value={password} onChangeText={setPassword} error={errs.password} secureTextEntry autoComplete="new-password" textContentType="newPassword" placeholder="At least 8 characters" onSubmitEditing={submit} />
        {errs.form ? <T c="scam">{errs.form}</T> : null}
        <Button title={busy ? 'Creating account…' : 'Create account'} size="lg" full loading={busy} onPress={submit} />
        <Button title="I already have an account" kind="ghost" onPress={() => router.replace('/login')} />
      </View>
    </Screen>
  );
}
