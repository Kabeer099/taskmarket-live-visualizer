import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

function localApiDevPlugin(): Plugin {
  return {
    name: 'taskmarket-local-api',
    configureServer(server) {
      server.middlewares.use('/api/market', async (req, res, next) => {
        try {
          const urlObj = new URL(req.url || '/', 'http://localhost');
          const { buildMarketSnapshot } = await server.ssrLoadModule('/api/_lib/marketData.ts');
          const range = urlObj.searchParams.get('range') || '30d';
          const bucket = urlObj.searchParams.get('bucket') || 'day';
          const data = await buildMarketSnapshot(range, bucket);
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.setHeader('Cache-Control', 'public, max-age=60');
          res.end(JSON.stringify(data));
        } catch (err) {
          next(err);
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), localApiDevPlugin()],
  build: {
    target: 'es2022',
    sourcemap: false,
  },
});
