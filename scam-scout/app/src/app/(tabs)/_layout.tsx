import { Platform } from 'react-native';
import { Tabs } from 'expo-router/js-tabs';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useColors } from '@/lib/theme';

const TABS = [
  ['index', 'Play', 'sports-esports'],
  ['guide', 'Guide', 'menu-book'],
  ['leaderboard', 'Ranks', 'leaderboard'],
  ['friends', 'Friends', 'group'],
  ['profile', 'Profile', 'person'],
] as const;

export default function TabLayout() {
  const c = useColors();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Platform.OS === 'ios' ? c.accent : c.text,
        tabBarInactiveTintColor: c.text3,
        tabBarStyle: { backgroundColor: c.bg, borderTopColor: c.line },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
      }}>
      {TABS.map(([name, title, icon]) => (
        <Tabs.Screen key={name} name={name} options={{ title, tabBarIcon: ({ color, size }) => <MaterialIcons name={icon} color={color as string} size={size} /> }} />
      ))}
    </Tabs>
  );
}
