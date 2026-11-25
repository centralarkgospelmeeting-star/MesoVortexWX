import { NextResponse } from 'next/server';
import { normalizeNwsCollection } from '@/lib/alerts/model';
import { buildObservations } from '@/lib/mesoai/data-engine';
import { runDetections } from '@/lib/mesoai/detection-engine';
import { buildWatcherSummaries, type WatcherState } from '@/lib/mesoai/watcher';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

let watcherState: WatcherState = {};

async function getJson(url: URL, timeoutMs: number): Promise<unknown> {
  const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const site = {
    id: (params.get('id') || '').slice(0, 40),
    name: (params.get('name') || '').slice(0, 160),
    lat: Number(params.get('lat')),
    lon: Number(params.get('lon')),
  };
  if (!site.id || !site.name || !Number.isFinite(site.lat) || !Number.isFinite(site.lon)) {
    return NextResponse.json({ error: 'Valid site coordinates are required.' }, { status: 400 });
  }

  const [stormResult, alertsResult] = await Promise.allSettled([
    getJson(new URL(`/api/radar/storm-analysis?site=${encodeURIComponent(site.id)}`, request.url), 75_000),
    getJson(new URL('/api/alerts', request.url), 15_000),
  ]);

  const alerts = alertsResult.status === 'fulfilled' && alertsResult.value
    ? normalizeNwsCollection(alertsResult.value)
    : [];
  const observations = buildObservations({
    site,
    stormAnalysis: stormResult.status === 'fulfilled' ? stormResult.value : null,
    alerts,
  });
  const detections = runDetections(observations);
  const built = buildWatcherSummaries(detections, { state: watcherState });
  watcherState = built.state;

  return NextResponse.json(
    {
      summaries: built.summaries,
      scannedSources: observations.map((observation) => observation.source),
      generatedAt: new Date().toISOString(),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
