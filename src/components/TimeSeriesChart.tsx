import { useState } from 'react';
import type {
  ChainFilter,
  PlatformTimePoint,
  TimeBucket,
  TimeRange,
  WeeklyPosterPoint,
} from '../types';

interface Props {
  series: PlatformTimePoint[];
  weeklyPosters: WeeklyPosterPoint[];
  range: TimeRange;
  bucket: TimeBucket;
  chainFilter: ChainFilter;
  loading: boolean;
  onRangeChange: (r: TimeRange) => void;
  onBucketChange: (b: TimeBucket) => void;
  onExportCard: () => void;
}

type ChartMetric = 'agents' | 'tasks' | 'rewards' | 'posters';

export default function TimeSeriesChart({
  series,
  weeklyPosters,
  range,
  bucket,
  chainFilter,
  loading,
  onRangeChange,
  onBucketChange,
  onExportCard,
}: Props) {
  const [metric, setMetric] = useState<ChartMetric>('rewards');
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const w = 900;
  const h = 270;
  const padL = 58;
  const padR = 20;
  const padT = 18;
  const padB = 34;
  const chartW = w - padL - padR;
  const chartH = h - padT - padB;

  const isPosterMode = metric === 'posters';
  const points = isPosterMode
    ? weeklyPosters.map((p) => ({
        label: p.weekStart,
        primary:
          chainFilter === '4217'
            ? p.distinctPostersTempo
            : chainFilter === '8453'
              ? p.distinctPostersBase
              : p.distinctPostersAll,
        secondary:
          chainFilter === '4217'
            ? p.tasksTempo
            : chainFilter === '8453'
              ? p.tasksBase
              : p.tasksAll,
      }))
    : series.map((pt) => ({
        label: pt.bucket,
        primary:
          metric === 'agents'
            ? pt.activeAgents
            : metric === 'tasks'
              ? pt.tasksCreated
              : pt.rewardUsd,
        secondary:
          metric === 'agents'
            ? pt.newAgents
            : metric === 'tasks'
              ? pt.settlements
              : pt.paidUsd,
      }));

  const maxVal = Math.max(
    1,
    ...points.map((p) => (metric === 'rewards' ? Math.max(p.primary, p.secondary) : p.primary))
  );

  const xAt = (i: number) =>
    points.length <= 1 ? padL + chartW / 2 : padL + (i / (points.length - 1)) * chartW;
  const yAt = (v: number) => padT + chartH - (v / maxVal) * chartH;

  const linePath = (vals: number[]) =>
    vals.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)} ${yAt(v).toFixed(1)}`).join(' ');

  const areaPath = (vals: number[]) => {
    if (!vals.length) return '';
    return `${linePath(vals)} L ${xAt(vals.length - 1).toFixed(1)} ${(padT + chartH).toFixed(1)} L ${xAt(0).toFixed(1)} ${(padT + chartH).toFixed(1)} Z`;
  };

  const activePoint = hoverIdx !== null && points[hoverIdx] ? points[hoverIdx] : points[points.length - 1];

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2 className="panel-title serif">
            Market Activity <em>Over Time</em>
          </h2>
          <p className="panel-desc">
            {isPosterMode
              ? 'Distinct task-posting wallets per ISO week, computed directly from full paginated Tempo + Base task histories.'
              : 'Live platform time series from /api/stats/platform-time-series with interactive range and bucket controls.'}
          </p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <div className="segmented">
            {(['7d', '30d', '90d', 'all'] as TimeRange[]).map((r) => (
              <button
                key={r}
                type="button"
                className={`seg-btn ${range === r ? 'active' : ''}`}
                onClick={() => onRangeChange(r)}
                disabled={loading}
              >
                {r.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="segmented">
            {(['day', 'week'] as TimeBucket[]).map((b) => (
              <button
                key={b}
                type="button"
                className={`seg-btn ${bucket === b ? 'active' : ''}`}
                onClick={() => onBucketChange(b)}
                disabled={loading}
              >
                {b === 'day' ? 'Daily' : 'Weekly'}
              </button>
            ))}
          </div>
          <button type="button" className="action-btn" onClick={onExportCard}>
            Share Card
          </button>
        </div>
      </div>

      <div className="segmented" style={{ alignSelf: 'flex-start' }}>
        <button
          type="button"
          className={`seg-btn ${metric === 'rewards' ? 'active-accent' : ''}`}
          onClick={() => setMetric('rewards')}
        >
          Rewards Escrowed vs Paid ($)
        </button>
        <button
          type="button"
          className={`seg-btn ${metric === 'agents' ? 'active-accent' : ''}`}
          onClick={() => setMetric('agents')}
        >
          Daily Active Agents
        </button>
        <button
          type="button"
          className={`seg-btn ${metric === 'tasks' ? 'active-accent' : ''}`}
          onClick={() => setMetric('tasks')}
        >
          Tasks Posted &amp; Settlements
        </button>
        <button
          type="button"
          className={`seg-btn ${metric === 'posters' ? 'active-accent' : ''}`}
          onClick={() => setMetric('posters')}
        >
          Distinct Posters / Week
        </button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', minWidth: 520, height: 'auto' }}>
          {/* Horizontal grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
            const y = padT + chartH * (1 - frac);
            const val = maxVal * frac;
            return (
              <g key={frac}>
                <line x1={padL} y1={y} x2={w - padR} y2={y} stroke="#453E37" strokeDasharray="3 4" />
                <text x={padL - 8} y={y + 4} textAnchor="end" fill="#B0A79D" fontSize="10" className="mono">
                  {metric === 'rewards' ? `$${Math.round(val)}` : Math.round(val)}
                </text>
              </g>
            );
          })}

          {points.length > 0 && (
            <>
              <path d={areaPath(points.map((p) => p.primary))} fill="rgba(231, 64, 121, 0.14)" />
              <path
                d={linePath(points.map((p) => p.primary))}
                fill="none"
                stroke="#E74079"
                strokeWidth="2.4"
              />
              {metric === 'rewards' && (
                <path
                  d={linePath(points.map((p) => p.secondary))}
                  fill="none"
                  stroke="#FFF6E8"
                  strokeWidth="2"
                  strokeDasharray="5 3"
                />
              )}

              {points.map((pt, idx) => {
                const showTick =
                  points.length <= 10 ||
                  idx === 0 ||
                  idx === points.length - 1 ||
                  idx % Math.ceil(points.length / 7) === 0;
                return (
                  <g key={pt.label}>
                    {showTick && (
                      <text
                        x={xAt(idx)}
                        y={h - 10}
                        textAnchor="middle"
                        fill="#B0A79D"
                        fontSize="10"
                        className="mono"
                      >
                        {pt.label.slice(5)}
                      </text>
                    )}
                    <circle
                      cx={xAt(idx)}
                      cy={yAt(pt.primary)}
                      r={hoverIdx === idx ? 5 : 2.8}
                      fill={hoverIdx === idx ? '#FFF6E8' : '#E74079'}
                    />
                    <rect
                      x={xAt(idx) - Math.max(8, chartW / Math.max(2, points.length * 2))}
                      y={padT}
                      width={Math.max(16, chartW / Math.max(1, points.length))}
                      height={chartH}
                      fill="transparent"
                      onMouseEnter={() => setHoverIdx(idx)}
                      onMouseLeave={() => setHoverIdx(null)}
                      style={{ cursor: 'crosshair' }}
                    />
                  </g>
                );
              })}
            </>
          )}
        </svg>
      </div>

      {activePoint && (
        <div
          className="mono"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            gap: 10,
            fontSize: '0.78rem',
            color: '#EFE9E2',
            padding: '9px 12px',
            borderRadius: 9,
            background: '#12100E',
            border: '1px solid #453E37',
          }}
        >
          <span>Bucket: {activePoint.label}</span>
          {metric === 'rewards' && (
            <span>
              Escrowed: <strong style={{ color: '#E74079' }}>${activePoint.primary.toFixed(2)}</strong> ·
              Paid Out: <strong style={{ color: '#FFF6E8' }}>${activePoint.secondary.toFixed(2)}</strong>
            </span>
          )}
          {metric === 'agents' && (
            <span>
              Active Agents: <strong style={{ color: '#E74079' }}>{activePoint.primary}</strong> · New
              Agents: <strong>{activePoint.secondary}</strong>
            </span>
          )}
          {metric === 'tasks' && (
            <span>
              Tasks Posted: <strong style={{ color: '#E74079' }}>{activePoint.primary}</strong> ·
              Settlements: <strong>{activePoint.secondary}</strong>
            </span>
          )}
          {metric === 'posters' && (
            <span>
              Distinct Posters: <strong style={{ color: '#E74079' }}>{activePoint.primary}</strong> ·
              Tasks Posted That Week: <strong>{activePoint.secondary}</strong>
            </span>
          )}
        </div>
      )}
    </section>
  );
}
