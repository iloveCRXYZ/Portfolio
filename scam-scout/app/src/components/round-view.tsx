import { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { useColors } from '@/lib/theme';
import type { Round } from '@/lib/types';
import { Avatar, Icon, RowV, T, Gap, useToast } from './ui';

/** Renders one round the way the phone's own app would: Mail, Messages or a call screen. */
export function RoundView({ round }: { round: Round }) {
  if (round.type === 'mail') return <MailView r={round} />;
  if (round.type === 'sms') return <SmsView r={round} />;
  return <CallView r={round} />;
}

function LinkPeek({ url }: { url: string }) {
  const c = useColors();
  return (
    <RowV gap={10} style={{ marginTop: 10, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: c.line, backgroundColor: c.raised }}>
      <Icon name="link" color={c.text2} />
      <View style={{ flex: 1 }}>
        <T v="small" c="text3" style={{ fontSize: 11 }}>
          {Platform.OS === 'ios' ? 'Long-press preview' : 'Link address'}
        </T>
        <T style={{ fontWeight: '500' }} selectable>
          {url}
        </T>
      </View>
    </RowV>
  );
}

function MailView({ r }: { r: Round }) {
  const c = useColors();
  const [peek, setPeek] = useState(false);
  return (
    <View>
      <RowV style={{ justifyContent: 'space-between', marginBottom: 14 }}>
        <RowV gap={2}>
          <Icon name="chevron-left" size={26} color={Platform.OS === 'ios' ? c.accent : c.text} />
          <T c={Platform.OS === 'ios' ? 'accent' : 'text'}>Inbox</T>
        </RowV>
        <RowV gap={18}>
          <Icon name="archive" color={c.text2} />
          <Icon name="delete-outline" color={c.text2} />
        </RowV>
      </RowV>
      <T v="h2" style={{ marginBottom: 14 }}>
        {r.subject}
      </T>
      <RowV gap={12}>
        <Avatar name={r.from} size={40} color="#6B5BD6" />
        <View style={{ flex: 1 }}>
          <T style={{ fontWeight: '600' }}>{r.from}</T>
          <T v="small" c="text2" selectable>
            {r.addr} · to me
          </T>
        </View>
        <T v="small" c="text3">
          {r.time}
        </T>
      </RowV>
      <View style={{ height: 1, backgroundColor: c.line, marginVertical: 16 }} />
      <T style={{ lineHeight: 24 }}>{r.body}</T>
      {r.linkLabel ? (
        <>
          <Gap h={18} />
          <Pressable accessibilityRole="link" onPress={() => setPeek((p) => !p)} onLongPress={() => setPeek(true)} style={{ alignSelf: 'flex-start', backgroundColor: '#0B63C4', borderRadius: Platform.OS === 'ios' ? 10 : 22, paddingHorizontal: 20, height: 44, justifyContent: 'center' }}>
            <T style={{ color: '#fff', fontWeight: '600' }}>{r.linkLabel}</T>
          </Pressable>
          <T v="small" c="text3" style={{ marginTop: 6 }}>
            Tap or long-press the button to see where it goes.
          </T>
          {peek && r.url ? <LinkPeek url={r.url} /> : null}
        </>
      ) : null}
    </View>
  );
}

function SmsView({ r }: { r: Round }) {
  const c = useColors();
  const [peek, setPeek] = useState(false);
  const ios = Platform.OS === 'ios';
  return (
    <View>
      <View style={{ alignItems: ios ? 'center' : 'flex-start', paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: c.line, gap: 4 }}>
        {ios ? (
          <>
            <Avatar name={r.from} size={44} />
            <T v="small" style={{ fontWeight: '500' }}>
              {r.from} ›
            </T>
          </>
        ) : (
          <RowV gap={12}>
            <Icon name="arrow-back" />
            <Avatar name={r.from} size={36} color="#3A7BD5" />
            <T v="h3">{r.from}</T>
          </RowV>
        )}
      </View>
      <T v="small" c="text3" center style={{ marginVertical: 14 }}>
        Text Message · Today {r.time}
      </T>
      <View style={{ alignSelf: 'flex-start', maxWidth: '84%', backgroundColor: ios ? c.bubble : c.surface, borderRadius: 18, borderBottomLeftRadius: 5, paddingHorizontal: 14, paddingVertical: 10 }}>
        <T style={{ lineHeight: 22 }}>{r.body}</T>
        {r.url ? (
          <Pressable accessibilityRole="link" onPress={() => setPeek((p) => !p)} onLongPress={() => setPeek(true)}>
            <T c="accent" style={{ textDecorationLine: 'underline', marginTop: 2 }}>
              {r.url}
            </T>
          </Pressable>
        ) : null}
      </View>
      {peek && r.url ? <LinkPeek url={r.url} /> : null}
    </View>
  );
}

function CallView({ r }: { r: Round }) {
  const c = useColors();
  const toast = useToast();
  return (
    <View>
      <View style={{ alignItems: 'center', gap: 2 }}>
        <T v="small" c="text2">
          Incoming call
        </T>
        <T style={{ fontSize: 28, fontWeight: '400', letterSpacing: -0.4 }} center>
          {r.from}
        </T>
        <T c="text2">{r.number} · 00:47</T>
      </View>
      <View style={{ backgroundColor: c.surface, borderRadius: 18, padding: 14, marginTop: 18, gap: 10 }}>
        <RowV style={{ justifyContent: 'space-between' }}>
          <RowV gap={6}>
            <Icon name="closed-caption" size={18} />
            <T v="small" style={{ fontWeight: '600' }}>
              Live transcript
            </T>
          </RowV>
          <Icon name="graphic-eq" color={c.accent} />
        </RowV>
        {r.lines?.map((l, i) => {
          const me = l.who === 'you';
          return (
            <View key={i} style={{ alignSelf: me ? 'flex-end' : 'flex-start', maxWidth: '86%', gap: 3 }}>
              <T v="small" c="text2" style={{ fontSize: 11, fontWeight: '600', textAlign: me ? 'right' : 'left' }}>
                {me ? 'You' : 'Caller'}
              </T>
              <View style={{ backgroundColor: me ? c.accent : c.raised, borderRadius: 14, borderBottomRightRadius: me ? 4 : 14, borderBottomLeftRadius: me ? 14 : 4, paddingHorizontal: 12, paddingVertical: 8 }}>
                <T c={me ? 'onInk' : 'text'}>{l.text}</T>
              </View>
            </View>
          );
        })}
      </View>
      <RowV style={{ justifyContent: 'space-around', marginTop: 22 }}>
        {(
          [
            ['mic-off', 'Mute'],
            ['dialpad', 'Keypad'],
            ['volume-up', 'Speaker'],
            ['call-end', 'End'],
          ] as const
        ).map(([icon, label]) => (
          <Pressable key={label} accessibilityRole="button" accessibilityLabel={label} onPress={() => toast(label === 'End' ? 'Decide first: tap Answer to say Legit or Scam' : `${label} is just for show in this round`, 'info-outline')} style={{ alignItems: 'center', gap: 6 }}>
            <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: label === 'End' ? '#E5383B' : c.surface, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={icon} size={26} color={label === 'End' ? '#fff' : c.text} />
            </View>
            <T v="small" c="text2">
              {label}
            </T>
          </Pressable>
        ))}
      </RowV>
    </View>
  );
}
