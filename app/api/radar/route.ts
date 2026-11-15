import { NextRequest, NextResponse } from 'next/server';
import { RADAR_SITES } from '../../../lib/radar-config';

export const dynamic = 'force-dynamic';

const IEM_TILE = 'https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0';

/**
 * GET /api/radar?site=KLZK&product=ref&tilt=0.5
 *
 * Real single-station (terminal) radar frames.
 * Primary: IEM RIDGE NEXRAD Level III tiles (US).
 * Secondary metadata: RainViewer single-radar archive listing when available.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const siteId = (searchParams.get('site') ?? 'KLZK').toUpperCase();
  const productKey = (searchParams.get('product') ?? 'ref').toLowerCase();
  const tilt = searchParams.get('tilt') ?? '0.5';

  const site =
    RADAR_SITES.find((s) => s.id === siteId || s.radarId === siteId) ||
    RADAR_SITES.find((s) => s.radarId === siteId.replace(/^K/, '')) ||
    RADAR_SITES[0];

  // NWS Level III product codes
  let productCode = 'N0B';
  switch (productKey) {
    case 'vel':
      productCode = tilt === '0.9' ? 'N1U' : tilt === '1.3' ? 'N2U' : tilt === '1.8' ? 'N3U' : 'N0U';
      break;
    case 'srvel':
      productCode = 'N0S';
      break;
    case 'sw':
      productCode = 'N0W';
      break;
    case 'cc':
    case 'min_cc':
      productCode = 'N0C';
      break;
    case 'zdr':
      productCode = 'N0X';
      break;
    case 'kdp':
      productCode = 'N0K';
      break;
    case 'tops':
      productCode = 'EET';
      break;
    case 'vil':
      productCode = 'DVL';
      break;
    case 'hhc':
      productCode = 'HHC';
      break;
    case 'qpe':
      productCode = 'DPR';
      break;
    case 'ref':
    case 'max_ref':
    case 'ref_x':
    default:
      productCode = tilt === '0.9' ? 'N1B' : tilt === '1.3' ? 'N2B' : tilt === '1.8' ? 'N3B' : 'N0B';
      break;
  }

  const radarId = site.radarId; // e.g. LZK (without K) or full ICAO depending on config
  const ridgeId = radarId.startsWith('K') ? radarId : `K${radarId}`;
  // IEM RIDGE uses short form without leading K in many cases; try both patterns
  const ridgeKey = ridgeId.replace(/^K/, '');

  const latestTileUrl = `${IEM_TILE}/ridge::${ridgeKey}-${productCode}-0/{z}/{x}/{y}.png`;
  const compositeTileUrl = `${IEM_TILE}/nexrad-n0q-900913/{z}/{x}/{y}.png`;

  const now = new Date();
  const frames: {
    time: string;
    label: string;
    tileUrl: string;
    ageMinutes: number;
    source: string;
  }[] = [];

  // Build ~50 min of 5-minute frames from IEM (same pattern as /api/nexrad/frames)
  for (let i = 10; i >= 1; i--) {
    const d = new Date(now.getTime() - i * 5 * 60 * 1000);
    d.setUTCMinutes(Math.floor(d.getUTCMinutes() / 5) * 5, 0, 0);
    const stamp = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(
      d.getUTCDate()
    ).padStart(2, '0')}${String(d.getUTCHours()).padStart(2, '0')}${String(d.getUTCMinutes()).padStart(2, '0')}`;
    const ageMinutes = Math.round((now.getTime() - d.getTime()) / 60000);

    frames.push({
      time: d.toISOString(),
      label: `-${ageMinutes}m`,
      tileUrl: `${IEM_TILE}/ridge::${ridgeKey}-${productCode}-${stamp}/{z}/{x}/{y}.png`,
      ageMinutes,
      source: 'IEM RIDGE',
    });
  }

  frames.push({
    time: now.toISOString(),
    label: 'LIVE',
    tileUrl: latestTileUrl,
    ageMinutes: 0,
    source: 'IEM RIDGE',
  });

  // Optional: probe RainViewer single-radar archive for this station (source images only).
  // RainViewer uses radar identifiers like KLZK; listing is HTML directory, so we only expose the base URL.
  const rainviewerBase = `https://data.rainviewer.com/images/${ridgeId}/`;
  let rainviewer: { available: boolean; baseUrl: string; note: string } = {
    available: false,
    baseUrl: rainviewerBase,
    note: 'Source images only (last 6, ≤48h). Processed frames discontinued by RainViewer.',
  };

  try {
    const rv = await fetch(rainviewerBase, {
      method: 'HEAD',
      signal: AbortSignal.timeout(4000),
    });
    rainviewer.available = rv.ok;
  } catch {
    // leave available: false
  }

  return NextResponse.json(
    {
      status: 'LIVE',
      provider: 'NOAA NEXRAD Level III via IEM RIDGE',
      station: ridgeId,
      siteId: site.id,
      product: productCode,
      productKey,
      tilt,
      frames,
      latestTileUrl,
      compositeTileUrl,
      rainviewer,
      _meta: {
        fetchedAt: new Date().toISOString(),
        ok: true,
        note: 'Terminal (single-station) radar. Map tiles come from IEM; RainViewer single-radar is source-image archive only.',
      },
    },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30',
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
}
