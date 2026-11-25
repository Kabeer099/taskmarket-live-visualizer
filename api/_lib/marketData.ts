import type {
  ActivityFeedItem,
  ChainComputedInsights,
  HeatmapData,
  MarketSnapshotResponse,
  MarketStatsHeadline,
  PlatformTimePoint,
  SwarmTaskTile,
  TimeBucket,
  TimeRange,
  WeeklyPosterPoint,
} from '../../src/types';

const API_BASE = 'https://api.taskmarket.dev';
const CACHE_TTL_MS = 300_000; // 5 minutes server-side TTL (refreshed well above hourly minimum, >= 60s cache)

interface RawTask {
  id: string;
  chainId: number;
  referenceCode: string;
  requester: string;
  description: string;
  reward: string;
  createdAt: string;
  expiryTime: string | null;
  status: string;
  mode: string;
  submissionCount: number;
  awardCount: number;
}

interface CacheEntry {
  expiresAt: number;
  data: MarketSnapshotResponse;
}

const memCache = new Map<string, CacheEntry>();

export function shortenWallet(addr: string | null | undefined): string {
  if (!addr || addr.length < 10) return '0x0000…0000';
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function isoWeekStartUtc(isoDate: string): string {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return 'unknown';
  const day = d.getUTCDay(); // 0 = Sun, 1 = Mon, ...
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + diffToMonday));
  return monday.toISOString().slice(0, 10);
}

export function computeGini(values: number[]): number {
  const positive = values.filter((v) => v > 0).sort((a, b) => a - b);
  const n = positive.length;
  if (n <= 1) return 0;
  const sum = positive.reduce((a, b) => a + b, 0);
  if (sum === 0) return 0;
  let weightedSum = 0;
  for (let i = 0; i < n; i++) {
    weightedSum += (2 * (i + 1) - n - 1) * positive[i];
  }
  return Number((weightedSum / (n * sum)).toFixed(3));
}

async function fetchJson<T>(path: string, timeoutMs = 15000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json', 'User-Agent': 'taskmarket-live-visualizer/1.0' },
    });
    if (!res.ok) {
      throw new Error(`Taskmarket API ${path} returned HTTP ${res.status}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchAllTasksForChain(chainId: number, maxPages = 20): Promise<RawTask[]> {
  const all: RawTask[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < maxPages; page++) {
    const qs: string = `/api/tasks?chainId=${chainId}&sort=newest&limit=100${
      cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''
    }`;
    const payload: { tasks?: RawTask[]; nextCursor?: string | null } = await fetchJson(qs);
    const items = payload.tasks || [];
    all.push(...items);
    cursor = payload.nextCursor ?? null;
    if (!cursor || items.length < 100) break;
  }
  return all;
}

export function computeWeeklyPosters(tempoTasks: RawTask[], baseTasks: RawTask[]): WeeklyPosterPoint[] {
  const weekMap = new Map<
    string,
    { all: Set<string>; tempo: Set<string>; base: Set<string>; tAll: number; tTempo: number; tBase: number }
  >();

  const touch = (week: string) => {
    let entry = weekMap.get(week);
    if (!entry) {
      entry = {
        all: new Set(),
        tempo: new Set(),
        base: new Set(),
        tAll: 0,
        tTempo: 0,
        tBase: 0,
      };
      weekMap.set(week, entry);
    }
    return entry;
  };

  for (const t of tempoTasks) {
    const w = isoWeekStartUtc(t.createdAt);
    if (w === 'unknown') continue;
    const rec = touch(w);
    const poster = (t.requester || '').toLowerCase();
    if (poster) {
      rec.all.add(poster);
      rec.tempo.add(poster);
    }
    rec.tAll++;
    rec.tTempo++;
  }

  for (const t of baseTasks) {
    const w = isoWeekStartUtc(t.createdAt);
    if (w === 'unknown') continue;
    const rec = touch(w);
    const poster = (t.requester || '').toLowerCase();
    if (poster) {
      rec.all.add(poster);
      rec.base.add(poster);
    }
    rec.tAll++;
    rec.tBase++;
  }

  return Array.from(weekMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([weekStart, rec]) => ({
      weekStart,
      distinctPostersAll: rec.all.size,
      distinctPostersTempo: rec.tempo.size,
      distinctPostersBase: rec.base.size,
      tasksAll: rec.tAll,
      tasksTempo: rec.tTempo,
      tasksBase: rec.tBase,
    }));
}

export function computeChainInsights(
  chainId: number | 'all',
  label: string,
  tokenSymbol: string,
  tasks: RawTask[]
): ChainComputedInsights {
  const totalPublicTasks = tasks.length;
  const posterMap = new Map<string, { tasks: number; usd: number }>();
  const statusMap = new Map<string, { count: number; usd: number }>();
  const modeMap = new Map<string, { count: number; usd: number }>();

  let totalEscrowedUsd = 0;
  let openEscrowUsd = 0;
  let completedUsd = 0;
  let deadTaskUsd = 0;
  let totalSubs = 0;
  const expiryHoursList: number[] = [];

  for (const t of tasks) {
    const usd = Number(t.reward || 0) / 1e6;
    totalEscrowedUsd += usd;
    totalSubs += Number(t.submissionCount || 0);

    if (t.status === 'open' || t.status === 'claimed' || t.status === 'pending_approval') {
      openEscrowUsd += usd;
    } else if (t.status === 'completed') {
      completedUsd += usd;
    } else if (t.status === 'expired' || t.status === 'cancelled') {
      deadTaskUsd += usd;
    }

    if (t.createdAt && t.expiryTime) {
      const hrs = (new Date(t.expiryTime).getTime() - new Date(t.createdAt).getTime()) / 3_600_000;
      if (hrs > 0 && hrs < 5000) expiryHoursList.push(hrs);
    }

    const poster = (t.requester || '').toLowerCase();
    if (poster) {
      const p = posterMap.get(poster) || { tasks: 0, usd: 0 };
      p.tasks += 1;
      p.usd += usd;
      posterMap.set(poster, p);
    }

    const st = statusMap.get(t.status) || { count: 0, usd: 0 };
    st.count += 1;
    st.usd += usd;
    statusMap.set(t.status, st);

    const md = modeMap.get(t.mode) || { count: 0, usd: 0 };
    md.count += 1;
    md.usd += usd;
    modeMap.set(t.mode, md);
  }

  const rankedPosters = Array.from(posterMap.entries()).sort((a, b) => b[1].tasks - a[1].tasks);
  const rankIndex = new Map<string, number>();
  rankedPosters.forEach(([addr], idx) => rankIndex.set(addr, idx));

  const sumTop = (k: number) =>
    rankedPosters.slice(0, k).reduce((acc, [, v]) => acc + v.tasks, 0);

  const completedCount = statusMap.get('completed')?.count || 0;
  const deadCount =
    (statusMap.get('expired')?.count || 0) + (statusMap.get('cancelled')?.count || 0);

  expiryHoursList.sort((a, b) => a - b);
  const medianExpiryHours =
    expiryHoursList.length > 0
      ? Number(expiryHoursList[Math.floor(expiryHoursList.length / 2)].toFixed(1))
      : 0;

  // Build Capital Flow Sankey links: Poster Cohort -> Task Mode -> Market Outcome
  const c2m = new Map<string, { source: string; target: string; tasks: number; usd: number }>();
  const m2o = new Map<string, { source: string; target: string; tasks: number; usd: number }>();

  for (const t of tasks) {
    const usd = Number(t.reward || 0) / 1e6;
    const poster = (t.requester || '').toLowerCase();
    const rIdx = rankIndex.get(poster) ?? 999;
    const cohort =
      rIdx === 0
        ? 'Top 1 Poster'
        : rIdx < 5
          ? 'Posters #2–#5'
          : rIdx < 20
            ? 'Posters #6–#20'
            : 'Long Tail (#21+)';

    const modeName = t.mode || 'bounty';
    const outcome =
      t.status === 'completed'
        ? 'Completed'
        : t.status === 'expired' || t.status === 'cancelled'
          ? 'Expired / Cancelled'
          : 'Active / Open';

    const k1 = `${cohort}__${modeName}`;
    const e1 = c2m.get(k1) || { source: cohort, target: modeName, tasks: 0, usd: 0 };
    e1.tasks += 1;
    e1.usd += usd;
    c2m.set(k1, e1);

    const k2 = `${modeName}__${outcome}`;
    const e2 = m2o.get(k2) || { source: modeName, target: outcome, tasks: 0, usd: 0 };
    e2.tasks += 1;
    e2.usd += usd;
    m2o.set(k2, e2);
  }

  return {
    chainId,
    label,
    tokenSymbol,
    totalPublicTasks,
    uniquePosters: rankedPosters.length,
    totalEscrowedUsd: Number(totalEscrowedUsd.toFixed(2)),
    openEscrowUsd: Number(openEscrowUsd.toFixed(2)),
    completedUsd: Number(completedUsd.toFixed(2)),
    deadTaskUsd: Number(deadTaskUsd.toFixed(2)),
    completionRatePct:
      totalPublicTasks > 0 ? Number(((completedCount / totalPublicTasks) * 100).toFixed(1)) : 0,
    deadRatePct:
      totalPublicTasks > 0 ? Number(((deadCount / totalPublicTasks) * 100).toFixed(1)) : 0,
    avgSubmissionsPerTask:
      totalPublicTasks > 0 ? Number((totalSubs / totalPublicTasks).toFixed(1)) : 0,
    medianExpiryHours,
    top1PosterSharePct:
      totalPublicTasks > 0 ? Number(((sumTop(1) / totalPublicTasks) * 100).toFixed(1)) : 0,
    top5PostersSharePct:
      totalPublicTasks > 0 ? Number(((sumTop(5) / totalPublicTasks) * 100).toFixed(1)) : 0,
    top10PostersSharePct:
      totalPublicTasks > 0 ? Number(((sumTop(10) / totalPublicTasks) * 100).toFixed(1)) : 0,
    posterGini: computeGini(rankedPosters.map(([, v]) => v.tasks)),
    statusBreakdown: Array.from(statusMap.entries())
      .map(([status, v]) => ({ status, count: v.count, usd: Number(v.usd.toFixed(2)) }))
      .sort((a, b) => b.count - a.count),
    modeBreakdown: Array.from(modeMap.entries())
      .map(([mode, v]) => ({ mode, count: v.count, usd: Number(v.usd.toFixed(2)) }))
      .sort((a, b) => b.count - a.count),
    topPosters: rankedPosters.slice(0, 8).map(([addr, v]) => ({
      shortWallet: shortenWallet(addr),
      tasks: v.tasks,
      usd: Number(v.usd.toFixed(2)),
      sharePct: totalPublicTasks > 0 ? Number(((v.tasks / totalPublicTasks) * 100).toFixed(1)) : 0,
    })),
    flowLinks: {
      cohortToMode: Array.from(c2m.values()).map((x) => ({
        ...x,
        usd: Number(x.usd.toFixed(2)),
      })),
      modeToOutcome: Array.from(m2o.values()).map((x) => ({
        ...x,
        usd: Number(x.usd.toFixed(2)),
      })),
    },
  };
}

export async function buildMarketSnapshot(
  rawRange = '30d',
  rawBucket = 'day'
): Promise<MarketSnapshotResponse> {
  const validRanges: TimeRange[] = ['7d', '30d', '90d', 'all'];
  const validBuckets: TimeBucket[] = ['day', 'week'];
  const range: TimeRange = validRanges.includes(rawRange as TimeRange)
    ? (rawRange as TimeRange)
    : '30d';
  const bucket: TimeBucket = validBuckets.includes(rawBucket as TimeBucket)
    ? (rawBucket as TimeBucket)
    : 'day';

  const cacheKey = `${range}:${bucket}`;
  const cached = memCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const heatmapRange = range === '7d' ? '7d' : range === '90d' ? '90d' : range === 'all' ? 'all' : '30d';

  const [
    tempoHeadline,
    baseHeadline,
    breakdowns,
    rawSeries,
    heatmapHour,
    heatmapMode,
    feedTempo,
    feedBase,
    tempoTasks,
    baseTasks,
  ] = await Promise.all([
    fetchJson<MarketStatsHeadline>('/api/market/stats?chainId=4217'),
    fetchJson<MarketStatsHeadline>('/api/market/stats?chainId=8453'),
    fetchJson<{
      status: Array<{ status: string; count: number }>;
      mode: Array<{ mode: string; count: number }>;
      actorType: Array<{ actorType: string; count: number }>;
    }>('/api/stats/breakdowns?chainId=4217'),
    fetchJson<
      Array<{
        bucket: string;
        tasksCreated: number;
        rewardVolume: string;
        completedTasks: number;
        newAgents: number;
        activeAgents: number;
        paidVolume: string;
        settlements: number;
        ratings: number;
      }>
    >(`/api/stats/platform-time-series?chainId=4217&range=${range}&bucket=${bucket}`),
    fetchJson<HeatmapData>(
      `/api/stats/activity-heatmap?chainId=4217&range=${heatmapRange}&dimension=hourOfWeek`
    ),
    fetchJson<HeatmapData>(
      `/api/stats/activity-heatmap?chainId=4217&range=${heatmapRange}&dimension=mode`
    ),
    fetchJson<{ items: ActivityFeedItem[] }>('/api/stats/activity-feed?chainId=4217&limit=40'),
    fetchJson<{ items: ActivityFeedItem[] }>('/api/stats/activity-feed?chainId=8453&limit=40'),
    fetchAllTasksForChain(4217),
    fetchAllTasksForChain(8453),
  ]);

  const timeSeries: PlatformTimePoint[] = (rawSeries || []).map((pt) => ({
    ...pt,
    rewardUsd: Number((Number(pt.rewardVolume || 0) / 1e6).toFixed(2)),
    paidUsd: Number((Number(pt.paidVolume || 0) / 1e6).toFixed(2)),
  }));

  const sanitizeFeed = (items: ActivityFeedItem[]): ActivityFeedItem[] =>
    (items || []).map((it) => ({
      ...it,
      actor: shortenWallet(it.actor),
      taskTitle: (it.taskTitle || 'Untitled task').slice(0, 110),
    }));

  const tempoFeedClean = sanitizeFeed(feedTempo.items || []);
  const baseFeedClean = sanitizeFeed(feedBase.items || []);
  const mergedFeed = [...tempoFeedClean, ...baseFeedClean]
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 50);

  const allTasks = [...tempoTasks, ...baseTasks];
  const weeklyPosters = computeWeeklyPosters(tempoTasks, baseTasks);

  // Pick 64 freshest & highest-signal tasks across both chains for the signature Swarm Heat-Grid Canvas
  const swarmTiles: SwarmTaskTile[] = [...allTasks]
    .sort((a, b) => {
      const aOpen = a.status === 'open' ? 1 : 0;
      const bOpen = b.status === 'open' ? 1 : 0;
      if (aOpen !== bOpen) return bOpen - aOpen;
      return b.createdAt.localeCompare(a.createdAt);
    })
    .slice(0, 64)
    .map((t) => ({
      id: t.id,
      referenceCode: t.referenceCode,
      chainId: t.chainId,
      tokenSymbol: t.chainId === 4217 ? 'OUSD' : 'USDC',
      title: (t.description || '').split('\n')[0].trim().slice(0, 96) || t.referenceCode,
      status: t.status,
      mode: t.mode,
      rewardUsd: Number((Number(t.reward || 0) / 1e6).toFixed(2)),
      submissionCount: Number(t.submissionCount || 0),
      awardCount: Number(t.awardCount || 0),
      shortRequester: shortenWallet(t.requester),
      createdAt: t.createdAt,
      expiryTime: t.expiryTime,
    }));

  const snapshot: MarketSnapshotResponse = {
    asOf: new Date().toISOString(),
    range,
    bucket,
    cacheTtlSeconds: Math.round(CACHE_TTL_MS / 1000),
    endpointsUsed: [
      '/api/market/stats?chainId=4217',
      '/api/market/stats?chainId=8453',
      '/api/stats/breakdowns?chainId=4217',
      `/api/stats/platform-time-series?chainId=4217&range=${range}&bucket=${bucket}`,
      `/api/stats/activity-heatmap?chainId=4217&range=${heatmapRange}&dimension=hourOfWeek`,
      `/api/stats/activity-heatmap?chainId=4217&range=${heatmapRange}&dimension=mode`,
      '/api/stats/activity-feed?chainId=4217&limit=40',
      '/api/stats/activity-feed?chainId=8453&limit=40',
      '/api/tasks?chainId=4217&sort=newest&limit=100 (paginated)',
      '/api/tasks?chainId=8453&sort=newest&limit=100 (paginated)',
    ],
    headlines: {
      tempo: tempoHeadline,
      base: baseHeadline,
    },
    apiBreakdowns: breakdowns,
    timeSeries,
    heatmaps: {
      hourOfWeek: heatmapHour,
      mode: heatmapMode,
    },
    activityFeed: {
      tempo: tempoFeedClean,
      base: baseFeedClean,
      merged: mergedFeed,
    },
    weeklyPosters,
    insights: {
      all: computeChainInsights('all', 'Tempo + Base Combined', 'OUSD / USDC', allTasks),
      tempo: computeChainInsights(4217, 'Tempo (Chain 4217)', 'OUSD', tempoTasks),
      base: computeChainInsights(8453, 'Base (Chain 8453)', 'USDC', baseTasks),
    },
    swarmTiles,
  };

  memCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, data: snapshot });
  return snapshot;
}
