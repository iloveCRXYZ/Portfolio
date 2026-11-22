import { useMemo, useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';
import { Screen, T, Gap, Button, Segmented, StatStrip, ListRow, EmptyState, ErrorState, Skeleton, Section, fmt } from '@/components/ui';
import { useApi } from '@/lib/useApi';
import { useColors } from '@/lib/theme';

type Point = { matchId: string; at: number; elo: number; delta: number; outcome: string; opponent: string };
type History = { placements: number; placementsNeeded: number; current: number | null; points: Point[] };

function Chart({ points }: { points: Point[] }) {
  const c = useColors();
  const { width } = useWindowDimensions();
  const W = Math.min(width - 32, 720);
  const H = 220;
  const L = 44, R = 12, Tp = 18, B = 26;
  const vals = points.map((p) => p.elo);
  const lo = Math.floor((Math.min(...vals) - 10) / 50) * 50;
  const hi = Math.ceil((Math.max(...vals) + 10) / 50) * 50;
  const step = hi - lo > 300 ? 100 : 50;
  const X = (i: number) => L + (points.length === 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (points.length - 1));
  const Y = (v: number) => Tp + ((hi - v) / (hi - lo || 1)) * (H - Tp - B);
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(p.elo).toFixed(1)}`).join(' ');
  const area = `${line} L${X(points.length - 1)} ${H - B} L${X(0)} ${H - B} Z`;
  const ticks: number[] = [];
  for (let v = lo; v <= hi; v += step) ticks.push(v);
  const peak = vals.indexOf(Math.max(...vals));
  const last = points.length - 1;
  return (
    <View style={{ backgroundColor: c.surface, borderRadius: 16, paddingVertical: 8, alignItems: 'center' }} accessibilityLabel={`ELO chart from ${vals[0]} to ${vals[last]}`}>
      <Svg width={W} height={H}>
        <Defs>
          <LinearGradient id="g" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={c.ink} stopOpacity={0.14} />
            <Stop offset="1" stopColor={c.ink} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        {ticks.map((v) => (
          <G key={v}>
            <Line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke={c.line} strokeWidth={1} />
            <SvgText x={L - 6} y={Y(v) + 4} fontSize={10} fill={c.text3} textAnchor="end">
              {fmt(v)}
            </SvgText>
          </G>
        ))}
        <Path d={area} fill="url(#g)" />
        <Path d={line} fill="none" stroke={c.ink} strokeWidth={2.4} strokeLinejoin="round" strokeLinecap="round" />
        <Circle cx={X(peak)} cy={Y(vals[peak])} r={4} fill={c.surface} stroke={c.ink} strokeWidth={2} />
        <Circle cx={X(last)} cy={Y(vals[last])} r={6} fill={c.ink} stroke={c.surface} strokeWidth={3} />
        <SvgText x={L} y={H - 6} fontSize={10} fill={c.text3}>
          {new Date(points[0].at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </SvgText>
        <SvgText x={W - R} y={H - 6} fontSize={10} fill={c.text3} textAnchor="end">
          Latest
        </SvgText>
      </Svg>
    </View>
  );
}

export default function EloScreen() {
  const { data, error, loading, refreshing, reload } = useApi<History>('/me/elo-history');
  const [range, setRange] = useState<'10' | '30' | 'all'>('30');
  const pts = useMemo(() => {
    const all = data?.points ?? [];
    return range === 'all' ? all : all.slice(-Number(range));
  }, [data, range]);

  return (
    <Screen refreshing={refreshing} onRefresh={reload}>
      <Button title="Profile" icon="arrow-back" kind="ghost" size="sm" style={{ alignSelf: 'flex-start', marginLeft: -10 }} onPress={() => router.back()} />
      <T v="h1" style={{ marginTop: 8 }}>
        ELO history
      </T>
      {loading ? (
        <Skeleton />
      ) : error || !data ? (
        <ErrorState error={error} onRetry={reload} />
      ) : data.current == null || data.points.length < 2 ? (
        <>
          <T c="text2" style={{ marginTop: 4 }}>
            Unranked · {data.placements} of {data.placementsNeeded} placement matches
          </T>
          <Gap h={20} />
          <EmptyState dashed icon="show-chart" title="No rating yet" body={`Finish ${data.placementsNeeded - data.placements} more ranked placement matches. Your starting ELO and this chart appear after the last one.`} actions={<Button title="Play ranked" icon="military-tech" onPress={() => router.push('/matchmaking')} />} />
        </>
      ) : (
        <>
          <T c="text2" style={{ marginTop: 4 }}>
            {data.points.length} ranked matches
          </T>
          <StatStrip
            items={[
              { label: 'Current', value: fmt(data.current) },
              { label: 'Change', value: `${pts[pts.length - 1].elo - pts[0].elo >= 0 ? '+' : ''}${pts[pts.length - 1].elo - pts[0].elo}` },
              { label: 'Peak', value: fmt(Math.max(...pts.map((p) => p.elo))) },
            ]}
          />
          <Segmented options={[{ key: '10', label: 'Last 10' }, { key: '30', label: 'Last 30' }, { key: 'all', label: 'All time' }]} value={range} onChange={setRange} />
          <Gap h={12} />
          <Chart points={pts} />
          <Section title="Recent ranked matches" />
          {[...data.points].reverse().slice(0, 10).map((p) => (
            <ListRow key={p.matchId}>
              <T style={{ flex: 1 }}>vs {p.opponent}</T>
              <T c={p.outcome === 'win' ? 'legit' : p.outcome === 'loss' ? 'scam' : 'text2'} style={{ width: 52 }}>
                {p.outcome === 'win' ? 'Won' : p.outcome === 'loss' ? 'Lost' : 'Draw'}
              </T>
              <T v="mono" c={p.delta > 0 ? 'legit' : p.delta < 0 ? 'scam' : 'text2'} style={{ width: 44, textAlign: 'right' }}>
                {p.delta > 0 ? '+' : ''}
                {p.delta}
              </T>
              <T v="mono" c="text2" style={{ width: 54, textAlign: 'right' }}>
                {fmt(p.elo)}
              </T>
            </ListRow>
          ))}
        </>
      )}
    </Screen>
  );
}
