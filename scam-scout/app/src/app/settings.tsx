import { useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Screen, T, Gap, Button, Avatar, Icon, RowV, Segmented, Sheet, Switch, Chip, useToast } from '@/components/ui';
import { Field } from '@/components/form';
import { api, API_URL, errMsg } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useColors } from '@/lib/theme';
import type { Me, Prefs } from '@/lib/types';

function Group({ title, children }: { title: string; children: ReactNode }) {
  const c = useColors();
  return (
    <View style={{ marginBottom: 24 }}>
      <T v="label" c="text3" style={{ marginBottom: 8 }}>
        {title}
      </T>
      <View style={{ backgroundColor: c.surface, borderRadius: 14, paddingHorizontal: 16 }}>{children}</View>
    </View>
  );
}
function Row({ title, sub, right, last, onPress }: { title: string; sub?: string; right?: ReactNode; last?: boolean; onPress?: () => void }) {
  const c = useColors();
  return (
    <Pressable disabled={!onPress} onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 10, borderBottomWidth: last ? 0 : 1, borderBottomColor: c.line }}>
      <View style={{ flex: 1 }}>
        <T style={{ fontWeight: '500' }}>{title}</T>
        {sub ? (
          <T v="small" c="text3">
            {sub}
          </T>
        ) : null}
      </View>
      {right ?? (onPress ? <Icon name="chevron-right" color={c.text3} /> : null)}
    </Pressable>
  );
}

export default function Settings() {
  const c = useColors();
  const toast = useToast();
  const { me, setMe, signOut } = useAuth();
  const [sheet, setSheet] = useState<null | 'logout' | 'delete'>(null);
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  if (!me) return null;
  const p = me.prefs;

  const setPref = async <K extends keyof Prefs>(k: K, v: Prefs[K]) => {
    setMe({ ...me, prefs: { ...p, [k]: v } });
    try {
      setMe(await api<Me>('/me/prefs', { method: 'PATCH', body: { [k]: v } }));
    } catch (e) {
      setMe(me);
      toast(errMsg(e), 'error-outline');
    }
  };
  const resend = async () => {
    try {
      const r = await api<{ alreadyVerified?: boolean; devToken?: string }>('/auth/resend-verification', { method: 'POST' });
      if (r.alreadyVerified) toast('Your email is already confirmed', 'check-circle');
      else if (r.devToken) router.push({ pathname: '/verify-email', params: { token: r.devToken } });
      else toast('Confirmation email sent', 'mark-email-unread');
    } catch (e) {
      toast(errMsg(e), 'error-outline');
    }
  };
  const del = async () => {
    setBusy(true);
    try {
      await api('/me', { method: 'DELETE', body: { confirm } });
      setSheet(null);
      await signOut();
      toast('Account deleted', 'delete');
    } catch (e) {
      toast(errMsg(e), 'error-outline');
    } finally {
      setBusy(false);
    }
  };
  const sw = (k: keyof Prefs, title: string, sub?: string, last?: boolean) => <Row title={title} sub={sub} last={last} right={<Switch value={!!p[k]} label={title} onChange={(v) => setPref(k, v as never)} />} />;

  return (
    <Screen>
      <Button title="Back" icon="arrow-back" kind="ghost" size="sm" style={{ alignSelf: 'flex-start', marginLeft: -10 }} onPress={() => router.back()} />
      <T v="h1" style={{ marginTop: 8, marginBottom: 20 }}>
        Settings
      </T>

      <Group title="Account">
        <Row title="Profile photo" sub="The only part of your profile you can edit" right={<Avatar user={me} size={36} />} onPress={() => router.push('/profile')} />
        <Row title="Username" sub={me.username} right={<Icon name="lock" size={18} color={c.text3} />} />
        <Row title="Email" sub={me.email ?? 'Not set'} right={me.emailVerified ? <Chip label="Confirmed" tone="legit" /> : <Button title="Confirm" size="sm" onPress={resend} />} />
        <Row title="Google" sub="Gmail sign-in" right={me.linked.google ? <Chip label="Connected" tone="legit" /> : <Chip label="Not connected" />} />
        <Row title="Apple" sub="iPhone sign-in" last right={me.linked.apple ? <Chip label="Connected" tone="legit" /> : <Chip label="Not connected" />} />
      </Group>

      <Group title="Appearance">
        <View style={{ paddingVertical: 12 }}>
          <T style={{ fontWeight: '500', marginBottom: 8 }}>Theme</T>
          <Segmented options={[{ key: 'system', label: 'System' }, { key: 'light', label: 'Light' }, { key: 'dark', label: 'Dark' }]} value={p.theme} onChange={(v) => setPref('theme', v)} />
        </View>
      </Group>

      <Group title="Gameplay">
        {sw('timer', 'Show round timer')}
        {sw('hints', 'Hint highlights', 'Practice modes only. Never in Ranked.')}
        {sw('reduceMotion', 'Reduce motion', undefined, true)}
      </Group>

      <Group title="Sound">
        {sw('sound', 'Sound effects')}
        <Row title="Music volume" sub={`${p.music}%`} right={<RowV gap={4}><Button title="−" kind="outline" size="sm" onPress={() => setPref('music', Math.max(0, p.music - 10))} /><Button title="+" kind="outline" size="sm" onPress={() => setPref('music', Math.min(100, p.music + 10))} /></RowV>} />
        <Row title="Effects volume" sub={`${p.sfx}%`} last right={<RowV gap={4}><Button title="−" kind="outline" size="sm" onPress={() => setPref('sfx', Math.max(0, p.sfx - 10))} /><Button title="+" kind="outline" size="sm" onPress={() => setPref('sfx', Math.min(100, p.sfx + 10))} /></RowV>} />
      </Group>

      <Group title="Notifications">
        {sw('notifyFriends', 'Friend requests and duels')}
        {sw('notifyDaily', 'Daily challenge reminder')}
        {sw('notifyRanked', 'Season and rank updates', undefined, true)}
      </Group>

      <Group title="Privacy">{sw('online', "Show when I'm online", 'Friends see you in their Online list', true)}</Group>

      <Group title="Help">
        <Row title="Guide Book" onPress={() => router.push('/guide')} />
        <Row title="Server" sub={API_URL} last />
      </Group>

      <RowV gap={10}>
        <Button title="Log out" icon="logout" kind="danger" onPress={() => setSheet('logout')} />
        <Button title="Delete account" kind="ghost" onPress={() => setSheet('delete')} />
      </RowV>

      <Sheet visible={sheet === 'logout'} onClose={() => setSheet(null)} title="Log out?" subtitle="Your progress is saved to your account.">
        <RowV gap={10} style={{ justifyContent: 'flex-end' }}>
          <Button title="Cancel" kind="outline" onPress={() => setSheet(null)} />
          <Button title="Log out" onPress={() => (setSheet(null), signOut())} />
        </RowV>
        <Gap h={8} />
      </Sheet>
      <Sheet visible={sheet === 'delete'} onClose={() => setSheet(null)} title="Delete your account?" subtitle="This removes your profile, ELO, badges and friends for good. Type DELETE to confirm.">
        <Field label="Confirmation" value={confirm} onChangeText={setConfirm} autoCapitalize="characters" placeholder="DELETE" />
        <Gap h={16} />
        <RowV gap={10} style={{ justifyContent: 'flex-end' }}>
          <Button title="Cancel" kind="outline" onPress={() => setSheet(null)} />
          <Button title="Delete account" kind="dangerFill" disabled={confirm.trim() !== 'DELETE'} loading={busy} onPress={del} />
        </RowV>
        <Gap h={8} />
      </Sheet>
    </Screen>
  );
}
