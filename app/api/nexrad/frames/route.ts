import { NextResponse } from 'next/server';
import { RADAR_SITES } from '../../../../lib/radar-config';

export const dynamic = 'force-dynamic';

const IEM_TILE = 'https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const siteId = (searchParams.get('site') ?? 'KLZK').toUpperCase();
  const productKey = (searchParams.get('product') ?? 'ref').toLowerCase();
  const tilt = searchParams.get('tilt') ?? '0.5';

  const site =
    RADAR_SITES.find((s) => s.id === siteId || s.radarId === siteId) ||
    RADAR_SITES.find((s) => s.radarId === siteId.replace(/^K/, '')) ||
    RADAR_SITES[0];

  const isTdwr = site.network === 'TDWR';
  // IEM ridge sectors: NEXRAD uses the 3-letter callsign (LZK), TDWR uses the
  // T-prefixed sector id (TATL).
  const sector = isTdwr ? `T${site.radarId}` : site.radarId;

  let productCode = 'N0B';
  // Products IEM actually archives (timestamped history tiles exist).
  let archiveSupported = false;

  if (isTdwr) {
    // TDWR publishes only base reflectivity (TZL) and base velocity (TV0).
    switch (productKey) {
      case 'ref':
      case 'max_ref':
      case 'ref_x':
        productCode = 'TZL';
        break;
      case 'vel':
      case 'srvel':
      case 'norm_vel':
        productCode = 'TV0';
        break;
      default:
        return NextResponse.json(
          {
            error: `Product "${productKey}" is not published for TDWR site ${site.id}.`,
            available: false,
            network: 'TDWR',
            supportedProducts: ['ref', 'max_ref', 'ref_x', 'vel', 'srvel', 'norm_vel'],
          },
          { status: 404 }
        );
    }
  } else {
    const UNVERIFIED: Record<string, string> = {
      norm_vel: 'DATA UNAVAILABLE - no verified normalized rotation/shear source; current IEM mapping duplicates base velocity (N0U).',
      sw: 'DATA UNAVAILABLE - Spectrum Width (N0W) not verified as rendering from current IEM ridge source.',
      cc: 'DATA UNAVAILABLE - Correlation Coefficient (N0C) not verified as rendering from current IEM ridge source.',
      min_cc: 'DATA UNAVAILABLE - Min CC has no verified real source.',
      zdr: 'DATA UNAVAILABLE - Differential Reflectivity (N0X) not verified as rendering from current IEM ridge source.',
      kdp: 'DATA UNAVAILABLE - Specific Differential Phase (N0K) not verified as rendering from current IEM ridge source.',
      hhc: 'DATA UNAVAILABLE - Hydrometeor Classification has no verified real IEM ridge tile endpoint.',
      qpe: 'DATA UNAVAILABLE - 1-Hour Precipitation (DPR/QPE) has no verified real IEM ridge tile endpoint.',
    };
    if (UNVERIFIED[productKey]) {
      return NextResponse.json(
        { error: UNVERIFIED[productKey], available: false, productKey, reason: UNVERIFIED[productKey] },
        { status: 404 }
      );
    }

    switch (productKey) {
      case 'vel':
        productCode = tilt === '0.9' ? 'N1U' : tilt === '1.3' ? 'N2U' : tilt === '1.8' ? 'N3U' : 'N0U';
        break;
      case 'srvel':
        productCode = 'N0S';
        archiveSupported = true;
        break;
      case 'tops':
        productCode = 'NET'; // Verified IEM product code for Net Echo Tops
        break;
      case 'vil':
        productCode = 'N0Z'; // Verified IEM product code for Vertically Integrated Liquid
        break;
      case 'ref':
      case 'max_ref':
      case 'ref_x':
        productCode = tilt === '0.9' ? 'N1B' : tilt === '1.3' ? 'N2B' : tilt === '1.8' ? 'N3B' : 'N0B';
        archiveSupported = productCode === 'N0B';
        break;
      default:
        // Strictly refuse to return fake reflectivity fallback
        return NextResponse.json(
          { error: `Product "${productKey}" is not available.`, available: false },
          { status: 404 }
        );
    }
  }

  const latestTileUrl = `${IEM_TILE}/ridge::${sector}-${productCode}-0/{z}/{x}/{y}.png`;
  const compositeTileUrl = `${IEM_TILE}/nexrad-n0q-900913/{z}/{x}/{y}.png`;

  const now = new Date();
  const frames: { time: string; label: string; tileUrl: string; ageMinutes: number }[] = [];

  // Only emit timestamped history frames for products IEM actually archives.
  // For every other product the archived tiles return HTTP 503, which would
  // surface as a false "Tile Error (503)" in the client.
  if (archiveSupported) {
    for (let i = 10; i >= 1; i--) {
      const d = new Date(now.getTime() - i * 5 * 60 * 1000);
      d.setUTCMinutes(Math.floor(d.getUTCMinutes() / 5) * 5, 0, 0);
      const stamp = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}${String(d.getUTCHours()).padStart(2, '0')}${String(d.getUTCMinutes()).padStart(2, '0')}`;
      const ageMinutes = Math.round((now.getTime() - d.getTime()) / 60000);

      frames.push({
        time: d.toISOString(),
        label: `-${ageMinutes}m`,
        tileUrl: `${IEM_TILE}/ridge::${sector}-${productCode}-${stamp}/{z}/{x}/{y}.png`,
        ageMinutes,
      });
    }
  }

  frames.push({
    time: now.toISOString(),
    label: 'LIVE',
    tileUrl: latestTileUrl,
    ageMinutes: 0,
  });

  const notes: string[] = [];
  if (!archiveSupported) {
    notes.push(
      `Historical loop is not available for ${productKey} from this source (IEM ridge does not archive ${productCode}). Only the live scan is served.`
    );
  }

  return NextResponse.json(
    {
      provider: isTdwr ? 'FAA TDWR / IEM RIDGE' : 'NOAA NEXRAD Level III / IEM RIDGE',
      station: site.radarId,
      sector,
      network: site.network,
      siteId: site.id,
      product: productCode,
      productKey,
      tilt,
      available: true,
      loopAvailable: archiveSupported,
      notes: notes.length ? notes : undefined,
      frames,
      latestTileUrl,
      compositeTileUrl,
    },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30',
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
}
