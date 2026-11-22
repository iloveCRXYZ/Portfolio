import { useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Screen, T, Gap, Button, Avatar, Icon, RowV, ListRow, EmptyState, Skeleton, Section, Chip, useToast } from '@/components/ui';
import { api, errMsg } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { useAuth } from '@/lib/auth';
import { useColors } from '@/lib/theme';
import type { PublicUser, Relation } from '@/lib/types';

type Found = PublicUser & { relation: Relation };

export default function AddFriend() {
  const c = useColors();
  const toast = useToast();
  const { me } = useAuth();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Found[] | null>(null);
  const [searching, setSearching] = useState(false);
  const suggested = useApi<Found[]>('/users/suggested');

  useEffect(() => {
    const term = q.trim();
    if (!term) return setResults(null);
    setSearching(true);
    const t = setTimeout(() => {
      api<Found[]>(`/users/search?q=${encodeURIComponent(term)}`)
        .then(setResults)
        .catch((e) => toast(errMsg(e), 'error-outline'))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [q, toast]);

  const setRel = (id: string, relation: Relation) => {
    setResults((r) => r?.map((u) => (u.id === id ? { ...u, relation } : u)) ?? r);
    suggested.setData((r) => r?.map((u) => (u.id === id ? { ...u, relation } : u)) ?? r);
  };
  const add = async (u: Found) => {
    try {
      const r = await api<{ relation: Relation }>('/friends/requests', { body: { userId: u.id } });
      setRel(u.id, r.relation);
      toast(r.relation === 'friends' ? `${u.username} is now your friend` : `Friend request sent to ${u.username}`, 'send');
    } catch (e) {
      toast(errMsg(e), 'error-outline');
    }
  };
  const cancel = async (u: Found) => {
    await api(`/friends/requests/${u.id}/cancel`, { method: 'POST' }).catch(() => null);
    setRel(u.id, 'none');
    toast('Request cancelled', 'close');
  };

  const row = (u: Found) => (
    <ListRow key={u.id}>
      <Avatar user={u} size={40} />
      <View style={{ flex: 1 }}>
        <T style={{ fontWeight: '600' }}>{u.username}</T>
        <T v="small" c="text3">
          {u.tier}
        </T>
      </View>
      {u.relation === 'friends' ? (
        <Chip label="Friends" tone="legit" icon="check" />
      ) : u.relation === 'outgoing' ? (
        <Button title="Requested" icon="schedule" kind="soft" size="sm" onPress={() => cancel(u)} />
      ) : u.relation === 'incoming' ? (
        <Button title="Accept" size="sm" onPress={() => add(u)} />
      ) : (
        <Button title="Add" icon="person-add" size="sm" onPress={() => add(u)} />
      )}
    </ListRow>
  );

  return (
    <Screen>
      <Button title="Friends" icon="arrow-back" kind="ghost" size="sm" style={{ alignSelf: 'flex-start', marginLeft: -10 }} onPress={() => router.back()} />
      <T v="h1" style={{ marginTop: 8 }}>
        Add a friend
      </T>
      <T c="text2">Search by their username.</T>
      <Gap h={16} />
      <RowV style={{ height: 46, borderRadius: 12, borderWidth: 1, borderColor: c.line, paddingHorizontal: 12 }}>
        <Icon name="search" color={c.text3} />
        <TextInput value={q} onChangeText={setQ} placeholder="Username" placeholderTextColor={c.text3} autoCapitalize="none" autoCorrect={false} style={{ flex: 1, color: c.text, fontSize: 16 }} accessibilityLabel="Search players" autoFocus />
      </RowV>
      <Gap h={8} />
      {q.trim() ? (
        searching && !results ? (
          <Skeleton header={false} rows={3} />
        ) : results?.length ? (
          results.map(row)
        ) : (
          <EmptyState
            icon="person-search"
            title="No players found"
            body={`Nobody is called "${q.trim()}". Check the spelling, or send your invite link instead.`}
            actions={
              <Button
                title="Copy invite link"
                icon="link"
                kind="outline"
                onPress={async () => {
                  await Clipboard.setStringAsync(`scamscout://add/${me?.username ?? ''}`);
                  toast('Invite link copied', 'content-copy');
                }}
              />
            }
          />
        )
      ) : (
        <>
          <Section title="Suggested for you" />
          {suggested.loading ? <Skeleton header={false} rows={3} /> : suggested.data?.length ? suggested.data.map(row) : <EmptyState dashed icon="diversity-3" title="No suggestions yet" body="Play a few games and we'll suggest players near your level. You can still search by username above." />}
        </>
      )}
    </Screen>
  );
}
