import { View } from 'react-native';
import { router } from 'expo-router';
import { Screen, T, Gap, Button, Icon, Card, ListRow, Chip, RowV } from '@/components/ui';
import { OAuthButtons } from '@/components/oauth';
import { useColors } from '@/lib/theme';

const SAMPLE: Array<[string, string, 'scam' | 'legit']> = [
  ['"Your account has been limited"', 'Email', 'scam'],
  ['"Dinner Sunday? Love, Mom"', 'Text', 'legit'],
  ['"IRS here. Pay with gift cards"', 'Call', 'scam'],
];

export default function Welcome() {
  const c = useColors();
  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: c.ink, alignItems: 'center', justifyContent: 'center', marginTop: 24 }}>
        <Icon name="shield" size={28} color={c.onInk} />
      </View>
      <Gap h={28} />
      <T v="display">Spot the scam before it spots you.</T>
      <Gap h={10} />
      <T c="text2">Real phishing emails, scam texts and fake calls. Ten rounds at a time. Play solo, duel friends, or climb ranked.</T>
      <Gap h={24} />
      <Card style={{ paddingVertical: 4 }}>
        {SAMPLE.map(([t, kind, v], i) => (
          <ListRow key={t} style={i === SAMPLE.length - 1 ? { borderBottomWidth: 0 } : undefined}>
            <View style={{ flex: 1 }}>
              <T v="small" c="text3">
                {kind}
              </T>
              <T numberOfLines={1}>{t}</T>
            </View>
            <Chip label={v === 'scam' ? 'Scam' : 'Legit'} tone={v} />
          </ListRow>
        ))}
      </Card>
      <Gap h={28} />
      <View style={{ gap: 12 }}>
        <OAuthButtons />
        <Button title="Sign up with email" icon="alternate-email" kind="soft" size="lg" full onPress={() => router.push('/signup')} />
      </View>
      <Gap h={18} />
      <RowV style={{ justifyContent: 'center' }} gap={4}>
        <T c="text2">Already playing?</T>
        <Button title="Log in" kind="ghost" size="sm" onPress={() => router.push('/login')} />
      </RowV>
      <T v="small" c="text3" center style={{ marginTop: 8 }}>
        By continuing you agree to the Terms and Privacy Policy.
      </T>
    </Screen>
  );
}
