import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { Screen, T, Gap, Button, Icon, RowV } from '@/components/ui';
import { ChapterView } from '@/components/guide-view';
import { GUIDE } from '@/lib/guide';
import { useColors } from '@/lib/theme';

export default function GuideScreen() {
  const c = useColors();
  const [id, setId] = useState(GUIDE[0].id);
  const chapter = GUIDE.find((g) => g.id === id) ?? GUIDE[0];
  const next = GUIDE[GUIDE.indexOf(chapter) + 1];
  return (
    <Screen>
      <T v="h1">Guide Book</T>
      <RowV gap={8} style={{ backgroundColor: c.accentSoft, borderRadius: 12, padding: 12, marginTop: 12 }}>
        <Icon name="lock" size={18} color={c.accent} />
        <T v="small" c="accent" style={{ flex: 1, fontWeight: '500' }}>
          Open any time in practice modes. Locked during Ranked.
        </T>
      </RowV>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 16, marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
        {GUIDE.map((g) => {
          const on = g.id === id;
          return (
            <Pressable key={g.id} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => setId(g.id)} style={{ height: 34, paddingHorizontal: 14, borderRadius: 17, justifyContent: 'center', backgroundColor: on ? c.ink : 'transparent', borderWidth: on ? 0 : 1, borderColor: c.line }}>
              <T v="small" c={on ? 'onInk' : 'text'} style={{ fontWeight: '500' }}>
                {g.title}
              </T>
            </Pressable>
          );
        })}
      </ScrollView>
      <ChapterView chapter={chapter} />
      <Gap h={12} />
      <View style={{ alignItems: 'flex-start' }}>
        {next ? <Button title={`Next: ${next.title}`} kind="outline" icon="arrow-forward" onPress={() => setId(next.id)} /> : <Button title="Put it to the test" icon="play-arrow" onPress={() => router.push('/modes')} />}
      </View>
    </Screen>
  );
}
