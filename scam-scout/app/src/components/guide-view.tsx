import { View } from 'react-native';
import { GUIDE, type Chapter } from '@/lib/guide';
import { useColors } from '@/lib/theme';
import { T, Icon, Chip, RowV, Gap } from './ui';

export function ChapterView({ chapter }: { chapter: Chapter }) {
  const c = useColors();
  const idx = GUIDE.indexOf(chapter);
  return (
    <View>
      <T v="mono" c="text3">
        Chapter {idx + 1} · {chapter.minutes} min read
      </T>
      <T v="h1" style={{ marginTop: 4 }}>
        {chapter.title}
      </T>
      <T c="text2" style={{ marginTop: 8 }}>
        {chapter.intro}
      </T>
      <Gap h={20} />
      {chapter.cards?.map((card) => (
        <View key={card.title} style={{ marginBottom: 22 }}>
          <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
            <Icon name={card.icon} />
          </View>
          <T v="h3">{card.title}</T>
          <T c="text2" style={{ marginTop: 4 }}>
            {card.body}
          </T>
          {card.example ? (
            <View style={{ marginTop: 8, backgroundColor: c.surface, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 }}>
              <T v="mono">{card.example}</T>
            </View>
          ) : null}
        </View>
      ))}
      {chapter.pairs?.map(([real, fake]) => (
        <View key={real} style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.line, gap: 8 }}>
          <RowV>
            <Chip label="Real" tone="legit" icon="check" />
            <T v="mono" style={{ flex: 1 }}>
              {real}
            </T>
          </RowV>
          <RowV>
            <Chip label="Fake" tone="scam" icon="close" />
            <T v="mono" c="text2" style={{ flex: 1 }}>
              {fake}
            </T>
          </RowV>
        </View>
      ))}
      {chapter.steps?.map(([t, d], i) => (
        <RowV key={t} gap={12} style={{ alignItems: 'flex-start', marginBottom: 16 }}>
          <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: c.ink, alignItems: 'center', justifyContent: 'center' }}>
            <T v="small" c="onInk" style={{ fontWeight: '700' }}>
              {i + 1}
            </T>
          </View>
          <View style={{ flex: 1 }}>
            <T style={{ fontWeight: '600' }}>{t}</T>
            <T c="text2">{d}</T>
          </View>
        </RowV>
      ))}
    </View>
  );
}
