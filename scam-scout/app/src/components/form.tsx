import { TextInput, View, type TextInputProps } from 'react-native';
import { useColors, radius } from '@/lib/theme';
import { Icon, T, RowV } from './ui';

type Props = TextInputProps & { label: string; error?: string | null; hint?: string | null; hintTone?: 'ok' | 'muted' };

export function Field({ label, error, hint, hintTone = 'muted', style, ...rest }: Props) {
  const c = useColors();
  return (
    <View style={{ gap: 6 }}>
      <T v="small" c="text2" style={{ fontWeight: '500' }}>
        {label}
      </T>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={c.text3}
        style={[{ height: 48, borderRadius: radius.md, borderWidth: 1, borderColor: error ? c.scam : c.line, paddingHorizontal: 14, color: c.text, backgroundColor: c.bg, fontSize: 16 }, style]}
        {...rest}
      />
      {error ? (
        <RowV gap={4}>
          <Icon name="error-outline" size={14} color={c.scam} />
          <T v="small" c="scam" style={{ flex: 1 }}>
            {error}
          </T>
        </RowV>
      ) : hint ? (
        <RowV gap={4}>
          {hintTone === 'ok' ? <Icon name="check-circle" size={14} color={c.legit} /> : null}
          <T v="small" c={hintTone === 'ok' ? 'legit' : 'text3'}>
            {hint}
          </T>
        </RowV>
      ) : null}
    </View>
  );
}

export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
