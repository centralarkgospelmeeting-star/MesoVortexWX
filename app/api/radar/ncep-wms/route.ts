import { getRadarCapability } from '../../../../lib/radar/capability-matrix';

export const dynamic = 'force-dynamic';

// Proxy for verified NCEP opengeo per-radar WMS products (data honesty: only capability-gated mappings).
const NCEP = 'https://opengeo.ncep.noaa.gov/geoserver';

function unavailable(reason: string, cap?: any) {
  return new Response(JSON.stringify({ data: null, available: false, reason, error: reason, playbackSupport: cap?.playbackSupport ?? 'NONE', archiveSupport: cap?.archiveSupport ?? 'UNKNOWN', verificationLevel: cap?.verification?.level ?? 'UNVERIFIED' }), {
    status: 404, headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json' },
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const product = String(searchParams.get('product') || '').toLowerCase();
  const site = String(searchParams.get('site') || 'LZK').toUpperCase().replace(/^K/, '');
  const bbox = searchParams.get('bbox');
  const width = searchParams.get('width') || '256';
  const height = searchParams.get('height') || '256';
  const time = searchParams.get('time') || '';

  const cap = getRadarCapability(product);
  if (!cap) return unavailable(`DATA UNAVAILABLE - Unknown radar product "${product}".`);
  if (cap.availability === 'UNAVAILABLE' || cap.availability === 'RESTRICTED') {
    return unavailable(cap.unavailableReason || `DATA UNAVAILABLE - ${cap.name} unavailable.`, cap);
  }

  // Verified mapping: HHC -> NCEP opengeo BDHC (Digital Hydrometeor Classification)
  if (product !== 'hhc') return unavailable(`DATA UNAVAILABLE - ${cap.name} not available via NCEP WMS proxy.`, cap);
  if (!bbox) return unavailable('DATA UNAVAILABLE - Missing bbox.');

  const workspace = `k${site.toLowerCase()}`;
  const layer = `${workspace}_bdhc`;
  const params = new URLSearchParams({
    service: 'WMS', version: '1.1.1', request: 'GetMap',
    layers: `${workspace}:${layer}`,
    styles: '',
    bbox, width, height,
    srs: 'EPSG:3857',
    format: 'image/png',
    transparent: 'true',
  });
  if (time) params.set('time', time);
  const url = `${NCEP}/${workspace}/ows?${params.toString()}`;

  try {
    const upstream = await fetch(url, { cache: 'no-store', headers: { 'User-Agent': 'MesoVortexWX/1.0' } });
    if (!upstream.ok) return unavailable(`DATA UNAVAILABLE - NCEP WMS returned ${upstream.status} for ${cap.name}.`, cap);
    const ct = upstream.headers.get('content-type') || '';
    const buf = await upstream.arrayBuffer();
    if (!ct.includes('image')) return unavailable(`DATA UNAVAILABLE - NCEP WMS returned non-image for ${cap.name}.`, cap);
    return new Response(buf, {
      status: 200,
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=60', 'X-MesoVortex-Product': 'hhc', 'X-MesoVortex-Source': 'NCEP-opengeo-BDHC' },
    });
  } catch (e: any) {
    return unavailable(`DATA UNAVAILABLE - NCEP WMS fetch failed for ${cap.name}.`, cap);
  }
}
