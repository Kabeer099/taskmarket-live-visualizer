import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChainFilter, SwarmTaskTile } from '../types';

interface Props {
  tiles: SwarmTaskTile[];
  chainFilter: ChainFilter;
  onExportCard: () => void;
}

interface PlacedTile {
  tile: SwarmTaskTile;
  x: number;
  y: number;
  size: number;
  heat: number; // 0..1 based on submissionCount
}

export default function SwarmHeatCanvas({ tiles, chainFilter, onExportCard }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const visibleTiles = useMemo(() => {
    const filtered =
      chainFilter === 'all'
        ? tiles
        : tiles.filter((t) => String(t.chainId) === chainFilter);
    return filtered.slice(0, 48);
  }, [tiles, chainFilter]);

  const selectedTile = useMemo(() => {
    if (selectedId) {
      const found = visibleTiles.find((t) => t.id === selectedId);
      if (found) return found;
    }
    return visibleTiles[0] ?? null;
  }, [visibleTiles, selectedId]);

  const placedRef = useRef<PlacedTile[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(320, Math.round(rect.width * dpr));
      canvas.height = Math.max(300, Math.round(rect.height * dpr));
    };
    resize();

    const maxSubs = Math.max(1, ...visibleTiles.map((t) => t.submissionCount));
    const maxReward = Math.max(1, ...visibleTiles.map((t) => t.rewardUsd));

    const computeLayout = (w: number, h: number): PlacedTile[] => {
      const padX = 28;
      const padY = 30;
      const usableW = w - padX * 2;
      const usableH = h - padY * 2;
      const cols = w < 540 ? 6 : 8;
      const rows = Math.max(1, Math.ceil(visibleTiles.length / cols));
      const cellW = usableW / cols;
      const cellH = usableH / rows;
      const maxBox = Math.min(cellW, cellH) * 0.8;
      const minBox = maxBox * 0.52;

      return visibleTiles.map((tile, idx) => {
        const c = idx % cols;
        const r = Math.floor(idx / cols);
        const rewardFactor = Math.sqrt(Math.max(0.25, tile.rewardUsd) / maxReward);
        const size = minBox + (maxBox - minBox) * rewardFactor;
        const cx = padX + c * cellW + cellW / 2;
        const cy = padY + r * cellH + cellH / 2;
        const heat = Math.min(1, Math.log1p(tile.submissionCount) / Math.log1p(maxSubs));
        return { tile, x: cx - size / 2, y: cy - size / 2, size, heat };
      });
    };

    // Animated agent swarm particles converging onto the hottest open tiles
    const particles = Array.from({ length: 34 }, (_, i) => ({
      t: (i * 0.13) % 1,
      speed: 0.004 + (i % 5) * 0.0012,
      targetRank: i % 10,
      originSide: i % 4,
    }));

    const draw = (time: number) => {
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);

      // Subtle architectural grid lines
      ctx.strokeStyle = 'rgba(239, 233, 226, 0.04)';
      ctx.lineWidth = 1;
      for (let gx = 0; gx < w; gx += 48) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, h);
        ctx.stroke();
      }
      for (let gy = 0; gy < h; gy += 48) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(w, gy);
        ctx.stroke();
      }

      const placed = computeLayout(w, h);
      placedRef.current = placed;

      // Sort hottest open tiles for swarm convergence arcs
      const hotOpen = [...placed]
        .filter((p) => p.tile.status === 'open')
        .sort((a, b) => b.tile.submissionCount - a.tile.submissionCount || b.tile.rewardUsd - a.tile.rewardUsd)
        .slice(0, 10);

      // Draw gentle particle convergence trails toward busy open bounties
      if (hotOpen.length > 0) {
        for (const pt of particles) {
          pt.t = (pt.t + pt.speed) % 1;
          const dest = hotOpen[pt.targetRank % hotOpen.length];
          const tx = dest.x + dest.size / 2;
          const ty = dest.y + dest.size / 2;
          const sx =
            pt.originSide === 0 ? 12 : pt.originSide === 1 ? w - 12 : (pt.targetRank * 113) % w;
          const sy =
            pt.originSide === 2 ? 12 : pt.originSide === 3 ? h - 12 : (pt.targetRank * 79) % h;
          const mx = (sx + tx) / 2 + (pt.originSide % 2 === 0 ? 28 : -28);
          const my = (sy + ty) / 2 - 24;

          const u = pt.t;
          const px = (1 - u) * (1 - u) * sx + 2 * (1 - u) * u * mx + u * u * tx;
          const py = (1 - u) * (1 - u) * sy + 2 * (1 - u) * u * my + u * u * ty;

          ctx.strokeStyle = 'rgba(231, 64, 121, 0.08)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.quadraticCurveTo(mx, my, tx, ty);
          ctx.stroke();

          ctx.fillStyle = `rgba(255, 246, 232, ${0.15 + 0.65 * Math.sin(u * Math.PI)})`;
          ctx.beginPath();
          ctx.arc(px, py, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Draw each rounded-square Taskmarket tile (exact 20% corner radius!)
      for (const p of placed) {
        const r = p.size * 0.2;
        const isSelected = selectedTile && p.tile.id === selectedTile.id;
        const isOpen = p.tile.status === 'open';
        const isCompleted = p.tile.status === 'completed';

        // Tile fill follows Taskmarket logo heat-map rule: busier open task = brighter #E74079!
        let fill = '#2A2520';
        let stroke = 'rgba(69, 62, 55, 0.9)';
        if (isOpen) {
          const pulse = 0.06 * Math.sin(time * 0.0025 + p.x);
          const alpha = Math.min(1, 0.25 + p.heat * 0.72 + pulse);
          fill = `rgba(231, 64, 121, ${alpha.toFixed(3)})`;
          stroke = p.heat > 0.45 ? 'rgba(255, 246, 232, 0.55)' : 'rgba(231, 64, 121, 0.65)';
        } else if (isCompleted) {
          fill = p.heat > 0.5 ? 'rgba(217, 160, 151, 0.42)' : 'rgba(239, 233, 226, 0.16)';
          stroke = 'rgba(217, 160, 151, 0.45)';
        } else {
          fill = 'rgba(69, 62, 55, 0.35)';
          stroke = 'rgba(176, 167, 157, 0.25)';
        }

        if (isOpen && p.heat > 0.55) {
          ctx.save();
          ctx.shadowColor = 'rgba(231, 64, 121, 0.55)';
          ctx.shadowBlur = 16;
          ctx.fillStyle = fill;
          ctx.beginPath();
          ctx.roundRect(p.x, p.y, p.size, p.size, r);
          ctx.fill();
          ctx.restore();
        } else {
          ctx.fillStyle = fill;
          ctx.beginPath();
          ctx.roundRect(p.x, p.y, p.size, p.size, r);
          ctx.fill();
        }

        ctx.strokeStyle = isSelected ? '#FFF6E8' : stroke;
        ctx.lineWidth = isSelected ? 2.2 : 1;
        ctx.beginPath();
        ctx.roundRect(p.x, p.y, p.size, p.size, r);
        ctx.stroke();

        // Compact dollar label inside tiles
        if (p.size >= 24) {
          ctx.fillStyle = isOpen && p.heat > 0.35 ? '#FFF6E8' : '#EFE9E2';
          ctx.font = `600 ${p.size >= 34 ? 10 : 9}px "Departure Mono", monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const lbl = p.tile.rewardUsd >= 1 ? `$${Math.round(p.tile.rewardUsd)}` : `$${p.tile.rewardUsd.toFixed(1)}`;
          ctx.fillText(lbl, p.x + p.size / 2, p.y + p.size / 2);
        }
      }

      ctx.restore();
      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, [visibleTiles, selectedTile]);

  function handleCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const hit = placedRef.current.find(
      (p) => mx >= p.x && mx <= p.x + p.size && my >= p.y && my <= p.y + p.size
    );
    if (hit) setSelectedId(hit.tile.id);
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2 className="panel-title serif">
            The Market <em>Heat-Grid</em> &amp; Swarm Convergence
          </h2>
          <p className="panel-desc">
            Every rounded square is one live Taskmarket task. Tile size scales with escrowed reward;
            brighter magenta signals denser agent competition converging on open tasks. Click any tile
            to inspect verbatim chain data.
          </p>
        </div>
        <button type="button" className="action-btn action-btn-salmon" onClick={onExportCard}>
          Download Share Card (.png)
        </button>
      </div>

      <div className="swarm-layout">
        <div className="swarm-stage">
          <canvas
            ref={canvasRef}
            className="swarm-canvas"
            onClick={handleCanvasClick}
            aria-label="Interactive Taskmarket swarm heat-grid"
          />
          <div
            style={{
              position: 'absolute',
              left: 12,
              bottom: 10,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 10,
              fontSize: '0.72rem',
              color: '#B0A79D',
              background: 'rgba(18, 16, 14, 0.82)',
              padding: '5px 10px',
              borderRadius: 8,
              border: '1px solid #453E37',
            }}
          >
            <span>■ Bright Magenta = Busy Open Task</span>
            <span>■ Salmon = Settled</span>
            <span>■ Muted = Quiet / Closed</span>
            <span>• Arcs = Live Swarm</span>
          </div>
        </div>

        <aside className="tile-inspector">
          {selectedTile ? (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="mono" style={{ fontSize: '0.84rem', color: '#FFF6E8' }}>
                    {selectedTile.referenceCode}
                  </span>
                  <span className={`chip ${selectedTile.status === 'open' ? 'chip-hot' : 'chip-salmon'}`}>
                    {selectedTile.status}
                  </span>
                </div>

                <div style={{ fontSize: '0.96rem', lineHeight: 1.38, color: '#EFE9E2' }}>
                  {selectedTile.title}
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 8,
                    padding: 10,
                    borderRadius: 8,
                    background: '#221E1A',
                    border: '1px solid #453E37',
                  }}
                >
                  <div>
                    <div className="kpi-label">Reward</div>
                    <div className="mono" style={{ fontSize: '1.05rem', color: '#FFF6E8' }}>
                      ${selectedTile.rewardUsd.toFixed(2)} {selectedTile.tokenSymbol}
                    </div>
                  </div>
                  <div>
                    <div className="kpi-label">Submissions</div>
                    <div className="mono" style={{ fontSize: '1.05rem', color: '#E74079' }}>
                      {selectedTile.submissionCount}
                    </div>
                  </div>
                  <div>
                    <div className="kpi-label">Mode</div>
                    <div className="mono" style={{ fontSize: '0.82rem' }}>{selectedTile.mode}</div>
                  </div>
                  <div>
                    <div className="kpi-label">Chain</div>
                    <div className="mono" style={{ fontSize: '0.82rem' }}>
                      {selectedTile.chainId === 4217 ? 'Tempo' : 'Base'}
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: '0.76rem', color: '#B0A79D', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div>
                    Poster: <span className="mono">{selectedTile.shortRequester}</span>
                  </div>
                  <div>
                    Posted: <span className="mono">{selectedTile.createdAt.slice(0, 16).replace('T', ' ')} UTC</span>
                  </div>
                </div>
              </div>

              <a
                href={`https://taskmarket.dev/tasks/${selectedTile.id}`}
                target="_blank"
                rel="noreferrer"
                className="action-btn"
                style={{ justifyContent: 'center', marginTop: 12 }}
              >
                Open on taskmarket.dev ↗
              </a>
            </>
          ) : (
            <p className="panel-desc">No tasks loaded for this chain filter.</p>
          )}
        </aside>
      </div>
    </section>
  );
}
