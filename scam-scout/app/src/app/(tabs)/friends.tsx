import { useMemo, useState } from 'react';
import { TextInput, View } from 'react-native';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Screen, T, Gap, Button, Segmented, Avatar, Icon, ListRow, EmptyState, ErrorState, Skeleton, RowV, Card, useToast } from '@/components/ui';
import { useApi } from '@/lib/useApi';
import { api, errMsg } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useColors } from '@/lib/theme';
import type { Challenge, PublicUser } from '@/lib/types';

type Friends = { friends: PublicUser[]; incoming: PublicUser[]; outgoing: PublicUser[] };

export default function FriendsScreen() {
  const c = useColors();
  const toast = useToast();
  const { me } = useAuth();
  const [tab, setTab] = useState<'all' | 'online' | 'requests'>('all');
  const [q, setQ] = useState('');
  const { data, error, loading, refreshing, reload, setData } = useApi<Friends>('/friends');
  const challenges = useApi<Challenge[]>('/challenges', { pollMs: 8000 });
  const invite = `scamscout://add/${me?.username ?? ''}`;

  const list = useMemo(() => {
    const f = data?.friends ?? [];
    return f.filter((x) => (tab === 'online' ? x.online : true)).filter((x) => !q || x.username.toLowerCase().includes(q.toLowerCase()));
  }, [data, tab, q]);

  const respond = async (u: PublicUser, action: 'accept' | 'decline') => {
    try {
      await api(`/friends/requests/${u.id}/${action}`, { method: 'POST' });
      toast(action === 'accept' ? `${u.username} is now your friend` : 'Request declined', action === 'accept' ? 'person-add' : 'close');
      if (data) setData({ ...data, incoming: data.incoming.filter((x) => x.id !== u.id), friends: action === 'accept' ? [...data.friends, u] : data.friends });
    } catch (e) {
      toast(errMsg(e), 'error-outline');
    }
  };
  const challengeAct = async (ch: Challenge, action: 'accept' | 'decline' | 'cancel') => {
    try {
      const r = await api<Challenge>(`/challenges/${ch.id}/${action}`, { method: 'POST' });
      if (action === 'accept' && r.matchId) router.push({ pathname: '/matchmaking', params: { matchId: r.matchId } });
      else void challenges.reloadSilently();
    } catch (e) {
      toast(errMsg(e), 'error-outline');
    }
  };
  const copyInvite = async () => {
    await Clipboard.setStringAsync(invite);
    toast('Invite link copied', 'content-copy');
  };

  const incoming = data?.incoming ?? [];
  const pendingCh = (challenges.data ?? []).filter((x) => x.status === 'pending');

  const content = () => {
    if (loading) return <Skeleton header={false} rows={5} />;
    if (error || !data) return <ErrorState error={error} onRetry={reload} />;
    if (tab === 'requests') {
      if (!incoming.length && !data.outgoing.length) return <EmptyState dashed icon="inbox" title="No friend requests" body="When someone adds you, it shows up here." />;
      return (
        <>
          {incoming.map((u) => (
            <ListRow key={u.id}>
              <Avatar user={u} size={40} />
              <View style={{ flex: 1 }}>
                <T style={{ fontWeight: '600' }}>{u.username}</T>
                <T v="small" c="text3">
                  Wants to be friends
                </T>
              </View>
              <Button title="Decline" kind="ghost" size="sm" onPress={() => respond(u, 'decline')} />
              <Button title="Accept" size="sm" onPress={() => respond(u, 'accept')} />
            </ListRow>
          ))}
          {data.outgoing.map((u) => (
            <ListRow key={u.id}>
              <Avatar user={u} size={40} />
              <View style={{ flex: 1 }}>
                <T style={{ fontWeight: '600' }}>{u.username}</T>
                <T v="small" c="text3">
                  Request sent
                </T>
              </View>
              <Button
                title="Cancel"
                kind="ghost"
                size="sm"
                onPress={async () => {
                  await api(`/friends/requests/${u.id}/cancel`, { method: 'POST' }).catch(() => null);
                  void reload();
                }}
              />
            </ListRow>
          ))}
        </>
      );
    }
    if (!data.friends.length)
      return (
        <EmptyState
          dashed
          icon="group-add"
          title="No friends yet"
          body="Add friends by username or send them your invite link. Then duel them and see them on your friends leaderboard."
          actions={
            <>
              <Button title="Add friend" icon="person-add" onPress={() => router.push('/add-friend')} />
              <Button title="Copy invite link" icon="link" kind="outline" onPress={copyInvite} />
            </>
          }
        />
      );
    if (!list.length)
      return q ? (
        <EmptyState icon="search-off" title={`No friends match "${q}"`} body="Check the spelling, or add them as a new friend." actions={<Button title="Clear search" kind="outline" onPress={() => setQ('')} />} />
      ) : (
        <EmptyState icon="bedtime" title="Nobody is online" body="Friends show up here when they open Scam Scout." />
      );
    return list.map((u) => (
      <ListRow key={u.id}>
        <Avatar user={u} size={40} online={u.online} />
        <View style={{ flex: 1 }}>
          <T style={{ fontWeight: '600' }}>{u.username}</T>
          <T v="small" c={u.online ? 'legit' : 'text3'}>
            {u.online ? 'Online' : 'Offline'} · {u.tier}
          </T>
        </View>
        <Button title="Challenge" icon="sports-kabaddi" kind="outline" size="sm" onPress={() => router.push(`/challenge/${u.id}`)} />
      </ListRow>
    ));
  };

  return (
    <Screen refreshing={refreshing} onRefresh={reload}>
      <RowV style={{ justifyContent: 'space-between' }}>
        <View>
          <T v="h1">Friends</T>
          <T c="text2">
            {data?.friends.length ?? 0} friends · {data?.friends.filter((f) => f.online).length ?? 0} online
          </T>
        </View>
        <Button title="Add" icon="person-add" size="sm" onPress={() => router.push('/add-friend')} />
      </RowV>
      {pendingCh.length ? (
        <View style={{ marginTop: 16, gap: 8 }}>
          {pendingCh.map((ch) => (
            <Card key={ch.id} style={{ paddingVertical: 12 }}>
              <RowV>
                <Icon name="sports-kabaddi" color={c.accent} />
                <T style={{ flex: 1 }} numberOfLines={2}>
                  {ch.incoming ? `${ch.from.username} challenged you to a ${ch.type} duel` : `Waiting for ${ch.to.username} to accept your ${ch.type} duel`}
                </T>
              </RowV>
              <RowV style={{ justifyContent: 'flex-end', marginTop: 8 }}>
                {ch.incoming ? (
                  <>
                    <Button title="Decline" kind="ghost" size="sm" onPress={() => challengeAct(ch, 'decline')} />
                    <Button title="Play" size="sm" icon="play-arrow" onPress={() => challengeAct(ch, 'accept')} />
                  </>
                ) : (
                  <Button title="Cancel" kind="ghost" size="sm" onPress={() => challengeAct(ch, 'cancel')} />
                )}
              </RowV>
            </Card>
          ))}
        </View>
      ) : null}
      <Gap h={16} />
      <RowV style={{ height: 42, borderRadius: 10, backgroundColor: c.surface, paddingHorizontal: 12 }}>
        <Icon name="search" color={c.text3} />
        <TextInput value={q} onChangeText={setQ} placeholder="Search your friends" placeholderTextColor={c.text3} style={{ flex: 1, color: c.text, fontSize: 15 }} accessibilityLabel="Search your friends" autoCapitalize="none" />
      </RowV>
      <Gap h={12} />
      <Segmented
        options={[
          { key: 'all', label: 'All' },
          { key: 'online', label: 'Online' },
          { key: 'requests', label: incoming.length ? `Requests (${incoming.length})` : 'Requests' },
        ]}
        value={tab}
        onChange={setTab}
      />
      <Gap h={4} />
      {content()}
      <Card style={{ marginTop: 28 }}>
        <T style={{ fontWeight: '600' }}>Your invite link</T>
        <T v="small" c="text2" style={{ marginVertical: 6 }}>
          Friends who open it can add you straight away.
        </T>
        <T v="mono" selectable>
          {invite}
        </T>
        <Gap h={10} />
        <Button title="Copy link" icon="content-copy" kind="outline" size="sm" onPress={copyInvite} />
      </Card>
    </Screen>
  );
}
