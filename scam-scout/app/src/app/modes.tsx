import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen, T, Gap, Button, Icon, IconButton, RowV, Chip, useToast, TYPE_ICON } from '@/components/ui';
import { api, errMsg } from '@/lib/api';
import { useColors } from '@/lib/theme';
import type { Game } from '@/lib/types';

const MODES = [
  { id: 'ranked', name: 'Ranked', desc: '15 mixed emails, texts and calls. 20-minute clock. Guide locked.', meta: '15 rounds · ELO' },
  { id: 'marathon', name: 'Marathon', desc: 'Keeps going until you get 3 wrong in a row.', meta: 'Endless' },
  { id: 'mail', name: 'Phishing Emails', desc: 'Real inbox or fake? Check the sender and every link.', meta: '10 rounds' },
  { id: 'call', name: 'Scam Calls', desc: 'Read the live transcript. Decide before you hang up.', meta: '10 rounds' },
  { id: 'sms', name: 'Scam Messages', desc: 'Texts from couriers, banks and strangers.', meta: '10 rounds' },
] as const;

export default function Modes() {
  const c = useColors();
  const toast = useToast();
  const { start } = useLocalSearchParams<{ start?: string }>();
  const [mode, setMode] = useState<string>('ranked');
  const [busy, setBusy] = useState(false);

  const play = async (m: string) => {
    if (m === 'ranked') return router.replace('/matchmaking');
    setBusy(true);
    try {
      const g = await api<Game>('/games', { body: { mode: m } });
      router.replace(`/game/${g.id}`);
    } catch (e) {
      toast(errMsg(e), 'error-outline');
      setBusy(false);
    }
  };

  // Home's daily challenge card jumps straight in.
  useEffect(() => {
    if (start === 'daily') void play('daily');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start]);

  return (
    <Screen edges={['top', 'bottom']}>
      <RowV style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <T v="h1">Choose a mode</T>
          <T c="text2" style={{ marginTop: 4 }}>
            Ranked is 15 mixed rounds with a 20-minute clock. Every other mode is 10, except Marathon.
          </T>
        </View>
        <IconButton name="close" label="Close" onPress={() => router.back()} />
      </RowV>
      <Gap h={18} />
      <View accessibilityRole="radiogroup" style={{ gap: 8 }}>
        {MODES.map((m) => {
          const on = mode === m.id;
          return (
            <Pressable key={m.id} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => setMode(m.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 14, borderWidth: on ? 1.5 : 1, borderColor: on ? c.ink : c.line }}>
              <View style={{ width: 44, height: 44, borderRadius: 11, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={TYPE_ICON[m.id]} />
              </View>
              <View style={{ flex: 1 }}>
                <RowV gap={6}>
                  <T style={{ fontWeight: '600' }}>{m.name}</T>
                  {m.id === 'ranked' ? <Chip label="ELO" tone="accent" /> : null}
                </RowV>
                <T v="small" c="text2">
                  {m.desc}
                </T>
              </View>
              <Icon name={on ? 'radio-button-checked' : 'radio-button-unchecked'} color={on ? c.text : c.text3} />
            </Pressable>
          );
        })}
      </View>
      <Gap h={20} />
      <Button title={`Play ${MODES.find((m) => m.id === mode)?.name}`} icon="arrow-forward" size="lg" full loading={busy} onPress={() => play(mode)} />
    </Screen>
  );
}
