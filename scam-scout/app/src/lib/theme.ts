import { useColorScheme } from 'react-native';
import { useAuth } from './auth';

// Neutral ink UI with one blue accent. Red and green are reserved for scam / legit.
const light = {
  bg: '#FFFFFF',
  surface: '#F5F5F3',
  raised: '#FFFFFF',
  line: '#E6E5E1',
  avatar: '#ECEAE6',
  text: '#141414',
  text2: '#5D5D5A',
  text3: '#8F8E87',
  ink: '#141414',
  onInk: '#FFFFFF',
  accent: '#2F5BEA',
  accentSoft: '#ECF0FE',
  scam: '#C93434',
  scamSoft: '#FCEDED',
  legit: '#1B7F4F',
  legitSoft: '#E6F4EC',
  streak: '#C9650C',
  streakSoft: '#FDF1E4',
  bubble: '#E9E9EB',
  scrim: 'rgba(12,12,14,0.4)',
};
export type Palette = typeof light;
const dark: Palette = {
  bg: '#0F0F10',
  surface: '#18181B',
  raised: '#1E1E21',
  line: '#2B2B2F',
  avatar: '#2B2B2F',
  text: '#F2F2F2',
  text2: '#A6A6A6',
  text3: '#76767A',
  ink: '#F2F2F2',
  onInk: '#121212',
  accent: '#8AA2FF',
  accentSoft: '#1D2444',
  scam: '#FF7070',
  scamSoft: '#3A1B1C',
  legit: '#52D69A',
  legitSoft: '#13291F',
  streak: '#FFA64D',
  streakSoft: '#36230F',
  bubble: '#2C2C30',
  scrim: 'rgba(0,0,0,0.62)',
};

export function useScheme(): 'light' | 'dark' {
  const system = useColorScheme();
  const { me } = useAuth();
  const pref = me?.prefs?.theme ?? 'system';
  if (pref === 'light' || pref === 'dark') return pref;
  return system === 'dark' ? 'dark' : 'light';
}

export function useColors(): Palette {
  return useScheme() === 'dark' ? dark : light;
}

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 };
