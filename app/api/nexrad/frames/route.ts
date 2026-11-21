import { NextResponse } from 'next/server';
import { RADAR_SITES } from '../../../../lib/radar-config';

export const dynamic = 'force-dynamic';

const IEM_TILE = 'https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0';

/** IEM RIDGE uses 3-letter ids (LZK), never ICAO (KLZK) */
function toRidgeId(raw: string): string {
  return (raw || 'LZK').toUpperCase().replace(/^K/, '') || 'LZK';
}

function productCodeFor(productKey: string, tilt: string): string | null {
  const p = productKey.toLowerCase();
  switch (p) {
    case 'vel':
    case 'norm_vel':
      if (tilt === '0.9') return 'N1U';
      if (tilt === '1.3') return 'N2U';
      if (tilt === '1.8') return 'N3U';
      return 'N0U';
    case 'srvel':
      return 'N0S';
    case 'sw':
      return 'N0W';
    case 'cc':
    case 'min_cc':
      return 'N0C';
    case 'zdr':
      return 'N0X';
    case 'kdp':
      return 'N0K';
    case 'tops':
      // Net Echo Tops on IEM RIDGE
      return 'NET';
    case 'vil':
      // Digital VIL when available; N0Z is a verified fallback path on some sites
      return 'DVL';
    case 'hhc':
      return 'HHC';
    case 'qpe':
      return 'DPR';
    case 'ref':
    case 'max_ref':
    case 'ref_x':
      if (tilt === '0.9') return 'N1B';
      if (tilt === '1.3') return 'N2B';
      if (tilt === '1.8') return 'N3B';
      return 'N0B';
    default:
      return null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const siteId = (searchParams.get('site') ?? 'KLZK').toUpperCase();
  const productKey = (searchParams.get('product') ?? 'ref').toLowerCase();
  const tilt = searchParams.get('tilt') ?? '0.5';

  const site =
    RADAR_SITES.find((s) => s.id === siteId || s.radarId === siteId) ||
    RADAR_SITES.find((s) => s.radarId === siteId.replace(/^K/, '')) ||
    RADAR_SITES[0];

  const productCode = productCodeFor(productKey, tilt);
  if (!productCode) {
    return NextResponse.json(
      { error: `Product "${productKey}" is not available.`, available: false },
      { status: 404 }
    );
  }

  const ridgeId = toRidgeId(site.radarId || site.id);
  const latestTileUrl = `${IEM_TILE}/ridge::${ridgeId}-${productCode}-0/{z}/{x}/{y}.png`;
  const compositeTileUrl = `${IEM_TILE}/nexrad-n0q-900913/{z}/{x}/{y}.png`;

  const now = new Date();
  const frames: { time: string; label: string; tileUrl: string; ageMinutes: number }[] = [];

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
      tileUrl: `${IEM_TILE}/ridge::${ridgeId}-${productCode}-${stamp}/{z}/{x}/{y}.png`,
      ageMinutes,
    });
  }

  frames.push({
    time: now.toISOString(),
    label: 'LIVE',
    tileUrl: latestTileUrl,
    ageMinutes: 0,
  });

  return NextResponse.json(
    {
      provider: 'NOAA NEXRAD Level III / IEM RIDGE',
      station: ridgeId,
      siteId: site.id,
      product: productCode,
      productKey,
      tilt,
      available: true,
      frames,
      latestTileUrl,
      compositeTileUrl,
    },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=3, stale-while-revalidate=10',
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
}
