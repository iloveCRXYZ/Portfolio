import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Screen, T, Gap, Button, Card, Chip, RowV, Avatar, Icon, useToast, TYPE_ICON } from '@/components/ui';
import { Field } from '@/components/form';
import { api, errMsg } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { AVATAR_COLORS, pickAndUploadAvatar, setAvatarColor } from '@/lib/avatar';
import { useColors } from '@/lib/theme';
import type { Me } from '@/lib/types';

const MODES = [
  ['ranked', 'Ranked', '15 mixed rounds, 20-minute clock, win or lose ELO.'],
  ['marathon', 'Marathon', 'Keeps going until you get 3 wrong in a row.'],
  ['mail', 'Phishing Emails', 'Real inbox or fake? Check senders and links.'],
  ['call', 'Scam Calls', 'Read the live transcript and decide.'],
  ['sms', 'Scam Messages', 'Texts from couriers, banks and strangers.'],
] as const;

export default function Onboarding() {
  const { me, setMe } = useAuth();
  const c = useColors();
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [name, setName] = useState(me?.username ?? '');
  const [check, setCheck] = useState<{ available: boolean; reason: string | null } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (step !== 3 || !name.trim()) return setCheck(null);
    const t = setTimeout(() => {
      api<{ available: boolean; reason: string | null }>(`/auth/username-available?username=${encodeURIComponent(name.trim())}`, { auth: false })
        .then((r) => setCheck(name.trim().toLowerCase() === me?.username.toLowerCase() ? { available: true, reason: null } : r))
        .catch(() => setCheck(null));
    }, 350);
    return () => clearTimeout(t);
  }, [name, step, me?.username]);

  const photo = async () => {
    try {
      const m = await pickAndUploadAvatar();
      if (m) setMe(m);
    } catch (e) {
      toast(e instanceof Error && !('status' in e) ? e.message : errMsg(e), 'error-outline');
    }
  };
  const color = async (col: string) => {
    try {
      setMe(await setAvatarColor(col));
    } catch (e) {
      toast(errMsg(e), 'error-outline');
    }
  };
  const finish = async () => {
    setBusy(true);
    try {
      setMe(await api<Me>('/auth/username', { body: { username: name.trim() } }));
    } catch (e) {
      toast(errMsg(e), 'error-outline');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <RowV gap={6}>
        {[1, 2, 3].map((i) => (
          <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= step ? c.ink : c.line }} />
        ))}
      </RowV>
      <Gap h={28} />
      {step === 1 ? (
        <>
          <T v="h1">How a round works</T>
          <T c="text2" style={{ marginTop: 6 }}>
            You get an email, a text or a call. Decide if it's real, then say what gave it away.
          </T>
          <Gap h={20} />
          <Card style={{ gap: 12 }}>
            <RowV>
              <Icon name="mail-outline" color={c.text2} />
              <View style={{ flex: 1 }}>
                <T style={{ fontWeight: '600' }}>PayPaI Security</T>
                <T v="small" c="text2">
                  Your account has been limited
                </T>
              </View>
            </RowV>
            <RowV>
              <Chip label="Legit" icon="verified" />
              <Chip label="Scam" icon="gpp-maybe" tone="scam" />
            </RowV>
            <RowV wrap>
              <Chip label="Spoofed sender" />
              <Chip label="Suspicious link" tone="accent" />
            </RowV>
            <T v="small" c="text2">
              Right call +60 · Right reason +40 · 10 rounds = 1,000 points
            </T>
          </Card>
        </>
      ) : step === 2 ? (
        <>
          <T v="h1">Pick how you play</T>
          <T c="text2" style={{ marginTop: 6 }}>
            Practice one type, go endless, or climb the ranked ladder.
          </T>
          <Gap h={16} />
          {MODES.map(([k, t, d]) => (
            <RowV key={k} gap={14} style={{ paddingVertical: 12 }}>
              <View style={{ width: 44, height: 44, borderRadius: 11, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={TYPE_ICON[k]} />
              </View>
              <View style={{ flex: 1 }}>
                <T style={{ fontWeight: '600' }}>{t}</T>
                <T v="small" c="text2">
                  {d}
                </T>
              </View>
            </RowV>
          ))}
        </>
      ) : (
        <>
          <T v="h1">Set up your profile</T>
          <T c="text2" style={{ marginTop: 6 }}>
            Pick your username now. Your photo is the only thing you can change later.
          </T>
          <Gap h={20} />
          <RowV gap={16}>
            <Pressable onPress={photo} accessibilityLabel="Upload a profile photo">
              <Avatar user={me} size={80} />
            </Pressable>
            <View style={{ gap: 8 }}>
              <Button title="Upload photo" icon="photo-camera" kind="outline" size="sm" onPress={photo} />
              <T v="small" c="text3">
                Or pick a color
              </T>
            </View>
          </RowV>
          <RowV gap={10} style={{ marginVertical: 16 }}>
            {AVATAR_COLORS.map((col) => (
              <Pressable key={col} accessibilityLabel={`Use color ${col}`} onPress={() => color(col)} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: col, borderWidth: 3, borderColor: me?.avatarColor === col ? c.ink : 'transparent' }} />
            ))}
          </RowV>
          <Field label="Username" value={name} onChangeText={setName} autoCapitalize="none" autoCorrect={false} maxLength={20} error={check && !check.available ? check.reason : null} hint={check?.available ? 'Available' : 'Letters, numbers, dots and underscores'} hintTone={check?.available ? 'ok' : 'muted'} />
        </>
      )}
      <Gap h={28} />
      <RowV gap={10}>
        {step > 1 ? <Button title="Back" kind="outline" size="lg" onPress={() => setStep(step - 1)} /> : <Button title="Skip" kind="ghost" size="lg" onPress={() => setStep(3)} />}
        <Button
          title={step < 3 ? 'Next' : 'Start playing'}
          size="lg"
          style={{ flex: 1 }}
          loading={busy}
          disabled={step === 3 && !check?.available}
          onPress={() => (step < 3 ? setStep(step + 1) : finish())}
        />
      </RowV>
    </Screen>
  );
}
