import { getRadarCapability } from '../../../../lib/radar/capability-matrix';

export const dynamic = 'force-dynamic';

// Radar tile proxy. Capability matrix is authoritative.
// DATA HONESTY: no silent substitutes, no fallback to unrelated products, no synthetic tiles.
const IEM = 'https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0';

function normalizeProduct(productKey: string): string | null {
  const key = productKey.toLowerCase();
  if (key === 'ref' || key === 'max_ref' || key === 'ref_x') return 'ref';
  if (key === 'vel') return 'vel';
  if (key === 'srvel') return 'srvel';
  if (key === 'norm_vel' || key === 'nrot') return 'nrot';
  if (key === 'min_cc') return 'min_cc';
  if (key === 'cc') return 'cc';
  if (key === 'zdr') return 'zdr';
  if (key === 'kdp') return 'kdp';
  if (key === 'sw') return 'sw';
  if (key === 'hhc') return 'hhc';
  if (key === 'qpe') return 'qpe';
  if (key === 'azshear') return 'azshear';
  if (key === 'mesh') return 'mesh';
  if (key === 'tops') return 'tops';
  if (key === 'vil') return 'vil';
  return null;
}

function unavailableResponse(
  reason: string,
  cap?: { playbackSupport?: string; archiveSupport?: string; verification?: { level?: string } } | null
) {
  return new Response(
    JSON.stringify({
      data: null,
      available: false,
      reason,
      error: reason,
      playbackSupport: cap?.playbackSupport ?? 'NONE',
      archiveSupport: cap?.archiveSupport ?? 'UNKNOWN',
      verificationLevel: cap?.verification?.level ?? 'UNVERIFIED',
    }),
    {
      status: 404,
      headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json', 'X-MesoVortex-Data': 'unavailable' },
    }
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const product = String(searchParams.get('product') || 'ref');
  const site = String(searchParams.get('site') || 'LZK').toUpperCase().replace(/^K/, '') || 'LZK';
  const tilt = String(searchParams.get('tilt') || '0.5');
  const z = searchParams.get('z');
  const x = searchParams.get('x');
  const y = searchParams.get('y');

  if (!z || !x || !y) return unavailableResponse('DATA UNAVAILABLE - Missing tile coordinates.');

  const normalized = normalizeProduct(product);
  if (!normalized) return unavailableResponse(`DATA UNAVAILABLE - Unknown radar product "${product}".`);

  const cap = getRadarCapability(normalized);
  if (!cap) return unavailableResponse(`DATA UNAVAILABLE - Unknown radar product "${product}".`);
  if (cap.availability === 'UNAVAILABLE' || cap.availability === 'RESTRICTED') {
    return unavailableResponse(cap.unavailableReason || `DATA UNAVAILABLE - ${cap.name} is not available.`, cap);
  }

  // Only verified, honest mappings. No substitutes, no unrelated fallbacks.
  const candidates: string[] = [];
  if (normalized === 'ref') {
    let code = 'N0B';
    if (tilt === '0.9') code = 'N1B';
    if (tilt === '1.3') code = 'N2B';
    if (tilt === '1.8') code = 'N3B';
    candidates.push(`${IEM}/ridge::${site}-${code}-0/${z}/${x}/${y}.png`);
  } else if (normalized === 'vel') {
    let code = 'N0U';
    if (tilt === '0.9') code = 'N1U';
    if (tilt === '1.3') code = 'N2U';
    if (tilt === '1.8') code = 'N3U';
    candidates.push(`${IEM}/ridge::${site}-${code}-0/${z}/${x}/${y}.png`);
  } else if (normalized === 'srvel') {
    candidates.push(`${IEM}/ridge::${site}-N0S-0/${z}/${x}/${y}.png`);
  } else {
    return unavailableResponse(cap.unavailableReason || `DATA UNAVAILABLE - ${cap.name} is not available.`, cap);
  }

  for (const url of candidates) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3500);
      const upstream = await fetch(url, { signal: controller.signal, cache: 'no-store' });
      clearTimeout(timer);
      if (upstream.ok) {
        const buffer = await upstream.arrayBuffer();
        return new Response(buffer, {
          status: 200,
          headers: {
            'Content-Type': upstream.headers.get('Content-Type') || 'image/png',
            'Cache-Control': 'public, max-age=120',
            'X-MesoVortex-Product': normalized,
          },
        });
      }
    } catch {
      // try next candidate
    }
  }

  return unavailableResponse(`DATA UNAVAILABLE - No verified tile source responded for ${cap.name}.`, cap);
}
