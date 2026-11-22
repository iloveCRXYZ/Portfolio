import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen, Gap, Button, EmptyState, Skeleton } from '@/components/ui';
import { api, errMsg } from '@/lib/api';
import { useAuth } from '@/lib/auth';

/** Opened from the confirmation email: scamscout://verify-email?token=… */
export default function VerifyEmail() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const { refresh, me } = useAuth();
  const [state, setState] = useState<'working' | 'ok' | 'error'>('working');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!token) {
      setState('error');
      setMsg('This link is missing its code.');
      return;
    }
    api('/auth/verify-email', { body: { token }, auth: false })
      .then(async () => {
        setState('ok');
        await refresh();
      })
      .catch((e) => {
        setState('error');
        setMsg(errMsg(e));
      });
  }, [token, refresh]);

  return (
    <Screen>
      <Gap h={60} />
      {state === 'working' ? (
        <Skeleton rows={0} />
      ) : state === 'ok' ? (
        <EmptyState icon="mark-email-read" title="Email confirmed" body="Thanks. Your account is all set." actions={<Button title={me ? 'Continue' : 'Log in'} onPress={() => router.replace(me ? '/' : '/login')} />} />
      ) : (
        <EmptyState icon="link-off" title="That link didn't work" body={msg} actions={<Button title="Go back" onPress={() => router.replace('/')} />} />
      )}
    </Screen>
  );
}
