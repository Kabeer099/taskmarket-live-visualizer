import type { IncomingMessage, ServerResponse } from 'node:http';
import { buildMarketSnapshot } from './_lib/marketData.js';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const urlObj = new URL(req.url || '/api/market', 'https://localhost');
    const range = urlObj.searchParams.get('range') || '30d';
    const bucket = urlObj.searchParams.get('bucket') || 'day';

    const snapshot = await buildMarketSnapshot(range, bucket);

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    // Cached >= 60s at CDN edge (5 min fresh, 55 min stale-while-revalidate => refreshed at least hourly)
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3300');
    res.end(JSON.stringify(snapshot));
  } catch (err) {
    res.statusCode = 502;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(
      JSON.stringify({
        error: 'Failed to fetch upstream Taskmarket stats',
        detail: err instanceof Error ? err.message : String(err),
      })
    );
  }
}
