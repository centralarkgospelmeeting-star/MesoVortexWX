// MapLibre GL v6 resolves its web worker with `new URL('./maplibre-gl-worker.mjs',
// import.meta.url)`. Once Next.js/webpack bundles the library, that relative URL
// points at /_next/static/chunks/maplibre-gl-worker.mjs, which is never emitted,
// so the map silently fails to render ("Worker failed to load").
//
// Copy the worker that ships with the installed maplibre-gl version into public/
// and point MapLibre at it with setWorkerUrl() (see components/RadarMap.tsx).
// Runs automatically on install so the worker can never drift from the package.
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = join(root, 'node_modules', 'maplibre-gl', 'dist', 'maplibre-gl-worker.mjs');
const targetDir = join(root, 'public', 'maplibre');
const target = join(targetDir, 'maplibre-gl-worker.mjs');

if (!existsSync(source)) {
  console.warn('[maplibre-worker] maplibre-gl is not installed; skipping worker copy.');
  process.exit(0);
}

mkdirSync(targetDir, { recursive: true });
copyFileSync(source, target);
console.log('[maplibre-worker] copied dist/maplibre-gl-worker.mjs -> public/maplibre/');
