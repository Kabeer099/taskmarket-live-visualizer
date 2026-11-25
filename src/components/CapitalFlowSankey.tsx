import { useState } from 'react';
import type { ChainComputedInsights } from '../types';

interface Props {
  insights: ChainComputedInsights;
  onExportCard: () => void;
}

interface NodeRect {
  key: string;
  label: string;
  x: number;
  y: number;
  h: number;
  value: number;
  color: string;
}

export default function CapitalFlowSankey({ insights, onExportCard }: Props) {
  const [metric, setMetric] = useState<'tasks' | 'usd'>('usd');
  const [hovered, setHovered] = useState<string | null>(null);

  const width = 920;
  const height = 372;
  const padTop = 48;
  const usableH = height - padTop - 22;
  const nodeW = 16;

  const col1Order = ['Top 1 Poster', 'Posters #2–#5', 'Posters #6–#20', 'Long Tail (#21+)'];
  const col2Order = ['bounty', 'claim', 'pitch', 'benchmark', 'auction'];
  const col3Order = ['Completed', 'Active / Open', 'Expired / Cancelled'];

  const sumBy = (
    links: Array<{ source: string; target: string; tasks: number; usd: number }>,
    side: 'source' | 'target',
    order: string[]
  ) =>
    order
      .map((k) => ({
        key: k,
        value: links
          .filter((l) => l[side] === k)
          .reduce((acc, l) => acc + (metric === 'usd' ? l.usd : l.tasks), 0),
      }))
      .filter((n) => n.value > 0);

  const c1Raw = sumBy(insights.flowLinks.cohortToMode, 'source', col1Order);
  const c2Raw = sumBy(insights.flowLinks.cohortToMode, 'target', col2Order);
  const c3Raw = sumBy(insights.flowLinks.modeToOutcome, 'target', col3Order);

  const layoutCol = (
    items: Array<{ key: string; value: number }>,
    x: number,
    colorFn: (k: string) => string
  ): NodeRect[] => {
    const total = Math.max(0.0001, items.reduce((a, b) => a + b.value, 0));
    const gap = 12;
    const avail = Math.max(40, usableH - gap * Math.max(0, items.length - 1));
    let curY = padTop;
    return items.map((it) => {
      const h = Math.max(12, (it.value / total) * avail);
      const rect: NodeRect = {
        key: it.key,
        label: it.key,
        x,
        y: curY,
        h,
        value: it.value,
        color: colorFn(it.key),
      };
      curY += h + gap;
      return rect;
    });
  };

  const col1 = layoutCol(c1Raw, 150, (k) =>
    k === 'Top 1 Poster' ? '#E74079' : k === 'Posters #2–#5' ? '#D9A097' : '#EFE9E2'
  );
  const col2 = layoutCol(c2Raw, width / 2 - nodeW / 2, (k) =>
    k === 'bounty' ? '#E74079' : '#D9A097'
  );
  const col3 = layoutCol(c3Raw, width - 166, (k) =>
    k === 'Completed' ? '#FFF6E8' : k === 'Active / Open' ? '#E74079' : '#6F645B'
  );

  const buildPaths = (
    leftNodes: NodeRect[],
    rightNodes: NodeRect[],
    links: Array<{ source: string; target: string; tasks: number; usd: number }>
  ) => {
    const leftOffsets = new Map(leftNodes.map((n) => [n.key, n.y]));
    const rightOffsets = new Map(rightNodes.map((n) => [n.key, n.y]));
    const leftMap = new Map(leftNodes.map((n) => [n.key, n]));
    const rightMap = new Map(rightNodes.map((n) => [n.key, n]));

    return links
      .map((l) => {
        const val = metric === 'usd' ? l.usd : l.tasks;
        const ln = leftMap.get(l.source);
        const rn = rightMap.get(l.target);
        if (!ln || !rn || val <= 0) return null;
        const lh = Math.max(2, (val / ln.value) * ln.h);
        const rh = Math.max(2, (val / rn.value) * rn.h);
        const y0 = leftOffsets.get(l.source) ?? ln.y;
        const y1 = rightOffsets.get(l.target) ?? rn.y;
        leftOffsets.set(l.source, y0 + lh);
        rightOffsets.set(l.target, y1 + rh);

        const x0 = ln.x + nodeW;
        const x1 = rn.x;
        const cx = (x0 + x1) / 2;
        const d = `M ${x0} ${y0} C ${cx} ${y0}, ${cx} ${y1}, ${x1} ${y1} L ${x1} ${y1 + rh} C ${cx} ${y1 + rh}, ${cx} ${y0 + lh}, ${x0} ${y0 + lh} Z`;
        return {
          id: `${l.source} -> ${l.target}`,
          d,
          color: ln.color,
          tooltip: `${l.source} → ${l.target}: ${l.tasks} tasks · $${l.usd.toFixed(2)}`,
        };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x));
  };

  const paths1 = buildPaths(col1, col2, insights.flowLinks.cohortToMode);
  const paths2 = buildPaths(col2, col3, insights.flowLinks.modeToOutcome);

  const fmtVal = (v: number) => (metric === 'usd' ? `$${v.toFixed(0)}` : `${Math.round(v)}`);

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2 className="panel-title serif">
            Capital <em>Flow</em> &amp; Poster Concentration
          </h2>
          <p className="panel-desc">
            Tracks how escrowed value moves from poster concentration tiers through Taskmarket modes
            into settled payouts vs expired or cancelled tasks ({insights.label}).
          </p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <div className="segmented">
            <button
              type="button"
              className={`seg-btn ${metric === 'usd' ? 'active' : ''}`}
              onClick={() => setMetric('usd')}
            >
              By Escrow Volume ($)
            </button>
            <button
              type="button"
              className={`seg-btn ${metric === 'tasks' ? 'active' : ''}`}
              onClick={() => setMetric('tasks')}
            >
              By Task Count
            </button>
          </div>
          <button type="button" className="action-btn" onClick={onExportCard}>
            Share Card
          </button>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', minWidth: 640, height: 'auto' }}>
          <text x={150} y={16} fill="#B0A79D" fontSize="11" className="mono">
            POSTER COHORT
          </text>
          <text x={width / 2} y={16} fill="#B0A79D" fontSize="11" textAnchor="middle" className="mono">
            TASK MODE
          </text>
          <text x={width - 150} y={16} fill="#B0A79D" fontSize="11" textAnchor="end" className="mono">
            MARKET OUTCOME
          </text>

          {[...paths1, ...paths2].map((p) => (
            <path
              key={p.id}
              d={p.d}
              fill={p.color}
              fillOpacity={hovered === p.tooltip ? 0.65 : 0.26}
              onMouseEnter={() => setHovered(p.tooltip)}
              onMouseLeave={() => setHovered(null)}
              style={{ transition: 'fill-opacity 0.14s ease', cursor: 'pointer' }}
            />
          ))}

          {col1.map((n) => (
            <g key={n.key}>
              <rect x={n.x} y={n.y} width={nodeW} height={n.h} rx={4} fill={n.color} />
              <text x={n.x - 10} y={n.y + n.h / 2 - 2} textAnchor="end" fill="#EFE9E2" fontSize="12" fontWeight="600">
                {n.label}
              </text>
              <text x={n.x - 10} y={n.y + n.h / 2 + 12} textAnchor="end" fill="#B0A79D" fontSize="10" className="mono">
                {fmtVal(n.value)}
              </text>
            </g>
          ))}

          {col2.map((n) => {
            const txt = `${n.label} (${fmtVal(n.value)})`;
            const pillW = txt.length * 6.8 + 14;
            return (
              <g key={n.key}>
                <rect x={n.x} y={n.y} width={nodeW} height={n.h} rx={4} fill={n.color} />
                <rect
                  x={n.x + nodeW / 2 - pillW / 2}
                  y={n.y - 19}
                  width={pillW}
                  height={16}
                  rx={4}
                  fill="rgba(18, 16, 14, 0.88)"
                  stroke="#453E37"
                  strokeWidth="0.8"
                />
                <text x={n.x + nodeW / 2} y={n.y - 8} textAnchor="middle" fill="#FFF6E8" fontSize="10.5" className="mono">
                  {txt}
                </text>
              </g>
            );
          })}

          {col3.map((n) => (
            <g key={n.key}>
              <rect x={n.x} y={n.y} width={nodeW} height={n.h} rx={4} fill={n.color} />
              <text x={n.x + nodeW + 10} y={n.y + n.h / 2 - 2} fill="#EFE9E2" fontSize="12" fontWeight="600">
                {n.label}
              </text>
              <text x={n.x + nodeW + 10} y={n.y + n.h / 2 + 12} fill="#B0A79D" fontSize="10" className="mono">
                {fmtVal(n.value)}
              </text>
            </g>
          ))}
        </svg>
      </div>

      <div className="mono" style={{ fontSize: '0.78rem', color: '#D9A097', minHeight: 20 }}>
        {hovered || 'Hover any ribbon above to inspect exact tasks and escrowed volume.'}
      </div>
    </section>
  );
}
