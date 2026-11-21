import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Live Spotter Network positions from the public GR placefile feed
 * (same source WeatherWise / GRLevelX use):
 *   https://www.spotternetwork.org/feeds/gr.txt
 */
function parseGRFeed(text: string): any[] {
  const features: any[] = [];
  const blocks = text.split(/Object:\s*/);

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];
    const lines = block.split('\n');
    const coordLine = (lines[0] || '').trim();
    const [latStr, lonStr] = coordLine.split(',');
    const lat = parseFloat(latStr);
    const lon = parseFloat(lonStr);
    if (isNaN(lat) || isNaN(lon)) continue;

    const iconLine = lines.find((l) => l.startsWith('Icon:'));
    let rawInfo = '';
    if (iconLine) {
      const match = iconLine.match(/"([^"]*)"/);
      if (match) rawInfo = match[1];
    }

    const textLine = lines.find((l) => l.startsWith('Text:'));
    let textLabel = '';
    if (textLine) {
      const match = textLine.match(/"([^"]*)"/);
      if (match) textLabel = match[1];
    }

    const infoParts = rawInfo.split(/\\n|\n/);
    const name = infoParts[0] || textLabel || 'Live Spotter';
    const time = infoParts[1] || '';
    const status = infoParts[2] || 'STATIONARY';
    const extraDetails = infoParts.slice(3).filter(Boolean).join('\n');

    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lon, lat] },
      properties: {
        id: `sn-${i}-${lat.toFixed(4)}-${lon.toFixed(4)}`,
        name,
        callsign: textLabel && textLabel !== name ? textLabel : name,
        time,
        status,
        speed: status.toUpperCase().includes('MOBILE') ? 'Mobile' : '0 mph (Stationary)',
        heading: status,
        notes: extraDetails || status,
        extraDetails,
        type: 'position',
      },
    });
  }

  return features;
}

export async function GET(req: NextRequest) {
  try {
    const res = await fetch('https://www.spotternetwork.org/feeds/gr.txt', {
      headers: {
        'User-Agent': 'MesoVortexWX/2.0 (https://mesovortex-wx.vercel.app)',
        Accept: 'text/plain',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) {
      return NextResponse.json(
        {
          type: 'FeatureCollection',
          features: [],
          meta: {
            source: 'Spotter Network GR Feed',
            error: `Upstream HTTP ${res.status}`,
            count: 0,
            fetchedAt: new Date().toISOString(),
          },
        },
        { status: 502, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const text = await res.text();
    const features = parseGRFeed(text);

    return NextResponse.json(
      {
        type: 'FeatureCollection',
        features,
        meta: {
          source: 'Spotter Network GR Feed',
          count: features.length,
          fetchedAt: new Date().toISOString(),
        },
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error: any) {
    console.warn('[Spotter Network]', error);
    return NextResponse.json(
      {
        type: 'FeatureCollection',
        features: [],
        meta: {
          source: 'Spotter Network GR Feed',
          error: String(error?.message || error),
          count: 0,
          fetchedAt: new Date().toISOString(),
        },
      },
      { status: 502, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
