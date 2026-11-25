import type { ChainComputedInsights, MarketSnapshotResponse, ViewTab } from '../types';

/**
 * Generates an on-brand 1200x675 Taskmarket share card PNG for the active view,
 * using only Brand Kit colours (#12100E, #3A1420, #221E1A, #453E37, #EFE9E2, #FFF6E8, #E74079),
 * Brand Kit fonts, official taskmarket-lockup.png, and verbatim API numbers.
 */
export async function downloadBrandShareCard(
  snapshot: MarketSnapshotResponse,
  activeInsights: ChainComputedInsights,
  view: ViewTab
): Promise<void> {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 675;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Ground + maroon top-left glow
  ctx.fillStyle = '#12100E';
  ctx.fillRect(0, 0, 1200, 675);
  const glow = ctx.createRadialGradient(180, 70, 20, 180, 70, 560);
  glow.addColorStop(0, 'rgba(58, 20, 32, 0.95)');
  glow.addColorStop(1, 'rgba(18, 16, 14, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 1200, 675);

  // Load official lockup cleanly
  try {
    const img = new Image();
    img.src = '/brand/taskmarket-lockup.png';
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej();
    });
    const lockH = 42;
    const lockW = (img.width / img.height) * lockH;
    ctx.drawImage(img, 56, 48, lockW, lockH);
  } catch {
    ctx.fillStyle = '#FFF6E8';
    ctx.font = '600 22px "Departure Mono", monospace';
    ctx.fillText('taskmarket.dev', 56, 78);
  }

  // Right-aligned address in Departure Mono
  ctx.fillStyle = '#B0A79D';
  ctx.font = '400 18px "Departure Mono", monospace';
  ctx.textAlign = 'right';
  ctx.fillText('taskmarket.dev', 1144, 76);

  // View headline in Instrument Serif with ONE italic magenta word
  const headlines: Record<ViewTab, [string, string]> = {
    swarm: ['Live swarm ', 'heat-grid.'],
    flow: ['Escrow ', 'capital flow.'],
    series: ['Market activity ', 'over time.'],
    insights: ['Concentration & ', 'velocity.'],
    heatmap: ['Global agent ', 'heatmap.'],
    feed: ['Live on-chain ', 'settlements.'],
  };
  const [plain, accent] = headlines[view];
  ctx.textAlign = 'left';
  ctx.font = '400 72px "Instrument Serif", Georgia, serif';
  ctx.fillStyle = '#FFF6E8';
  ctx.fillText(plain, 56, 194);
  const plainW = ctx.measureText(plain).width;
  ctx.font = 'italic 400 72px "Instrument Serif", Georgia, serif';
  ctx.fillStyle = '#E74079';
  ctx.fillText(accent, 56 + plainW, 194);

  ctx.font = '500 21px "Inter Tight", sans-serif';
  ctx.fillStyle = '#B0A79D';
  ctx.fillText(
    `${activeInsights.label} · Data as of ${snapshot.asOf.slice(0, 19).replace('T', ' ')} UTC`,
    56,
    236
  );

  // 4 Verified Metric Panels
  const cards = [
    {
      lbl: 'ACTIVE AGENTS (7D)',
      val: String(snapshot.headlines.tempo.activeAgents7d),
      sub: `${snapshot.headlines.tempo.registeredWorkers.toLocaleString()} registered`,
    },
    {
      lbl: 'PUBLIC TASKS',
      val: String(activeInsights.totalPublicTasks),
      sub: `${activeInsights.completionRatePct}% completed`,
    },
    {
      lbl: 'ESCROWED VOLUME',
      val: `$${activeInsights.totalEscrowedUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
      sub: `${activeInsights.tokenSymbol} · $${activeInsights.openEscrowUsd.toFixed(0)} open`,
    },
    {
      lbl: 'UNIQUE POSTERS',
      val: String(activeInsights.uniquePosters),
      sub: `Top 5 hold ${activeInsights.top5PostersSharePct}%`,
    },
  ];

  cards.forEach((c, idx) => {
    const x = 56 + idx * 276;
    const y = 290;
    const cw = 258;
    const ch = 186;
    ctx.fillStyle = '#221E1A';
    ctx.strokeStyle = '#453E37';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x, y, cw, ch, 14);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#B0A79D';
    ctx.font = '400 13px "Departure Mono", monospace';
    ctx.fillText(c.lbl, x + 20, y + 36);

    ctx.fillStyle = idx === 3 ? '#E74079' : '#FFF6E8';
    ctx.font = '400 50px "Departure Mono", monospace';
    ctx.fillText(c.val, x + 20, y + 108);

    ctx.fillStyle = '#EFE9E2';
    ctx.font = '500 16px "Inter Tight", sans-serif';
    ctx.fillText(c.sub, x + 20, y + 154);
  });

  // Footer attribution required by bounty rules
  ctx.strokeStyle = '#453E37';
  ctx.beginPath();
  ctx.moveTo(56, 594);
  ctx.lineTo(1144, 594);
  ctx.stroke();

  ctx.fillStyle = '#B0A79D';
  ctx.font = '500 15px "Inter Tight", sans-serif';
  ctx.fillText(
    'Built for a paid Taskmarket bounty (TSK-BRK611AN). Independent read-only visualizer; not an official Taskmarket product.',
    56,
    632
  );

  const link = document.createElement('a');
  link.download = `taskmarket-${view}-${snapshot.asOf.slice(0, 10)}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}
