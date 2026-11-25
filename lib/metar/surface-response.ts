/**
 * Shared HTTP handler for the real AviationWeather.gov surface feed.
 *
 * Both /api/metar/geojson and /api/asos/geojson use this handler. ASOS is a
 * strict subset of genuine METAR reports carrying AUTO / AO1 / AO2 remarks;
 * it is never synthesized or sourced from a separate unverified feed.
 */

import { NextResponse } from 'next/server';
import { buildUpstreamUrl, normalizeCollection, type SurfaceSource } from './surface-feed';

const jsonHeaders = { 'Cache-Control': 'no-store' };
const cachedHeaders = {
  'Cache-Control': 'public, s-maxage=90, stale-while-revalidate=180',
  'Access-Control-Allow-Origin': '*',
};

const SOURCE_LABEL: Record<SurfaceSource, string> = {
  metar: 'AviationWeather.gov METAR',
  asos: 'AviationWeather.gov METAR (automated AUTO/AO1/AO2 subset)',
};

function empty(error: string, status: number) {
  return NextResponse.json(
    { type: 'FeatureCollection', features: [], error },
    { status, headers: jsonHeaders }
  );
}

export async function getSurfaceResponse(params: URLSearchParams, forcedSource?: SurfaceSource) {
  const ids = params.get('ids')?.trim();
  const bbox = params.get('bbox')?.trim();
  const hours = params.get('hours');
  const requested = params.get('source');
  const source: SurfaceSource = forcedSource ?? (requested === 'asos' ? 'asos' : 'metar');

  const upstream = buildUpstreamUrl({ ids, bbox, hours, source });
  if (!upstream) {
    return empty('Provide ids (e.g. KLIT,KDFW) or bbox (lat0,lon0,lat1,lon1)', 400);
  }

  try {
    const res = await fetch(upstream, {
      headers: {
        'User-Agent': 'MesoVortexWX/2.0 (https://mesovortex-wx.vercel.app)',
        Accept: 'application/geo+json, application/json',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return NextResponse.json(
        {
          type: 'FeatureCollection',
          features: [],
          error: `AviationWeather HTTP ${res.status}`,
          detail: detail.slice(0, 300),
          _meta: { ok: false, sourceType: source, sourceLabel: SOURCE_LABEL[source] },
        },
        { status: 502, headers: jsonHeaders }
      );
    }

    const features = normalizeCollection(await res.json(), source);
    return NextResponse.json(
      {
        type: 'FeatureCollection',
        features,
        _meta: {
          fetchedAt: new Date().toISOString(),
          source: upstream,
          sourceType: source,
          sourceLabel: SOURCE_LABEL[source],
          filter: source === 'asos'
            ? 'Real METAR reports with AUTO / AO1 / AO2 automated-station remarks only'
            : 'All real METAR reports returned by AviationWeather.gov',
          ok: true,
          count: features.length,
        },
      },
      { headers: cachedHeaders }
    );
  } catch (err: any) {
    return empty(err?.message || 'Surface observation fetch failed', 502);
  }
}
