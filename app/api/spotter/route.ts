import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function filterByRadius(features: any[], lat: number | null, lon: number | null, radiusKm: number): any[] {
  if (lat == null || lon == null || isNaN(lat) || isNaN(lon)) return features;
  return features.filter((f) => {
    const coords = f?.geometry?.coordinates;
    if (!coords || coords.length < 2) return false;
    return haversineKm(lat, lon, coords[1], coords[0]) <= radiusKm;
  });
}

function normalizeToGeoJSON(data: any): any[] {
  if (Array.isArray(data?.features)) return data.features;

  if (Array.isArray(data)) {
    return data
      .filter((r: any) => r.lat != null && (r.lon != null || r.lng != null))
      .map((r: any) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [Number(r.lon ?? r.lng), Number(r.lat)],
        },
        properties: {
          id: r.id ?? r.spotter_id ?? `sn-${Date.now()}-${Math.random()}`,
          name: r.name ?? r.callsign ?? r.handle ?? 'Spotter',
          callsign: r.callsign ?? r.handle,
          time: r.time ?? r.timestamp ?? r.reported_at ?? new Date().toISOString(),
          hazard: r.hazard ?? r.type ?? r.report_type,
          description: r.report ?? r.text ?? r.description ?? r.remark,
          magnitude: r.magnitude ?? r.hail_size ?? r.wind_speed,
          verified: r.verified ?? false,
          ...r,
        },
      }));
  }

  if (data?.spotters || data?.positions || data?.reports) {
    const list = data.spotters ?? data.positions ?? data.reports ?? [];
    return normalizeToGeoJSON(list);
  }

  return [];
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = (searchParams.get('mode') || 'positions').toLowerCase();
  const user = searchParams.get('user') || '';
  const pass = searchParams.get('pass') || '';
  const lat = searchParams.get('lat') ? Number(searchParams.get('lat')) : null;
  const lon = searchParams.get('lon') ? Number(searchParams.get('lon')) : null;
  const radiusKm = Number(searchParams.get('radiusKm') || 500);

  // ── A: IEM Local Storm Reports (always public — no auth needed) ──────────
  if (mode === 'lsr') {
    try {
      const hours = Number(searchParams.get('hours') || 3);
      const url = `https://mesonet.agron.iastate.edu/geojson/lsr.geojson?hours=${hours}`;
      const res = await fetch(url, { headers: { 'User-Agent': 'MesoVortexWX/1.0' } });
      if (!res.ok) throw new Error(`IEM LSR returned ${res.status}`);
      const data = await res.json();

      let features = (data.features || []).map((f: any) => ({
        type: 'Feature',
        geometry: f.geometry,
        properties: {
          id: `lsr-${f.properties?.wfo}-${f.properties?.valid}-${Math.random()}`,
          name: f.properties?.source || 'LSR Report',
          callsign: f.properties?.source,
          time: f.properties?.valid,
          hazard: f.properties?.typetext || f.properties?.type,
          description: f.properties?.remark,
          magnitude: f.properties?.magnitude
            ? `${f.properties.magnitude}${f.properties.magf ? ' ' + f.properties.magf : ''}`
            : undefined,
          verified: true,
        },
      }));

      features = filterByRadius(features, lat, lon, radiusKm);

      return NextResponse.json({
        type: 'FeatureCollection',
        features,
        meta: { source: 'IEM LSR', mode: 'lsr', count: features.length, fetchedAt: new Date().toISOString() },
      });
    } catch (err: any) {
      return NextResponse.json({
        type: 'FeatureCollection',
        features: [],
        meta: { source: 'IEM LSR', mode: 'lsr', count: 0, error: String(err?.message || err), fetchedAt: new Date().toISOString() },
      });
    }
  }

  // ── B: Spotter Network API (requires credentials) ─────────────────────────
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'User-Agent': 'MesoVortexWX/1.0',
    'Cache-Control': 'no-cache',
  };

  // Basic-auth if credentials provided
  if (user && pass) {
    headers['Authorization'] = `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
  }

  // Try multiple known Spotter Network endpoint patterns
  const endpointCandidates =
    mode === 'reports'
      ? [
          'https://www.spotternetwork.org/feeds/reports.json',
          'https://www.spotternetwork.org/api/reports',
          'https://www.spotternetwork.org/feeds/gr_reports.txt',
        ]
      : [
          'https://www.spotternetwork.org/feeds/positions.json',
          'https://www.spotternetwork.org/api/spotters',
          'https://www.spotternetwork.org/feeds/gr.txt',
        ];

  let features: any[] = [];
  let usedEndpoint = '';
  let fetchError = '';

  for (const endpoint of endpointCandidates) {
    try {
      const res = await fetch(endpoint, { headers, signal: AbortSignal.timeout(8000) });
      if (!res.ok) continue;

      const contentType = res.headers.get('content-type') || '';
      let data: any;

      if (contentType.includes('json')) {
        data = await res.json();
        features = normalizeToGeoJSON(data);
      } else {
        // Plain-text GR feed — parse tab-separated format
        const text = await res.text();
        features = parseGRFeed(text, mode);
      }

      if (features.length >= 0) {
        usedEndpoint = endpoint;
        break;
      }
    } catch (err: any) {
      fetchError = String(err?.message || err);
      continue;
    }
  }

  // Filter by radius
  features = filterByRadius(features, lat, lon, radiusKm);

  return NextResponse.json({
    type: 'FeatureCollection',
    features,
    meta: {
      source: 'Spotter Network',
      mode,
      count: features.length,
      endpoint: usedEndpoint || 'none',
      authenticated: !!(user && pass),
      fetchedAt: new Date().toISOString(),
      ...(fetchError && features.length === 0 ? { warning: fetchError } : {}),
    },
  });
}

// ─── GR Text Feed Parser ──────────────────────────────────────────────────────
// Spotter Network's GR-compatible feed is tab-separated with lat/lon fields

function parseGRFeed(text: string, mode: string): any[] {
  const lines = text.split('\n').filter((l) => l.trim() && !l.startsWith(';') && !l.startsWith('#'));
  return lines.flatMap((line, i) => {
    const parts = line.split(/\t|,/).map((p) => p.trim());
    // GR feed format: lat, lon, name, [optional fields...]
    if (parts.length < 3) return [];
    const lat = parseFloat(parts[0]);
    const lon = parseFloat(parts[1]);
    if (isNaN(lat) || isNaN(lon)) return [];
    return [{
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lon, lat] },
      properties: {
        id: `gr-${mode}-${i}`,
        name: parts[2] || 'Spotter',
        time: parts[3] || new Date().toISOString(),
        hazard: mode === 'reports' ? (parts[4] || 'Report') : undefined,
        description: parts.slice(4).join(' ') || undefined,
      },
    }];
  });
}
