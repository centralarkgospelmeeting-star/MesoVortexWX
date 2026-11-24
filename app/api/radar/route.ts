import { NextRequest, NextResponse } from 'next/server';
import { RADAR_SITES } from '../../../lib/radar-config';
import { getRadarCapability } from '../../../lib/radar/capability-matrix';

export const dynamic = 'force-dynamic';

const IEM_TILE = 'https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0';

type ProductAlias = { id: string };

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
  const capId = typeof extra.capabilityId === 'string' ? extra.capabilityId : undefined;
  const cap = capId ? getRadarCapability(capId) : undefined;
  return NextResponse.json(
    {
      data: null,
      available: false,
      error: reason,
      reason,
      playbackSupport: cap?.playbackSupport ?? 'NONE',
      archiveSupport: cap?.archiveSupport ?? 'UNKNOWN',
      verificationLevel: cap?.verification.level ?? 'UNVERIFIED',
      ...extra,
    },
    { status: 404, headers: { 'Cache-Control': 'no-store' } }
  );
}

/**
 * GET /api/radar?site=KLZK&product=ref&tilt=0.5
 *
 * Real single-station radar frames. Capability matrix is authoritative.
 * No silent substitutions. No fake playback.
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

  const isTdwr = site.network === 'TDWR';
  const sector = isTdwr ? `T${site.radarId}` : site.radarId;

  const normalized = normalizeProduct(productKey);
  if (!normalized) return unavailable(`DATA UNAVAILABLE - Unknown radar product "${productKey}".`, { productKey });
  const cap = getRadarCapability(normalized.id);
  if (!cap) return unavailable(`DATA UNAVAILABLE - Unknown radar product "${productKey}".`, { productKey });

  if (cap.availability === 'UNAVAILABLE' || cap.availability === 'RESTRICTED') {
    return unavailable(cap.unavailableReason || `DATA UNAVAILABLE - ${cap.name} is not available.`, {
      productKey, capabilityId: cap.id, availability: cap.availability,
    });
  }
  if (isTdwr && !cap.networks.includes('TDWR')) {
    return unavailable(`DATA UNAVAILABLE - ${cap.name} is not supported for TDWR site ${site.id}.`, { productKey, capabilityId: cap.id });
  }

  let productCode = 'N0B';
  let archiveSupported = false;
  if (isTdwr) {
    if (normalized.id === 'ref') { productCode = 'TZL'; archiveSupported = false; }
    else if (normalized.id === 'vel') { productCode = 'TV0'; archiveSupported = false; }
    else return unavailable(`DATA UNAVAILABLE - ${cap.name} is not supported for TDWR site ${site.id}.`, { productKey, capabilityId: cap.id });
  } else {
    switch (normalized.id) {
      case 'ref':
        productCode = tilt === '0.9' ? 'N1B' : tilt === '1.3' ? 'N2B' : tilt === '1.8' ? 'N3B' : 'N0B';
        archiveSupported = productCode === 'N0B';
        break;
      case 'vel':
        productCode = tilt === '0.9' ? 'N1U' : tilt === '1.3' ? 'N2U' : tilt === '1.8' ? 'N3U' : 'N0U';
        archiveSupported = false;
        break;
      case 'srvel':
        productCode = 'N0S';
        archiveSupported = true;
        break;
      case 'cc':
      case 'zdr':
      case 'kdp':
        if (!cap.tiltSupport.includes(tilt)) {
          return unavailable(`DATA UNAVAILABLE - Elevation ${tilt}° is not supported for ${cap.name}.`, { productKey, capabilityId: cap.id, tilt });
        }
        productCode = cap.id === 'cc' ? 'RHO' : cap.id === 'zdr' ? 'ZDR' : 'KDP (derived from PHI)';
        break;
      default:
        return unavailable(cap.unavailableReason || `DATA UNAVAILABLE - ${cap.name} is not available.`, { productKey, capabilityId: cap.id });
    }
  }

  const playbackSupport = archiveSupported ? (cap.archiveSupport === 'PARTIAL' || cap.archiveSupport === 'PARTIAL_ARCHIVE' ? 'PARTIAL_ARCHIVE' : 'REAL_ARCHIVE') : 'LIVE_ONLY';
  const dualPol = normalized.id === 'cc' || normalized.id === 'zdr' || normalized.id === 'kdp';
  const latestTileUrl = dualPol
    ? `/api/radar/level2-tile?site=${encodeURIComponent(site.id)}&product=${normalized.id}&tilt=${encodeURIComponent(tilt)}&z={z}&x={x}&y={y}`
    : `${IEM_TILE}/ridge::${sector}-${productCode}-0/{z}/{x}/{y}.png`;
  const compositeTileUrl = `${IEM_TILE}/nexrad-n0q-900913/{z}/{x}/{y}.png`;
  const now = new Date();
  const frames: { time: string; label: string; tileUrl: string; ageMinutes: number; source: string }[] = [];

  if (playbackSupport === 'REAL_ARCHIVE' || playbackSupport === 'PARTIAL_ARCHIVE') {
    for (let i = 10; i >= 1; i--) {
      const d = new Date(now.getTime() - i * 5 * 60 * 1000);
      d.setUTCMinutes(Math.floor(d.getUTCMinutes() / 5) * 5, 0, 0);
      const stamp = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}${String(d.getUTCHours()).padStart(2, '0')}${String(d.getUTCMinutes()).padStart(2, '0')}`;
      const ageMinutes = Math.round((now.getTime() - d.getTime()) / 60000);
      frames.push({ time: d.toISOString(), label: `-${ageMinutes}m`, tileUrl: `${IEM_TILE}/ridge::${sector}-${productCode}-${stamp}/{z}/{x}/{y}.png`, ageMinutes, source: 'IEM RIDGE' });
    }
  }
  frames.push({ time: now.toISOString(), label: 'LIVE', tileUrl: latestTileUrl, ageMinutes: 0, source: 'IEM RIDGE' });

  const notes: string[] = [];
  if (playbackSupport === 'LIVE_ONLY') notes.push(`LIVE ONLY - Historical loop not verified for ${cap.name} (${productCode}). No fake historical frames generated.`);
  else if (playbackSupport === 'PARTIAL_ARCHIVE') notes.push(`PARTIAL ARCHIVE - Historical frames are real when available, but archive coverage is sparse/unverified across sites/times. No fake frames generated.`);
  if (cap.availability === 'PARTIAL') notes.push(`PARTIAL - ${cap.name} is available with limited verification.`);
  return NextResponse.json(
    {
      data: frames,
      available: true,
      reason: notes.length ? notes.join(' ') : null,
      playbackSupport,
      archiveSupport: cap.archiveSupport,
      verificationLevel: cap.verification.level,
      status: 'LIVE',
      provider: isTdwr ? 'FAA TDWR / IEM RIDGE' : dualPol ? 'NOAA NEXRAD Level II (single radar)' : 'NOAA NEXRAD Level III via IEM RIDGE',
      station: site.radarId,
      siteId: site.id,
      product: productCode,
      productKey,
      capabilityId: cap.id,
      tilt,
      frames,
      latestTileUrl,
      compositeTileUrl,
      loopAvailable: playbackSupport === 'REAL_ARCHIVE' || playbackSupport === 'PARTIAL_ARCHIVE',
      notes: notes.length ? notes : undefined,
      _meta: { fetchedAt: now.toISOString(), ok: true, dataHonesty: 'capability-matrix' },
    },
    { headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30', 'Access-Control-Allow-Origin': '*' } }
  );
}
