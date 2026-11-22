import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useColors, radius, space, type Palette } from '@/lib/theme';
import type { PublicUser } from '@/lib/types';

export type IconName = React.ComponentProps<typeof MaterialIcons>['name'];
export function Icon({ name, size = 20, color, style }: { name: IconName; size?: number; color?: string; style?: StyleProp<TextStyle> }) {
  const c = useColors();
  return <MaterialIcons name={name} size={size} color={color ?? c.text} style={style} />;
}

/* ---------------- text ---------------- */
type Variant = 'display' | 'h1' | 'h2' | 'h3' | 'body' | 'small' | 'label' | 'mono' | 'button';
const variants: Record<Variant, TextStyle> = {
  display: { fontSize: 34, fontWeight: '700', letterSpacing: -0.8, lineHeight: 40 },
  h1: { fontSize: 28, fontWeight: '700', letterSpacing: -0.6, lineHeight: 34 },
  h2: { fontSize: 20, fontWeight: '600', letterSpacing: -0.3, lineHeight: 26 },
  h3: { fontSize: 16, fontWeight: '600', lineHeight: 22 },
  body: { fontSize: 15, lineHeight: 22 },
  small: { fontSize: 13, lineHeight: 18 },
  label: { fontSize: 12, fontWeight: '600', letterSpacing: 0.4, textTransform: 'uppercase' },
  mono: { fontSize: 13, fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }), fontVariant: ['tabular-nums'] },
  button: { fontSize: 16, fontWeight: '600' },
};
export function T({
  v = 'body',
  c,
  style,
  children,
  numberOfLines,
  center,
  selectable,
}: {
  v?: Variant;
  c?: keyof Palette | (string & {});
  style?: StyleProp<TextStyle>;
  children: ReactNode;
  numberOfLines?: number;
  center?: boolean;
  selectable?: boolean;
}) {
  const p = useColors();
  const color = c ? ((p as Record<string, string>)[c] ?? c) : p.text;
  return (
    <Text numberOfLines={numberOfLines} selectable={selectable} style={[variants[v], { color }, center && { textAlign: 'center' }, style]}>
      {children}
    </Text>
  );
}

/* ---------------- layout ---------------- */
export function Screen({
  children,
  scroll = true,
  refreshing,
  onRefresh,
  padded = true,
  edges = ['top'],
  contentStyle,
}: {
  children: ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  padded?: boolean;
  edges?: Array<'top' | 'bottom' | 'left' | 'right'>;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const pad = padded ? { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: 48 } : null;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={edges}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[pad, contentStyle]}
          keyboardShouldPersistTaps="handled"
          refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={c.text3} /> : undefined}>
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, pad, contentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Gap({ h = space.md, w }: { h?: number; w?: number }) {
  return <View style={{ height: w ? undefined : h, width: w }} />;
}
export function RowV({ children, gap = space.sm, style, wrap, accessibilityLabel }: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle>; wrap?: boolean; accessibilityLabel?: string }) {
  return <View accessibilityLabel={accessibilityLabel} style={[{ flexDirection: 'row', alignItems: 'center', gap, flexWrap: wrap ? 'wrap' : 'nowrap' }, style]}>{children}</View>;
}
export function Divider() {
  const c = useColors();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.line }} />;
}
export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const c = useColors();
  const s = [{ backgroundColor: c.surface, borderRadius: radius.lg, padding: space.lg }, style];
  return onPress ? (
    <Pressable onPress={onPress} style={({ pressed }) => [s, pressed && { opacity: 0.8 }]}>
      {children}
    </Pressable>
  ) : (
    <View style={s}>{children}</View>
  );
}

/* ---------------- controls ---------------- */
export function Button({
  title,
  onPress,
  kind = 'ink',
  icon,
  loading,
  disabled,
  size = 'md',
  style,
  full,
  accessibilityLabel,
}: {
  title: string;
  onPress?: () => void;
  kind?: 'ink' | 'outline' | 'ghost' | 'soft' | 'danger' | 'dangerFill';
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
  full?: boolean;
  accessibilityLabel?: string;
}) {
  const c = useColors();
  const bg = { ink: c.ink, outline: 'transparent', ghost: 'transparent', soft: c.surface, danger: 'transparent', dangerFill: c.scam }[kind];
  const fg = { ink: c.onInk, outline: c.text, ghost: c.text2, soft: c.text, danger: c.scam, dangerFill: '#fff' }[kind];
  const h = { sm: 36, md: 46, lg: 54 }[size];
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      onPress={off ? undefined : onPress}
      style={({ pressed }) => [
        {
          height: h,
          borderRadius: Platform.OS === 'android' ? h / 2 : size === 'lg' ? 14 : 12,
          backgroundColor: bg,
          paddingHorizontal: size === 'sm' ? 12 : 18,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          borderWidth: kind === 'outline' || kind === 'danger' ? 1 : 0,
          borderColor: c.line,
          opacity: off ? 0.45 : pressed ? 0.85 : 1,
          alignSelf: full ? 'stretch' : 'auto',
        },
        style,
      ]}>
      {loading ? <ActivityIndicator color={fg} /> : icon ? <Icon name={icon} size={size === 'sm' ? 16 : 20} color={fg} /> : null}
      <Text style={[variants.button, { color: fg, fontSize: size === 'sm' ? 13 : size === 'lg' ? 17 : 15 }]}>{title}</Text>
    </Pressable>
  );
}

export function IconButton({ name, onPress, label, badge, color }: { name: IconName; onPress: () => void; label: string; badge?: number; color?: string }) {
  const c = useColors();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={8} style={({ pressed }) => ({ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? c.surface : 'transparent' })}>
      <Icon name={name} size={24} color={color ?? c.text} />
      {badge ? (
        <View style={{ position: 'absolute', top: 4, right: 4, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: c.scam, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 }}>
          <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function Chip({ label, tone = 'neutral', icon }: { label: string; tone?: 'neutral' | 'scam' | 'legit' | 'accent' | 'streak'; icon?: IconName }) {
  const c = useColors();
  const map = { neutral: [c.surface, c.text2], scam: [c.scamSoft, c.scam], legit: [c.legitSoft, c.legit], accent: [c.accentSoft, c.accent], streak: [c.streakSoft, c.streak] }[tone];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: map[0], borderRadius: 6, paddingHorizontal: 8, height: 24, alignSelf: 'flex-start' }}>
      {icon ? <Icon name={icon} size={14} color={map[1]} /> : null}
      <Text style={{ color: map[1], fontSize: 12, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

export function Segmented<K extends string>({ options, value, onChange }: { options: Array<{ key: K; label: string }>; value: K; onChange: (k: K) => void }) {
  const c = useColors();
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: 'row', backgroundColor: c.surface, borderRadius: 10, padding: 3 }}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.key)}
            style={{ flex: 1, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? c.raised : 'transparent', ...(on ? shadow(c, 1) : null) }}>
            <Text style={{ fontSize: 13, fontWeight: on ? '600' : '500', color: on ? c.text : c.text2 }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Switch({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  const c = useColors();
  return (
    <Pressable accessibilityRole="switch" accessibilityLabel={label} accessibilityState={{ checked: value }} onPress={() => onChange(!value)} style={{ width: 48, height: 28, borderRadius: 14, backgroundColor: value ? (Platform.OS === 'ios' ? '#34C759' : c.ink) : c.line, padding: 3, alignItems: value ? 'flex-end' : 'flex-start' }}>
      <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: value && Platform.OS !== 'ios' ? c.onInk : '#fff' }} />
    </Pressable>
  );
}

export function ProgressBar({ value, color }: { value: number; color?: string }) {
  const c = useColors();
  return (
    <View style={{ height: 6, borderRadius: 3, backgroundColor: c.line, overflow: 'hidden' }}>
      <View style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, height: 6, borderRadius: 3, backgroundColor: color ?? c.ink }} />
    </View>
  );
}

export function ListRow({ children, onPress, style }: { children: ReactNode; onPress?: () => void; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return (
    <Pressable disabled={!onPress} onPress={onPress} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.line, opacity: pressed ? 0.7 : 1 }, style]}>
      {children}
    </Pressable>
  );
}

export function Section({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <RowV style={{ justifyContent: 'space-between', marginTop: space.xl, marginBottom: space.sm }}>
      <T v="h3">{title}</T>
      {action ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <T v="small" c="accent" style={{ fontWeight: '600' }}>
            {action}
          </T>
        </Pressable>
      ) : null}
    </RowV>
  );
}

export function StatStrip({ items }: { items: Array<{ label: string; value: string; sub?: string; icon?: IconName; iconColor?: string; muted?: boolean }> }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.line, marginVertical: space.lg }}>
      {items.map((s, i) => (
        <View key={s.label} style={{ flex: 1, paddingVertical: space.md, paddingLeft: i ? space.md : 0, borderLeftWidth: i ? StyleSheet.hairlineWidth : 0, borderColor: c.line }}>
          <T v="small" c="text3">
            {s.label}
          </T>
          <RowV gap={4} style={{ marginTop: 2 }}>
            {s.icon ? <Icon name={s.icon} size={18} color={s.iconColor} /> : null}
            <T v="h2" c={s.muted ? 'text3' : 'text'} numberOfLines={1}>
              {s.value}
            </T>
          </RowV>
          {s.sub ? (
            <T v="mono" c="text2" style={{ fontSize: 11, marginTop: 2 }} numberOfLines={1}>
              {s.sub}
            </T>
          ) : null}
        </View>
      ))}
    </View>
  );
}

/* ---------------- avatar ---------------- */
export function Avatar({ user, name, uri, color, size = 40, online }: { user?: Pick<PublicUser, 'username' | 'avatarUrl' | 'avatarColor'> | null; name?: string; uri?: string | null; color?: string | null; size?: number; online?: boolean }) {
  const c = useColors();
  const label = (user?.username ?? name ?? '?').replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase();
  const src = uri ?? user?.avatarUrl ?? null;
  const bg = color ?? user?.avatarColor ?? c.avatar;
  const tinted = !!(color ?? user?.avatarColor);
  return (
    <View style={{ width: size, height: size }}>
      {src ? (
        <Image source={{ uri: src }} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" accessibilityIgnoresInvertColors />
      ) : (
        <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: tinted ? '#fff' : c.text, fontWeight: '700', fontSize: size * 0.36 }}>{label}</Text>
        </View>
      )}
      {online !== undefined ? (
        <View style={{ position: 'absolute', right: -1, bottom: -1, width: Math.max(10, size * 0.28), height: Math.max(10, size * 0.28), borderRadius: 99, backgroundColor: online ? c.legit : c.text3, borderWidth: 2, borderColor: c.bg }} />
      ) : null}
    </View>
  );
}

/* ---------------- states ---------------- */
export function EmptyState({ icon, title, body, actions, dashed }: { icon: IconName; title: string; body: string; actions?: ReactNode; dashed?: boolean }) {
  const c = useColors();
  return (
    <View style={[{ alignItems: 'center', paddingVertical: 32, paddingHorizontal: 16, gap: 6 }, dashed && { borderWidth: 1, borderStyle: 'dashed', borderColor: c.line, borderRadius: radius.lg }]}>
      <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
        <Icon name={icon} size={28} color={c.text2} />
      </View>
      <T v="h3" center>
        {title}
      </T>
      <T c="text2" center style={{ maxWidth: 340 }}>
        {body}
      </T>
      {actions ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14, justifyContent: 'center' }}>{actions}</View> : null}
    </View>
  );
}

export function ErrorState({ error, onRetry }: { error: { message: string; offline?: boolean } | null; onRetry: () => void }) {
  return (
    <EmptyState
      icon={error?.offline ? 'wifi-off' : 'error-outline'}
      title={error?.offline ? "You're offline" : "That didn't load"}
      body={error?.message ?? 'Something went wrong. Try again.'}
      actions={<Button title="Try again" icon="refresh" onPress={onRetry} />}
    />
  );
}

function Pulse({ style }: { style: StyleProp<ViewStyle> }) {
  const c = useColors();
  const v = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.sequence([Animated.timing(v, { toValue: 1, duration: 600, useNativeDriver: true }), Animated.timing(v, { toValue: 0.5, duration: 600, useNativeDriver: true })]));
    a.start();
    return () => a.stop();
  }, [v]);
  return <Animated.View style={[{ backgroundColor: c.surface, borderRadius: 8, opacity: v }, style]} />;
}

/** Placeholder layout shown while a screen loads. */
export function Skeleton({ rows = 4, header = true }: { rows?: number; header?: boolean }) {
  return (
    <View accessibilityLabel="Loading" style={{ gap: 12 }}>
      {header ? (
        <>
          <Pulse style={{ width: 140, height: 12 }} />
          <Pulse style={{ width: '70%', height: 30 }} />
          <Pulse style={{ width: '100%', height: 90, marginTop: 8 }} />
        </>
      ) : null}
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 }}>
          <Pulse style={{ width: 40, height: 40, borderRadius: 20 }} />
          <View style={{ flex: 1, gap: 6 }}>
            <Pulse style={{ width: '50%', height: 12 }} />
            <Pulse style={{ width: '30%', height: 10 }} />
          </View>
          <Pulse style={{ width: 64, height: 30 }} />
        </View>
      ))}
    </View>
  );
}

/* ---------------- sheet ---------------- */
export function Sheet({ visible, onClose, title, subtitle, children }: { visible: boolean; onClose: () => void; title?: string; subtitle?: string; children: ReactNode }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={{ flex: 1, backgroundColor: c.scrim }} onPress={onClose} accessibilityLabel="Close" />
      <View style={{ backgroundColor: c.raised, borderTopLeftRadius: Platform.OS === 'ios' ? 16 : 28, borderTopRightRadius: Platform.OS === 'ios' ? 16 : 28, paddingHorizontal: space.xl, paddingTop: 10, paddingBottom: insets.bottom + space.lg, maxHeight: '92%' }}>
        <View style={{ alignSelf: 'center', width: 36, height: 5, borderRadius: 3, backgroundColor: c.line, marginBottom: 14 }} />
        {title ? (
          <RowV style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: space.lg }}>
            <View style={{ flex: 1 }}>
              <T v="h2">{title}</T>
              {subtitle ? (
                <T c="text2" style={{ marginTop: 2 }}>
                  {subtitle}
                </T>
              ) : null}
            </View>
            <IconButton name="close" label="Close" onPress={onClose} color={c.text2} />
          </RowV>
        ) : null}
        <ScrollView keyboardShouldPersistTaps="handled" bounces={false}>
          {children}
        </ScrollView>
      </View>
    </Modal>
  );
}

/* ---------------- toast ---------------- */
const ToastCtx = createContext<(msg: string, icon?: IconName) => void>(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: ReactNode }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [msg, setMsg] = useState<{ text: string; icon?: IconName; k: number } | null>(null);
  const show = useCallback((text: string, icon?: IconName) => setMsg({ text, icon, k: Date.now() }), []);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 2600);
    return () => clearTimeout(t);
  }, [msg]);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {msg ? (
        <View pointerEvents="none" style={{ position: 'absolute', left: 16, right: 16, bottom: insets.bottom + 96, alignItems: 'center' }}>
          <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: c.ink, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, ...shadow(c, 3) }}>
            {msg.icon ? <Icon name={msg.icon} color={c.onInk} size={18} /> : null}
            <Text style={{ color: c.onInk, fontWeight: '500' }}>{msg.text}</Text>
          </View>
        </View>
      ) : null}
    </ToastCtx.Provider>
  );
}

export function shadow(_c: Palette, level: 1 | 2 | 3): ViewStyle {
  return Platform.select({
    ios: { shadowColor: '#000', shadowOpacity: 0.06 * level, shadowRadius: 4 * level, shadowOffset: { width: 0, height: level } },
    android: { elevation: level * 2 },
    default: { boxShadow: `0 ${level}px ${level * 6}px rgba(0,0,0,${0.06 * level})` } as ViewStyle,
  })!;
}

export const fmt = (n: number) => n.toLocaleString('en-US');
export const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, '0')}`;
export const MODE_NAME: Record<string, string> = { mail: 'Phishing Emails', sms: 'Scam Messages', call: 'Scam Calls', marathon: 'Marathon', daily: 'Daily challenge', ranked: 'Ranked', casual: 'Casual duel' };
export const TYPE_ICON: Record<string, IconName> = { mail: 'mail-outline', sms: 'sms', call: 'call', ranked: 'military-tech', marathon: 'all-inclusive', daily: 'today', casual: 'sports-esports' };
