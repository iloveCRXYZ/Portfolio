import { View } from 'react-native';
import { router } from 'expo-router';
import { Screen, T, Button, Icon, RowV, ListRow, EmptyState, ErrorState, Skeleton, useToast, type IconName } from '@/components/ui';
import { api, errMsg } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { useColors } from '@/lib/theme';
import type { Notification } from '@/lib/types';

const ICON: Record<string, IconName> = { friend_request: 'person-add', friend_accepted: 'group', challenge: 'sports-kabaddi', challenge_declined: 'do-not-disturb-on', match_done: 'emoji-events', rematch: 'replay' };

function ago(ms: number) {
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return 'Just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function Notifications() {
  const c = useColors();
  const toast = useToast();
  const { data, error, loading, refreshing, reload, setData } = useApi<Notification[]>('/notifications');
  const unread = data?.filter((n) => !n.read).length ?? 0;

  const open = async (n: Notification) => {
    if (!n.read) {
      setData((d) => d?.map((x) => (x.id === n.id ? { ...x, read: true } : x)) ?? d);
      api(`/notifications/${n.id}/read`, { method: 'POST' }).catch(() => {});
    }
    if (n.kind === 'friend_request') router.push('/friends');
    else if (n.kind === 'challenge') router.push('/friends');
    else if (n.kind === 'match_done' || n.kind === 'rematch') router.push('/profile');
  };
  const readAll = async () => {
    try {
      await api('/notifications/read-all', { method: 'POST' });
      setData((d) => d?.map((x) => ({ ...x, read: true })) ?? d);
    } catch (e) {
      toast(errMsg(e), 'error-outline');
    }
  };
  const clear = async () => {
    try {
      await api('/notifications', { method: 'DELETE' });
      setData([]);
      toast('Notifications cleared', 'delete-sweep');
    } catch (e) {
      toast(errMsg(e), 'error-outline');
    }
  };

  return (
    <Screen refreshing={refreshing} onRefresh={reload}>
      <Button title="Back" icon="arrow-back" kind="ghost" size="sm" style={{ alignSelf: 'flex-start', marginLeft: -10 }} onPress={() => router.back()} />
      <RowV style={{ justifyContent: 'space-between', marginTop: 8 }}>
        <View>
          <T v="h1">Notifications</T>
          <T c="text2">{unread ? `${unread} unread` : 'All caught up'}</T>
        </View>
        {data?.length ? (
          <RowV gap={4}>
            <Button title="Read all" kind="ghost" size="sm" disabled={!unread} onPress={readAll} />
            <Button title="Clear" kind="ghost" size="sm" onPress={clear} />
          </RowV>
        ) : null}
      </RowV>
      {loading ? (
        <Skeleton header={false} rows={4} />
      ) : error || !data ? (
        <ErrorState error={error} onRetry={reload} />
      ) : data.length ? (
        data.map((n) => (
          <ListRow key={n.id} onPress={() => open(n)}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={ICON[n.kind] ?? 'notifications'} color={c.text2} />
            </View>
            <View style={{ flex: 1 }}>
              <T style={{ fontWeight: n.read ? '400' : '600' }}>{n.text}</T>
              <T v="small" c="text3">
                {ago(n.createdAt)}
              </T>
            </View>
            {!n.read ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.accent }} /> : null}
          </ListRow>
        ))
      ) : (
        <EmptyState dashed icon="notifications-off" title="You're all caught up" body="Friend requests, duel invites and match results will show up here." actions={<Button title="Back to home" kind="outline" onPress={() => router.replace('/')} />} />
      )}
    </Screen>
  );
}
