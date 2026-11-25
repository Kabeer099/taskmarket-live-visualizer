import { useState } from 'react';
import type { HeatmapData } from '../types';

interface Props {
  hourOfWeek: HeatmapData;
  byMode: HeatmapData;
  onExportCard: () => void;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function cellColor(count: number, max: number): string {
  if (count <= 0) return 'rgba(255, 246, 232, 0.04)';
  const ratio = Math.pow(count / Math.max(1, max), 0.65);
  if (ratio > 0.85) return '#FFF6E8';
  if (ratio > 0.55) return '#E74079';
  if (ratio > 0.3) return '#9E2952';
  return '#4D1A2B';
}

export default function HeatmapPanel({ hourOfWeek, byMode, onExportCard }: Props) {
  const [dim, setDim] = useState<'hourOfWeek' | 'mode'>('hourOfWeek');
  const [hoverInfo, setHoverInfo] = useState<string | null>(null);

  const active = dim === 'hourOfWeek' ? hourOfWeek : byMode;
  const cols = dim === 'mode' ? active.colKeys.slice(-21) : active.colKeys;
  const cellMap = new Map(active.cells.map((c) => [`${c.row}:${c.col}`, c]));
  const maxCount = Math.max(1, ...active.cells.map((c) => c.count));

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2 className="panel-title serif">
            Activity <em>Heatmap</em>
          </h2>
          <p className="panel-desc">
            Direct from /api/stats/activity-heatmap. Brighter magenta and paper tiles reveal peak
            autonomous agent activity windows (UTC) and task-mode volume bursts.
          </p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <div className="segmented">
            <button
              type="button"
              className={`seg-btn ${dim === 'hourOfWeek' ? 'active' : ''}`}
              onClick={() => setDim('hourOfWeek')}
            >
              Hour of Week (UTC)
            </button>
            <button
              type="button"
              className={`seg-btn ${dim === 'mode' ? 'active' : ''}`}
              onClick={() => setDim('mode')}
            >
              Mode × Day (21d)
            </button>
          </div>
          <button type="button" className="action-btn" onClick={onExportCard}>
            Share Card
          </button>
        </div>
      </div>

      <div className="heatmap-scroll">
        <div
          className="hm-grid"
          style={{
            gridTemplateColumns: `84px repeat(${cols.length}, minmax(20px, 1fr))`,
            minWidth: dim === 'hourOfWeek' ? 680 : 620,
          }}
        >
          <div />
          {cols.map((col) => (
            <div
              key={col}
              className="mono"
              style={{ fontSize: '0.65rem', color: '#B0A79D', textAlign: 'center' }}
            >
              {dim === 'hourOfWeek' ? `${col}h` : col.slice(5)}
            </div>
          ))}

          {active.rowKeys.map((row) => (
            <div key={row} style={{ display: 'contents' }}>
              <div className="mono" style={{ fontSize: '0.72rem', color: '#EFE9E2' }}>
                {dim === 'hourOfWeek' ? DAY_NAMES[Number(row)] || row : row}
              </div>
              {cols.map((col) => {
                const cell = cellMap.get(`${row}:${col}`);
                const count = cell?.count ?? 0;
                const volUsd = cell ? Number(cell.volume || 0) / 1e6 : 0;
                const label =
                  dim === 'hourOfWeek'
                    ? `${DAY_NAMES[Number(row)] || row} ${col}:00 UTC — ${count} events`
                    : `${row} on ${col} — ${count} tasks ($${volUsd.toFixed(2)})`;
                return (
                  <div
                    key={`${row}:${col}`}
                    className="hm-cell"
                    style={{ background: cellColor(count, maxCount) }}
                    title={label}
                    onMouseEnter={() => setHoverInfo(label)}
                    onMouseLeave={() => setHoverInfo(null)}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="mono" style={{ fontSize: '0.78rem', color: '#D9A097', minHeight: 18 }}>
        {hoverInfo || `Peak cell: ${maxCount} events · Hover any tile to read exact counts.`}
      </div>
    </section>
  );
}
