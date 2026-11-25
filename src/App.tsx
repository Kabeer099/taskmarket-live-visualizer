import { useEffect, useMemo, useState } from 'react';
import CapitalFlowSankey from './components/CapitalFlowSankey';
import HeatmapPanel from './components/HeatmapPanel';
import SwarmHeatCanvas from './components/SwarmHeatCanvas';
import TimeSeriesChart from './components/TimeSeriesChart';
import { downloadBrandShareCard } from './lib/shareCard';
import type {
  ChainFilter,
  MarketSnapshotResponse,
  TimeBucket,
  TimeRange,
  ViewTab,
} from './types';

function readInitialParams(): {
  view: ViewTab;
  chain: ChainFilter;
  range: TimeRange;
  bucket: TimeBucket;
} {
  const qs = new URLSearchParams(window.location.search);
  const v = qs.get('view') as ViewTab | null;
  const c = qs.get('chain') as ChainFilter | null;
  const r = qs.get('range') as TimeRange | null;
  const b = qs.get('bucket') as TimeBucket | null;
  const validViews: ViewTab[] = ['swarm', 'flow', 'series', 'insights', 'heatmap', 'feed'];
  const validChains: ChainFilter[] = ['all', '4217', '8453'];
  const validRanges: TimeRange[] = ['7d', '30d', '90d', 'all'];
  const validBuckets: TimeBucket[] = ['day', 'week'];
  return {
    view: v && validViews.includes(v) ? v : 'swarm',
    chain: c && validChains.includes(c) ? c : 'all',
    range: r && validRanges.includes(r) ? r : '30d',
    bucket: b && validBuckets.includes(b) ? b : 'day',
  };
}

export default function App() {
  const init = useMemo(() => readInitialParams(), []);
  const [view, setView] = useState<ViewTab>(init.view);
  const [chain, setChain] = useState<ChainFilter>(init.chain);
  const [range, setRange] = useState<TimeRange>(init.range);
  const [bucket, setBucket] = useState<TimeBucket>(init.bucket);

  const [snapshot, setSnapshot] = useState<MarketSnapshotResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [showAllViews, setShowAllViews] = useState<boolean>(true);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set('view', view);
    params.set('chain', chain);
    params.set('range', range);
    params.set('bucket', bucket);
    const nextUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, '', nextUrl);
  }, [view, chain, range, bucket]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetch(`/api/market?range=${range}&bucket=${bucket}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Server cache endpoint returned HTTP ${res.status}`);
        return res.json() as Promise<MarketSnapshotResponse>;
      })
      .then((data) => {
        if (!active) return;
        setSnapshot(data);
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [range, bucket]);

  const activeInsights = useMemo(() => {
    if (!snapshot) return null;
    if (chain === '4217') return snapshot.insights.tempo;
    if (chain === '8453') return snapshot.insights.base;
    return snapshot.insights.all;
  }, [snapshot, chain]);

  const activeFeed = useMemo(() => {
    if (!snapshot) return [];
    if (chain === '4217') return snapshot.activityFeed.tempo;
    if (chain === '8453') return snapshot.activityFeed.base;
    return snapshot.activityFeed.merged;
  }, [snapshot, chain]);

  function handleCopyDeepLink() {
    void navigator.clipboard?.writeText(window.location.href).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 1800);
    });
  }

  function handleExportCard(targetView: ViewTab) {
    if (!snapshot || !activeInsights) return;
    void downloadBrandShareCard(snapshot, activeInsights, targetView);
  }

  const latestWeekPosters = snapshot?.weeklyPosters[snapshot.weeklyPosters.length - 1];

  return (
    <div className="shell">
      {/* Brand Kit Header */}
      <header className="top-header">
        <div className="lockup-wrap">
          <img
            src="/brand/taskmarket-lockup.png"
            alt="Taskmarket"
            className="lockup-img"
            width={166}
            height={30}
          />
          <span className="tag-badge mono">
            <span className="live-dot" />
            {snapshot
              ? `Data as of ${snapshot.asOf.slice(0, 19).replace('T', ' ')} UTC`
              : 'Loading server cache…'}
          </span>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <span className="mono" style={{ fontSize: '0.82rem', color: '#B0A79D' }}>
            taskmarket.dev
          </span>
          <button type="button" className="action-btn" onClick={handleCopyDeepLink}>
            {copiedLink ? 'View Link Copied' : 'Copy View Link'}
          </button>
          <button
            type="button"
            className="action-btn action-btn-salmon"
            onClick={() => handleExportCard(view)}
            disabled={!snapshot}
          >
            Share Card (.png)
          </button>
        </div>
      </header>

      {/* Hero Headline (Brand Kit: Instrument Serif + ONE italic magenta word) */}
      <section className="hero-row">
        <div>
          <h1 className="hero-h1 serif">
            Live market observatory for <em>agents.</em>
          </h1>
          <p className="hero-sub">
            Read-only, server-cached view of Taskmarket across Tempo (OUSD) and Base (USDC): agents
            converging on open tasks, escrow capital flow, distinct weekly posters, and raw API
            verifiability.
          </p>
        </div>

        <div className="segmented" aria-label="Chain Filter">
          <button
            type="button"
            className={`seg-btn ${chain === 'all' ? 'active' : ''}`}
            onClick={() => setChain('all')}
          >
            Both Chains
          </button>
          <button
            type="button"
            className={`seg-btn ${chain === '4217' ? 'active-accent' : ''}`}
            onClick={() => setChain('4217')}
          >
            Tempo · OUSD (4217)
          </button>
          <button
            type="button"
            className={`seg-btn ${chain === '8453' ? 'active-accent' : ''}`}
            onClick={() => setChain('8453')}
          >
            Base · USDC (8453)
          </button>
        </div>
      </section>

      {/* View Switcher / Deep-Link Navigation */}
      <nav className="controls-bar" aria-label="Visualizer Views">
        <div className="segmented">
          {(
            [
              ['swarm', 'Swarm Heat-Grid'],
              ['flow', 'Capital Flow'],
              ['series', 'Time Series & Posters'],
              ['insights', 'Market Insights'],
              ['heatmap', 'Activity Heatmap'],
              ['feed', 'Live Feed'],
            ] as Array<[ViewTab, string]>
          ).map(([tabKey, label]) => (
            <button
              key={tabKey}
              type="button"
              className={`seg-btn ${view === tabKey ? 'active' : ''}`}
              onClick={() => {
                setView(tabKey);
                setShowAllViews(false);
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="action-btn"
          onClick={() => setShowAllViews((v) => !v)}
        >
          {showAllViews ? 'Focus Active View Only' : 'Show Full Dashboard'}
        </button>
      </nav>

      {error && (
        <div className="panel" style={{ borderColor: '#E74079' }}>
          <strong style={{ color: '#E74079' }}>Unable to load market snapshot:</strong> {error}
        </div>
      )}

      {!snapshot && loading && (
        <div className="panel">
          <div className="mono" style={{ color: '#B0A79D' }}>
            Fetching server-cached snapshot across Tempo (4217) and Base (8453)…
          </div>
        </div>
      )}

      {snapshot && activeInsights && (
        <>
          {/* Headline KPI Strip — Exact Verbatim Numbers from /api/market/stats */}
          <section className="kpi-strip" aria-label="Headline Numbers">
            <div className="kpi-card">
              <div className="kpi-label">Active Agents (7d)</div>
              <div className="kpi-value mono">{snapshot.headlines.tempo.activeAgents7d.toLocaleString()}</div>
              <div className="kpi-sub">
                {snapshot.headlines.tempo.activeWorkers7d.toLocaleString()} total active workers
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-label">Open Tasks Now</div>
              <div className="kpi-value mono" style={{ color: '#E74079' }}>
                {snapshot.headlines.tempo.openTasks.toLocaleString()}
              </div>
              <div className="kpi-sub">
                ${activeInsights.openEscrowUsd.toFixed(0)} open ({activeInsights.tokenSymbol})
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-label">Paid Workers</div>
              <div className="kpi-value mono">
                {chain === '4217'
                  ? snapshot.headlines.tempo.paidWorkers.toLocaleString()
                  : chain === '8453'
                    ? snapshot.headlines.base.paidWorkers.toLocaleString()
                    : `${snapshot.headlines.tempo.paidWorkers} / ${snapshot.headlines.base.paidWorkers}`}
              </div>
              <div className="kpi-sub">
                {chain === 'all' ? 'Tempo (OUSD) / Base (USDC)' : activeInsights.label}
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-label">Active Wallets</div>
              <div className="kpi-value mono">
                {chain === '4217'
                  ? snapshot.headlines.tempo.activeWallets.toLocaleString()
                  : chain === '8453'
                    ? snapshot.headlines.base.activeWallets.toLocaleString()
                    : `${snapshot.headlines.tempo.activeWallets.toLocaleString()} / ${snapshot.headlines.base.activeWallets.toLocaleString()}`}
              </div>
              <div className="kpi-sub">
                {snapshot.headlines.tempo.registeredWorkers.toLocaleString()} registered globally
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-label">Distinct Posters (Latest Wk)</div>
              <div className="kpi-value mono">
                {latestWeekPosters
                  ? chain === '4217'
                    ? latestWeekPosters.distinctPostersTempo
                    : chain === '8453'
                      ? latestWeekPosters.distinctPostersBase
                      : latestWeekPosters.distinctPostersAll
                  : 0}
              </div>
              <div className="kpi-sub">
                {activeInsights.uniquePosters} unique posters all-time
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-label">Escrowed Volume</div>
              <div className="kpi-value mono">
                ${activeInsights.totalEscrowedUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <div className="kpi-sub">
                {activeInsights.completionRatePct}% settled · {activeInsights.totalPublicTasks} tasks
              </div>
            </div>
          </section>

          {/* 1. Signature Hero: Live Swarm Heat-Grid */}
          {(showAllViews || view === 'swarm') && (
            <SwarmHeatCanvas
              tiles={snapshot.swarmTiles}
              chainFilter={chain}
              onExportCard={() => handleExportCard('swarm')}
            />
          )}

          {/* 2. Signature Flow: Capital Flow & Poster Concentration Sankey */}
          {(showAllViews || view === 'flow') && (
            <CapitalFlowSankey
              insights={activeInsights}
              onExportCard={() => handleExportCard('flow')}
            />
          )}

          {/* 3. Time Series (Active Agents, Tasks, Rewards Escrowed/Paid, Distinct Posters/Week) */}
          {(showAllViews || view === 'series') && (
            <TimeSeriesChart
              series={snapshot.timeSeries}
              weeklyPosters={snapshot.weeklyPosters}
              range={range}
              bucket={bucket}
              chainFilter={chain}
              loading={loading}
              onRangeChange={setRange}
              onBucketChange={setBucket}
              onExportCard={() => handleExportCard('series')}
            />
          )}

          {/* 4. Deep Insights + Tasks by Mode & Status (API Global + Per-Chain Comparison) */}
          {(showAllViews || view === 'insights') && (
            <>
              <section className="panel">
                <div className="panel-head">
                  <div>
                    <h2 className="panel-title serif">
                      What the Market <em>Reveals</em>
                    </h2>
                    <p className="panel-desc">
                      Non-obvious structural patterns computed directly from paginated public task
                      histories across Tempo (chain 4217) and Base (chain 8453).
                    </p>
                  </div>
                  <button
                    type="button"
                    className="action-btn"
                    onClick={() => handleExportCard('insights')}
                  >
                    Share Card
                  </button>
                </div>

                <div className="insight-grid">
                  <div className="insight-card">
                    <div className="kpi-label">Poster Concentration</div>
                    <div className="insight-big mono" style={{ color: '#E74079' }}>
                      {activeInsights.top5PostersSharePct}%
                    </div>
                    <div className="kpi-sub">
                      Share of all tasks posted by the Top 5 wallets (Top 1 holds{' '}
                      {activeInsights.top1PosterSharePct}% · Gini {activeInsights.posterGini}).
                    </div>
                  </div>

                  <div className="insight-card">
                    <div className="kpi-label">Task Mortality (Died Unsettled)</div>
                    <div className="insight-big mono">{activeInsights.deadRatePct}%</div>
                    <div className="kpi-sub">
                      Expired or cancelled (${activeInsights.deadTaskUsd.toFixed(0)} uncollected).
                      Tempo: {snapshot.insights.tempo.deadRatePct}% vs Base:{' '}
                      {snapshot.insights.base.deadRatePct}%.
                    </div>
                  </div>

                  <div className="insight-card">
                    <div className="kpi-label">Competition Density</div>
                    <div className="insight-big mono">{activeInsights.avgSubmissionsPerTask}</div>
                    <div className="kpi-sub">
                      Mean submissions per public task across {activeInsights.totalPublicTasks} tasks
                      (median window {activeInsights.medianExpiryHours}h).
                    </div>
                  </div>

                  <div className="insight-card">
                    <div className="kpi-label">Tempo vs Base Split</div>
                    <div className="insight-big mono">
                      {snapshot.insights.tempo.totalPublicTasks} / {snapshot.insights.base.totalPublicTasks}
                    </div>
                    <div className="kpi-sub">
                      Tempo: {snapshot.insights.tempo.uniquePosters} posters ({snapshot.insights.tempo.completionRatePct}% settled) ·
                      Base: {snapshot.insights.base.uniquePosters} posters ({snapshot.insights.base.completionRatePct}% settled).
                    </div>
                  </div>
                </div>

                {/* Top Poster Concentration Table (Anonymized Wallet Prefixes Only — Zero Guessed Names!) */}
                <div className="two-col">
                  <div className="methods-box">
                    <div className="kpi-label" style={{ marginBottom: 10 }}>
                      Top Poster Concentration ({activeInsights.label} · Wallet Prefix Only)
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {activeInsights.topPosters.map((p, idx) => (
                        <div key={p.shortWallet} className="bar-row">
                          <span className="mono" style={{ color: '#EFE9E2', fontSize: '0.76rem' }}>
                            #{idx + 1} {p.shortWallet}
                          </span>
                          <div className="bar-track">
                            <div
                              className={`bar-fill ${idx === 0 ? 'bar-fill-hot' : ''}`}
                              style={{ width: `${Math.min(100, p.sharePct)}%` }}
                            />
                          </div>
                          <span className="mono" style={{ textAlign: 'right', fontSize: '0.75rem' }}>
                            {p.tasks} ({p.sharePct}%)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="methods-box">
                    <div className="kpi-label" style={{ marginBottom: 10 }}>
                      Distinct Task Posters Per Week (Last 8 Weeks)
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {snapshot.weeklyPosters.slice(-8).map((w) => {
                        const val =
                          chain === '4217'
                            ? w.distinctPostersTempo
                            : chain === '8453'
                              ? w.distinctPostersBase
                              : w.distinctPostersAll;
                        const maxW = Math.max(
                          1,
                          ...snapshot.weeklyPosters
                            .slice(-8)
                            .map((x) =>
                              chain === '4217'
                                ? x.distinctPostersTempo
                                : chain === '8453'
                                  ? x.distinctPostersBase
                                  : x.distinctPostersAll
                            )
                        );
                        return (
                          <div key={w.weekStart} className="bar-row">
                            <span className="mono" style={{ color: '#EFE9E2', fontSize: '0.76rem' }}>
                              Wk {w.weekStart}
                            </span>
                            <div className="bar-track">
                              <div
                                className="bar-fill bar-fill-hot"
                                style={{ width: `${(val / maxW) * 100}%` }}
                              />
                            </div>
                            <span className="mono" style={{ textAlign: 'right', fontSize: '0.75rem' }}>
                              {val} posters
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </section>

              {/* Tasks by Status & Mode (Verbatim /api/stats/breakdowns + Per-Chain Breakdown) */}
              <div className="two-col">
                <section className="panel">
                  <div className="panel-head">
                    <div>
                      <h3 className="panel-title serif">
                        Tasks by <em>Status</em>
                      </h3>
                      <p className="panel-desc">
                        {chain === 'all'
                          ? 'Verbatim totals from /api/stats/breakdowns (includes all indexed tasks).'
                          : `Per-chain public task statuses for ${activeInsights.label}.`}
                      </p>
                    </div>
                  </div>
                  {(chain === 'all'
                    ? snapshot.apiBreakdowns.status.map((s) => ({ status: s.status, count: s.count }))
                    : activeInsights.statusBreakdown
                  )
                    .sort((a, b) => b.count - a.count)
                    .map((row) => {
                      const total =
                        chain === 'all'
                          ? snapshot.apiBreakdowns.status.reduce((a, b) => a + b.count, 0)
                          : activeInsights.totalPublicTasks;
                      const pct = total > 0 ? (row.count / total) * 100 : 0;
                      return (
                        <div key={row.status} className="bar-row">
                          <span className="mono" style={{ fontSize: '0.76rem' }}>
                            {row.status}
                          </span>
                          <div className="bar-track">
                            <div
                              className={`bar-fill ${row.status === 'open' ? 'bar-fill-hot' : ''}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="mono" style={{ textAlign: 'right', fontSize: '0.76rem' }}>
                            {row.count} ({pct.toFixed(0)}%)
                          </span>
                        </div>
                      );
                    })}
                </section>

                <section className="panel">
                  <div className="panel-head">
                    <div>
                      <h3 className="panel-title serif">
                        Tasks by <em>Mode</em> &amp; Actor Type
                      </h3>
                      <p className="panel-desc">
                        {chain === 'all'
                          ? 'Verbatim totals from /api/stats/breakdowns.'
                          : `Per-chain public task modes for ${activeInsights.label}.`}
                      </p>
                    </div>
                  </div>
                  {(chain === 'all'
                    ? snapshot.apiBreakdowns.mode.map((m) => ({ mode: m.mode, count: m.count }))
                    : activeInsights.modeBreakdown
                  )
                    .sort((a, b) => b.count - a.count)
                    .map((row) => {
                      const total =
                        chain === 'all'
                          ? snapshot.apiBreakdowns.mode.reduce((a, b) => a + b.count, 0)
                          : activeInsights.totalPublicTasks;
                      const pct = total > 0 ? (row.count / total) * 100 : 0;
                      return (
                        <div key={row.mode} className="bar-row">
                          <span className="mono" style={{ fontSize: '0.76rem' }}>
                            {row.mode}
                          </span>
                          <div className="bar-track">
                            <div
                              className={`bar-fill ${row.mode === 'bounty' ? 'bar-fill-hot' : ''}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="mono" style={{ textAlign: 'right', fontSize: '0.76rem' }}>
                            {row.count} ({pct.toFixed(0)}%)
                          </span>
                        </div>
                      );
                    })}

                  <div
                    style={{
                      marginTop: 6,
                      paddingTop: 10,
                      borderTop: '1px solid #453E37',
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 10,
                      fontSize: '0.78rem',
                      color: '#B0A79D',
                    }}
                  >
                    {snapshot.apiBreakdowns.actorType.map((a) => (
                      <span key={a.actorType} className="chip mono">
                        {a.actorType}: {a.count.toLocaleString()}
                      </span>
                    ))}
                  </div>
                </section>
              </div>
            </>
          )}

          {/* 5. Activity Heatmap */}
          {(showAllViews || view === 'heatmap') && (
            <HeatmapPanel
              hourOfWeek={snapshot.heatmaps.hourOfWeek}
              byMode={snapshot.heatmaps.mode}
              onExportCard={() => handleExportCard('heatmap')}
            />
          )}

          {/* 6. Live Activity Feed */}
          {(showAllViews || view === 'feed') && (
            <section className="panel">
              <div className="panel-head">
                <div>
                  <h2 className="panel-title serif">
                    Live Activity <em>Feed</em>
                  </h2>
                  <p className="panel-desc">
                    Recent submissions, task creations, and payouts across Tempo (4217) and Base
                    (8453). Wallets are displayed strictly as truncated addresses with no guessed
                    identities.
                  </p>
                </div>
                <button
                  type="button"
                  className="action-btn"
                  onClick={() => handleExportCard('feed')}
                >
                  Share Card
                </button>
              </div>

              <div className="feed-list">
                {activeFeed.slice(0, 18).map((item, idx) => (
                  <div key={`${item.taskId}-${item.timestamp}-${idx}`} className="feed-row">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 7 }}>
                        <span
                          className={`chip mono ${
                            item.type.includes('paid') || item.type.includes('award')
                              ? 'chip-hot'
                              : 'chip-salmon'
                          }`}
                        >
                          {item.type}
                        </span>
                        <span className="chip mono">
                          {item.chainId === 4217 ? 'Tempo' : 'Base'}
                        </span>
                        <span className="mono" style={{ fontSize: '0.76rem', color: '#B0A79D' }}>
                          {item.actor}
                          {item.actorAgentId ? ` · agent #${item.actorAgentId}` : ''}
                        </span>
                      </div>
                      <a
                        href={`https://taskmarket.dev/tasks/${item.taskId}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: '#EFE9E2', fontSize: '0.86rem' }}
                      >
                        {item.taskTitle}
                      </a>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      {item.amount && (
                        <div className="mono" style={{ color: '#FFF6E8', fontSize: '0.86rem' }}>
                          ${(Number(item.amount) / 1e6).toFixed(2)}{' '}
                          {item.chainId === 4217 ? 'OUSD' : 'USDC'}
                        </div>
                      )}
                      <div className="mono" style={{ fontSize: '0.72rem', color: '#B0A79D' }}>
                        {item.timestamp.slice(0, 19).replace('T', ' ')} UTC
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Transparent Methods Note & Exact Upstream Endpoints */}
          <section className="methods-box">
            <strong style={{ color: '#FFF6E8' }}>Methods &amp; Data Reproducibility:</strong> All
            data is fetched server-side from <code>https://api.taskmarket.dev</code> via{' '}
            <code>/api/market</code> and cached at the edge (<code>s-maxage=300</code>,{' '}
            <code>stale-while-revalidate=3300</code> — refreshed every 5 minutes, cached ≥ 60s). No
            browser request calls the upstream API directly, no personal analytics are collected,
            and no guessed names are attached to wallets. Headline numbers, breakdowns, time series,
            heatmaps, and activity feed reproduce upstream JSON verbatim; weekly distinct posters,
            poster concentration, and per-chain splits are computed deterministically from paginated{' '}
            <code>/api/tasks</code> across Tempo (4217) and Base (8453).
            <div className="mono" style={{ marginTop: 8, fontSize: '0.7rem', color: '#B0A79D' }}>
              Endpoints: {snapshot.endpointsUsed.join(' · ')}
            </div>
          </section>
        </>
      )}

      {/* Mandatory Non-Official Bounty Footer */}
      <footer className="site-footer">
        <div>
          Made for a paid Taskmarket bounty (<code>TSK-BRK611AN</code>). This dashboard is an
          independent read-only visualizer and is <strong>not</strong> an official Taskmarket
          product.
        </div>
        <div className="mono">
          MIT License · Read-Only · Zero Tracking · <a href="https://taskmarket.dev">taskmarket.dev</a>
        </div>
      </footer>
    </div>
  );
}
