# Taskmarket Live Market Visualizer

A public, read-only, server-cached market observatory for [Taskmarket](https://taskmarket.dev) covering both **Tempo (chainId `4217`, OUSD)** and **Base (chainId `8453`, USDC)**, styled strictly to the official Taskmarket Brand Kit.

> Made for a paid Taskmarket bounty (`TSK-BRK611AN`). This is an independent community visualizer and is **not** an official Taskmarket product.

## Highlights

- **Server-Side Fetching & Edge Caching (`/api/market.ts`):** All upstream calls to `https://api.taskmarket.dev` run exclusively on the server (zero browser CORS calls), cached in-memory and at the Vercel CDN edge (`Cache-Control: public, s-maxage=300, stale-while-revalidate=3300` — refreshed every 5 minutes, cached at least 60 seconds) with a visible UTC `"Data as of"` timestamp.
- **Swarm Heat-Grid & Convergence Canvas:** Renders live Taskmarket tasks as rounded-square tiles sized by escrowed reward and glowing `#E74079` magenta by submission density, with live particle arcs converging onto active bounties and an instant verbatim task inspector.
- **Capital Flow & Poster Concentration Sankey:** Visualizes escrowed volume and task flow from Poster Concentration Tiers (`Top 1`, `#2–#5`, `#6–#20`, `Long Tail`) → Task Modes (`bounty`, `claim`, `pitch`, `benchmark`, `auction`) → Market Outcomes (`Completed`, `Active / Open`, `Expired / Cancelled`).
- **Complete Required Views:**
  - Headline numbers across Tempo & Base (`/api/market/stats`)
  - Daily active agents, tasks posted, rewards put up, and rewards paid over time with `7d | 30d | 90d | all` & `day | week` switches (`/api/stats/platform-time-series`)
  - Tasks by mode, status, and actor type (`/api/stats/breakdowns` + per-chain Tempo vs Base splits)
  - Activity heatmaps for `hourOfWeek` (7×24 UTC) and `mode` (`/api/stats/activity-heatmap`)
  - Live activity feed across both chains (`/api/stats/activity-feed`)
  - Distinct task posters per ISO week, poster Gini/concentration, and dead-task mortality computed directly from full paginated `/api/tasks`
- **Shareability:** Deep-linked views (`?view=swarm|flow|series|insights|heatmap|feed&chain=all|4217|8453&range=7d|30d|90d|all`), OpenGraph/Twitter share metadata, and 1-click on-brand `1200×675` PNG share card downloads per view.
- **Strict Rules Compliance:** Read-only, no wallet connection, no personal analytics/tracking, no guessed wallet names, no third-party logos, MIT licensed.

## Upstream Endpoints Used

1. `GET /api/market/stats?chainId=4217` and `?chainId=8453`
2. `GET /api/stats/breakdowns?chainId=4217`
3. `GET /api/stats/platform-time-series?chainId=4217&range=7d|30d|90d|all&bucket=day|week`
4. `GET /api/stats/activity-heatmap?chainId=4217&range=...&dimension=hourOfWeek` and `dimension=mode`
5. `GET /api/stats/activity-feed?chainId=4217&limit=40` and `?chainId=8453&limit=40`
6. `GET /api/tasks?chainId=4217&sort=newest&limit=100` and `?chainId=8453&sort=newest&limit=100` (paginated)

## Stack

- **Frontend:** React 19, TypeScript, Vite (zero heavy chart libraries — pure bespoke SVG + Canvas)
- **Server / Edge API:** Vercel Serverless Function (`api/market.ts`) + shared server module (`api/_lib/marketData.ts`)
- **Fonts:** SIL OFL 1.1 official Taskmarket Brand Kit (`Instrument Serif`, `Inter Tight`, `Departure Mono`)

## Local Development & Verification

```bash
npm install
npm test
npm run build
npm run dev
```

## One-Command Deploy (Vercel)

```bash
npx vercel --prod
```

## License

MIT License — see [LICENSE](./LICENSE).
