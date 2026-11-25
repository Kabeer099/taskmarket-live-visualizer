import { describe, expect, it } from 'vitest';
import {
  computeChainInsights,
  computeGini,
  computeWeeklyPosters,
  isoWeekStartUtc,
  shortenWallet,
} from '../../api/_lib/marketData';

describe('Taskmarket Live Visualizer server aggregations', () => {
  it('truncates wallet addresses without attaching guessed identities', () => {
    expect(shortenWallet('0xAC958F0925a31a2C3844179Ab62F12d480BaA76D')).toBe('0xAC95…A76D');
  });

  it('buckets ISO weeks cleanly on Monday UTC', () => {
    expect(isoWeekStartUtc('2026-11-24T18:52:42Z')).toBe('2026-11-23');
    expect(isoWeekStartUtc('2026-11-22T23:59:59Z')).toBe('2026-11-16');
  });

  it('computes distinct posters per week across Tempo and Base', () => {
    const tempo = [
      {
        id: '1',
        chainId: 4217,
        referenceCode: 'TSK-1',
        requester: '0xAAA0000000000000000000000000000000000001',
        description: 'Task A',
        reward: '6000000',
        createdAt: '2026-11-24T12:00:00Z',
        expiryTime: '2026-11-25T12:00:00Z',
        status: 'completed',
        mode: 'bounty',
        submissionCount: 30,
        awardCount: 30,
      },
      {
        id: '2',
        chainId: 4217,
        referenceCode: 'TSK-2',
        requester: '0xAAA0000000000000000000000000000000000001',
        description: 'Task B',
        reward: '4000000',
        createdAt: '2026-11-24T15:00:00Z',
        expiryTime: '2026-11-25T15:00:00Z',
        status: 'open',
        mode: 'bounty',
        submissionCount: 10,
        awardCount: 0,
      },
    ];
    const base = [
      {
        id: '3',
        chainId: 8453,
        referenceCode: 'TSK-3',
        requester: '0xBBB0000000000000000000000000000000000002',
        description: 'Task C',
        reward: '5000000',
        createdAt: '2026-11-24T16:00:00Z',
        expiryTime: '2026-11-25T16:00:00Z',
        status: 'expired',
        mode: 'claim',
        submissionCount: 0,
        awardCount: 0,
      },
    ];

    const weekly = computeWeeklyPosters(tempo, base);
    expect(weekly).toHaveLength(1);
    expect(weekly[0].weekStart).toBe('2026-11-23');
    expect(weekly[0].distinctPostersTempo).toBe(1);
    expect(weekly[0].distinctPostersBase).toBe(1);
    expect(weekly[0].distinctPostersAll).toBe(2);

    const insights = computeChainInsights('all', 'Combined', 'OUSD / USDC', [...tempo, ...base]);
    expect(insights.totalPublicTasks).toBe(3);
    expect(insights.uniquePosters).toBe(2);
    expect(insights.totalEscrowedUsd).toBe(15);
    expect(insights.deadTaskUsd).toBe(5);
    expect(insights.top1PosterSharePct).toBe(66.7);
    expect(computeGini([1, 1, 1])).toBe(0);
    expect(computeGini([1, 1, 100])).toBeGreaterThan(0.6);
  });
});
