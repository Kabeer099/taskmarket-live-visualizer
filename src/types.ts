export type ChainFilter = 'all' | '4217' | '8453';
export type TimeRange = '7d' | '30d' | '90d' | 'all';
export type TimeBucket = 'day' | 'week';
export type ViewTab = 'swarm' | 'flow' | 'series' | 'insights' | 'heatmap' | 'feed';

export interface MarketStatsHeadline {
  registeredWorkers: number;
  activeWorkers7d: number;
  activeAgents7d: number;
  openTasks: number;
  paidWorkers: number;
  activeWallets: number;
}

export interface BreakdownCount {
  status?: string;
  mode?: string;
  actorType?: string;
  count: number;
}

export interface PlatformTimePoint {
  bucket: string;
  tasksCreated: number;
  rewardVolume: string;
  rewardUsd: number;
  completedTasks: number;
  newAgents: number;
  activeAgents: number;
  paidVolume: string;
  paidUsd: number;
  settlements: number;
  ratings: number;
}

export interface HeatmapData {
  rowKeys: string[];
  colKeys: string[];
  cells: Array<{ row: string; col: string; count: number; volume: string }>;
}

export interface ActivityFeedItem {
  type: string;
  timestamp: string;
  taskId: string;
  taskTitle: string;
  chainId: number;
  actor: string;
  actorType: string | null;
  actorAgentId: string | null;
  amount: string | null;
  rating: number | null;
}

export interface WeeklyPosterPoint {
  weekStart: string;
  distinctPostersAll: number;
  distinctPostersTempo: number;
  distinctPostersBase: number;
  tasksAll: number;
  tasksTempo: number;
  tasksBase: number;
}

export interface ChainComputedInsights {
  chainId: number | 'all';
  label: string;
  tokenSymbol: string;
  totalPublicTasks: number;
  uniquePosters: number;
  totalEscrowedUsd: number;
  openEscrowUsd: number;
  completedUsd: number;
  deadTaskUsd: number;
  completionRatePct: number;
  deadRatePct: number;
  avgSubmissionsPerTask: number;
  medianExpiryHours: number;
  top1PosterSharePct: number;
  top5PostersSharePct: number;
  top10PostersSharePct: number;
  posterGini: number;
  statusBreakdown: Array<{ status: string; count: number; usd: number }>;
  modeBreakdown: Array<{ mode: string; count: number; usd: number }>;
  topPosters: Array<{ shortWallet: string; tasks: number; usd: number; sharePct: number }>;
  flowLinks: {
    cohortToMode: Array<{ source: string; target: string; tasks: number; usd: number }>;
    modeToOutcome: Array<{ source: string; target: string; tasks: number; usd: number }>;
  };
}

export interface SwarmTaskTile {
  id: string;
  referenceCode: string;
  chainId: number;
  tokenSymbol: string;
  title: string;
  status: string;
  mode: string;
  rewardUsd: number;
  submissionCount: number;
  awardCount: number;
  shortRequester: string;
  createdAt: string;
  expiryTime: string | null;
}

export interface MarketSnapshotResponse {
  asOf: string;
  range: TimeRange;
  bucket: TimeBucket;
  cacheTtlSeconds: number;
  endpointsUsed: string[];
  headlines: {
    tempo: MarketStatsHeadline;
    base: MarketStatsHeadline;
  };
  apiBreakdowns: {
    status: Array<{ status: string; count: number }>;
    mode: Array<{ mode: string; count: number }>;
    actorType: Array<{ actorType: string; count: number }>;
  };
  timeSeries: PlatformTimePoint[];
  heatmaps: {
    hourOfWeek: HeatmapData;
    mode: HeatmapData;
  };
  activityFeed: {
    tempo: ActivityFeedItem[];
    base: ActivityFeedItem[];
    merged: ActivityFeedItem[];
  };
  weeklyPosters: WeeklyPosterPoint[];
  insights: {
    all: ChainComputedInsights;
    tempo: ChainComputedInsights;
    base: ChainComputedInsights;
  };
  swarmTiles: SwarmTaskTile[];
}
