import { NextResponse } from 'next/server';
import { RADAR_SITES } from '../../../../lib/radar-config';
import { canonicalRadarProductId, getRadarCapability } from '../../../../lib/radar/capability-matrix';

export const dynamic = 'force-dynamic';

const IEM_TILE = 'https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0';

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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const siteId = (searchParams.get('site') ?? 'KLZK').toUpperCase();
  const productKey = (searchParams.get('product') ?? 'ref').toLowerCase();
  const tilt = searchParams.get('tilt') ?? '0.5';

  const site =
    RADAR_SITES.find((s) => s.id === siteId || s.radarId === siteId) ||
    RADAR_SITES.find((s) => s.radarId === siteId.replace(/^K/, ''));

  if (!site) {
    return unavailable(`DATA UNAVAILABLE - Unknown radar site "${siteId}".`, { siteId });
  }

  const isTdwr = site.network === 'TDWR';
  const sector = isTdwr ? `T${site.radarId}` : site.radarId;

  const canonicalId = canonicalRadarProductId(productKey);
  // These are derived UI products. The map deliberately requests the real REF
  // input when it computes them, but the raw frames API must not alias them to REF.
  if (canonicalId === 'max_ref' || canonicalId === 'ref_x') {
    return unavailable(`DATA UNAVAILABLE - ${canonicalId} is derived in the map from real REF frames.`, {
      productKey,
      capabilityId: canonicalId,
    });
  }

  const cap = getRadarCapability(canonicalId);
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

  // Resolve an explicitly verified source. Products with separate providers
  // keep their distinct semantics; they are never aliased to REF or N0Q.
  let productCode = 'N0B';
  let latestTileUrl = '';
  let provider = isTdwr ? 'FAA TDWR / IEM RIDGE' : 'NOAA NEXRAD Level III / IEM RIDGE';

  if (isTdwr) {
    if (cap.id === 'ref') {
      productCode = 'TZL';
    } else if (cap.id === 'vel') {
      productCode = 'TV0';
    } else {
      return unavailable(`DATA UNAVAILABLE - ${cap.name} is not supported for TDWR site ${site.id}.`, {
        productKey,
        capabilityId: cap.id,
        network: 'TDWR',
      });
    }
    latestTileUrl = `${IEM_TILE}/ridge::${sector}-${productCode}-0/{z}/{x}/{y}.png`;
  } else if (cap.id === 'hhc') {
    productCode = 'BDHC';
    provider = 'NOAA NCEP opengeo WMS (RIDGEII BDHC)';
    latestTileUrl = `/api/radar/ncep-wms?product=hhc&site=${encodeURIComponent(sector)}&bbox={bbox-epsg-3857}&width=256&height=256`;
  } else if (cap.id === 'cc' || cap.id === 'zdr' || cap.id === 'kdp') {
    if (!cap.tiltSupport.includes(tilt)) {
      return unavailable(`DATA UNAVAILABLE - Elevation ${tilt}° is not supported for ${cap.name}.`, {
        productKey,
        capabilityId: cap.id,
        tilt,
      });
    }
    productCode = cap.id === 'cc' ? 'RHO' : cap.id === 'zdr' ? 'ZDR' : 'KDP (derived from PHI)';
    provider = 'NOAA NEXRAD Level II (single radar)';
    latestTileUrl = `/api/radar/level2-tile?site=${encodeURIComponent(site.id)}&product=${cap.id}&tilt=${encodeURIComponent(tilt)}&z={z}&x={x}&y={y}`;
  } else if (cap.id === 'sw') {
    if (!cap.tiltSupport.includes(tilt)) {
      return unavailable(`DATA UNAVAILABLE - Elevation ${tilt}° is not supported for ${cap.name}.`, { productKey, capabilityId: cap.id, tilt });
    }
    productCode = 'SW (spectrum width moment)';
    provider = 'NOAA NEXRAD Level II (single radar)';
    latestTileUrl = `/api/radar/level2-tile?site=${encodeURIComponent(site.id)}&product=sw&tilt=${encodeURIComponent(tilt)}&z={z}&x={x}&y={y}`;
  } else if (cap.id === 'gate_to_gate_shear') {
    if (!cap.tiltSupport.includes(tilt)) {
      return unavailable(`DATA UNAVAILABLE - Elevation ${tilt}° is not supported for ${cap.name}.`, { productKey, capabilityId: cap.id, tilt });
    }
    productCode = 'Gate-to-gate velocity difference (derived)';
    provider = 'NOAA NEXRAD Level II velocity moment (derived)';
    latestTileUrl = `/api/radar/level2-tile?site=${encodeURIComponent(site.id)}&product=gate_to_gate_shear&tilt=${encodeURIComponent(tilt)}&z={z}&x={x}&y={y}`;
  } else if (cap.source.type === 'NOAA_AWS_MRMS') {
    productCode = cap.source.productCode || cap.id;
    provider = cap.source.provider;
    latestTileUrl = `/api/radar/mrms-tile?product=${encodeURIComponent(cap.id)}&z={z}&x={x}&y={y}`;
  } else {
    const verifiedTiltCodes: Record<string, Partial<Record<string, string>>> = {
      ref: { '0.5': 'N0B', '0.9': 'N1B', '1.3': 'N2B', '1.8': 'N3B' },
      vel: { '0.5': 'N0U', '0.9': 'N1U', '1.3': 'N2U', '1.8': 'N3U' },
      srvel: { '0.5': 'N0S' },
    };
    if (!cap.tiltSupport.includes(tilt)) {
      return unavailable(`DATA UNAVAILABLE - Tilt ${tilt} is not supported for ${cap.name}.`, {
        productKey,
        capabilityId: cap.id,
        tilt,
      });
    }

    switch (cap.id) {
      case 'ref':
      case 'vel':
      case 'srvel':
        productCode = verifiedTiltCodes[cap.id]?.[tilt] ?? '';
        if (!productCode) {
          return unavailable(`DATA UNAVAILABLE - No verified IEM code for ${cap.name} at ${tilt}° tilt.`, {
            productKey,
            capabilityId: cap.id,
            tilt,
          });
        }
        break;
      default:
        return unavailable(cap.unavailableReason || `DATA UNAVAILABLE - ${cap.name} is not available.`, {
          productKey,
          capabilityId: cap.id,
        });
    }
    latestTileUrl = `${IEM_TILE}/ridge::${sector}-${productCode}-0/{z}/{x}/{y}.png`;
  }

  // The active route serves live tiles only until a real scan-time index is wired in.
  const playbackSupport = 'LIVE_ONLY' as const;
  const compositeTileUrl = `${IEM_TILE}/nexrad-n0q-900913/{z}/{x}/{y}.png`;

  const now = new Date();
  // No archive scan-time index is verified in this active route yet. Return only
  // the live source so playback never points at guessed, usually-empty timestamps.
  const frames = [{ time: now.toISOString(), label: 'LIVE', tileUrl: latestTileUrl, ageMinutes: 0 }];

  const notes: string[] = [
    `LIVE ONLY - No verified scan-time index exists in the active route for ${cap.name} (${productCode}); no historical frames are fabricated.`,
  ];
  if (cap.availability === 'PARTIAL') {
    notes.push(`PARTIAL - ${cap.name} is available with limited verification.`);
  }

  return NextResponse.json(
    {
      data: frames,
      available: true,
      reason: notes.length ? notes.join(' ') : null,
      playbackSupport,
      archiveSupport: 'NONE',
      verificationLevel: cap.verification.level,
      provider,
      station: site.radarId,
      sector,
      network: site.network,
      siteId: site.id,
      product: productCode,
      productKey,
      capabilityId: cap.id,
      tilt,
      loopAvailable: false,
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
