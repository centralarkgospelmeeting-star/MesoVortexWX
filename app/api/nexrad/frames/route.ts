import { NextResponse } from 'next/server';
import { RADAR_SITES } from '../../../../lib/radar-config';
import { getRadarCapability } from '../../../../lib/radar/capability-matrix';

export const dynamic = 'force-dynamic';

const IEM_TILE = 'https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0';

type ProductAlias = {
  id: string;
  archiveAllowed?: boolean; // override when we know archive is real for this exact code
};

function normalizeProduct(productKey: string): ProductAlias | null {
  const key = productKey.toLowerCase();
  if (key === 'ref' || key === 'max_ref' || key === 'ref_x') return { id: 'ref' };
  if (key === 'vel') return { id: 'vel' };
  if (key === 'srvel') return { id: 'srvel' };
  if (key === 'norm_vel' || key === 'nrot') return { id: 'nrot' };
  if (key === 'min_cc') return { id: 'min_cc' };
  if (key === 'cc') return { id: 'cc' };
  if (key === 'zdr') return { id: 'zdr' };
  if (key === 'kdp') return { id: 'kdp' };
  if (key === 'sw') return { id: 'sw' };
  if (key === 'hhc') return { id: 'hhc' };
  if (key === 'qpe') return { id: 'qpe' };
  if (key === 'azshear') return { id: 'azshear' };
  if (key === 'mesh') return { id: 'mesh' };
  if (key === 'tops') return { id: 'tops' };
  if (key === 'vil') return { id: 'vil' };
  return null;
}

function unavailable(reason: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json(
    { available: false, error: reason, reason, ...extra },
    { status: 404, headers: { 'Cache-Control': 'no-store' } }
  );
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

  const isTdwr = site.network === 'TDWR';
  const sector = isTdwr ? `T${site.radarId}` : site.radarId;

  const normalized = normalizeProduct(productKey);
  if (!normalized) {
    return unavailable(`DATA UNAVAILABLE - Unknown radar product "${productKey}".`, { productKey });
  }

  const cap = getRadarCapability(normalized.id);
  if (!cap) {
    return unavailable(`DATA UNAVAILABLE - Unknown radar product "${productKey}".`, { productKey });
  }

  // Data honesty: capability matrix is authoritative.
  if (cap.availability === 'UNAVAILABLE' || cap.availability === 'RESTRICTED') {
    return unavailable(cap.unavailableReason || `DATA UNAVAILABLE - ${cap.name} is not available.`, {
      productKey,
      capabilityId: cap.id,
      availability: cap.availability,
    });
  }

  if (isTdwr && !cap.networks.includes('TDWR')) {
    return unavailable(`DATA UNAVAILABLE - ${cap.name} is not supported for TDWR site ${site.id}.`, {
      productKey,
      capabilityId: cap.id,
      network: 'TDWR',
    });
  }

  if (!isTdwr && !cap.networks.includes('NEXRAD')) {
    return unavailable(`DATA UNAVAILABLE - ${cap.name} is not supported for NEXRAD site ${site.id}.`, {
      productKey,
      capabilityId: cap.id,
      network: 'NEXRAD',
    });
  }

  // Resolve actual IEM product code. Only verified mappings allowed.
  let productCode = 'N0B';
  let archiveSupported = false;

  if (isTdwr) {
    if (normalized.id === 'ref') {
      productCode = 'TZL';
      archiveSupported = false; // not verified as archived in this pipeline
    } else if (normalized.id === 'vel') {
      productCode = 'TV0';
      archiveSupported = false;
    } else {
      return unavailable(`DATA UNAVAILABLE - ${cap.name} is not supported for TDWR site ${site.id}.`, {
        productKey,
        capabilityId: cap.id,
        network: 'TDWR',
      });
    }
  } else {
    switch (normalized.id) {
      case 'ref':
        productCode = tilt === '0.9' ? 'N1B' : tilt === '1.3' ? 'N2B' : tilt === '1.8' ? 'N3B' : 'N0B';
        archiveSupported = productCode === 'N0B';
        break;
      case 'vel':
        productCode = tilt === '0.9' ? 'N1U' : tilt === '1.3' ? 'N2U' : tilt === '1.8' ? 'N3U' : 'N0U';
        archiveSupported = false; // not verified as reliable archived ridge tiles in this pipeline
        break;
      case 'srvel':
        productCode = 'N0S';
        archiveSupported = true;
        break;
      default:
        return unavailable(cap.unavailableReason || `DATA UNAVAILABLE - ${cap.name} is not available.`, {
          productKey,
          capabilityId: cap.id,
        });
    }
  }

  // Capability matrix playback rule: if archive not supported, LIVE_ONLY single frame.
  const playbackSupport = archiveSupported ? 'REAL_ARCHIVE' : 'LIVE_ONLY';
  const latestTileUrl = `${IEM_TILE}/ridge::${sector}-${productCode}-0/{z}/{x}/{y}.png`;
  const compositeTileUrl = `${IEM_TILE}/nexrad-n0q-900913/{z}/{x}/{y}.png`;

  const now = new Date();
  const frames: { time: string; label: string; tileUrl: string; ageMinutes: number }[] = [];

  if (playbackSupport === 'REAL_ARCHIVE') {
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

  frames.push({ time: now.toISOString(), label: 'LIVE', tileUrl: latestTileUrl, ageMinutes: 0 });

  const notes: string[] = [];
  if (playbackSupport === 'LIVE_ONLY') {
    notes.push(`LIVE ONLY - Historical loop not verified for ${cap.name} (${productCode}) from this source. No fake historical frames generated.`);
  }
  if (cap.availability === 'PARTIAL') {
    notes.push(`PARTIAL - ${cap.name} is available with limited verification.`);
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
      capabilityId: cap.id,
      tilt,
      available: true,
      loopAvailable: playbackSupport === 'REAL_ARCHIVE',
      playbackSupport,
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
