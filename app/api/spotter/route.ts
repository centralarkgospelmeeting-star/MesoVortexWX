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
  if (lat == null || lon == null || isNaN(lat) || isNaN(lon) || radiusKm >= 10000) return features;
  return features.filter((f) => {
    const coords = f?.geometry?.coordinates;
    if (!coords || coords.length < 2) return false;
    return haversineKm(lat, lon, coords[1], coords[0]) <= radiusKm;
  });
}

// ─── GR Placefile Parser for Spotter Network ─────────────────────────────────
// Parses the live https://www.spotternetwork.org/feeds/gr.txt feed used by WeatherWise/GRLevelX
function parseGRFeed(text: string): any[] {
  const features: any[] = [];
  const blocks = text.split(/Object:\s*/);

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];
    const lines = block.split('\n');
    const coordLine = lines[0].trim();
    const [latStr, lonStr] = coordLine.split(',');
    const lat = parseFloat(latStr);
    const lon = parseFloat(lonStr);
    if (isNaN(lat) || isNaN(lon)) continue;

    // Find Icon line which contains the metadata string
    const iconLine = lines.find((l) => l.startsWith('Icon:'));
    let rawInfo = '';
    if (iconLine) {
      const match = iconLine.match(/"([^"]*)"/);
      if (match) rawInfo = match[1];
    }

    // Find Text line if any
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
        id: `sn-pos-${i}-${lat.toFixed(4)}-${lon.toFixed(4)}`,
        name,
        callsign: textLabel && textLabel !== name ? textLabel : undefined,
        time,
        status,
        description: extraDetails || status,
        extraDetails,
        type: 'position',
      },
    });
  }

  return features;
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = (searchParams.get('mode') || 'positions').toLowerCase();
  const lat = searchParams.get('lat') ? Number(searchParams.get('lat')) : null;
  const lon = searchParams.get('lon') ? Number(searchParams.get('lon')) : null;
  const radiusKm = Number(searchParams.get('radiusKm') || 25000); // default to nationwide

  // ── A: Live Spotter Positions (gr.txt - official public WeatherWise/GR feed) ──
  if (mode === 'positions') {
    try {
      const res = await fetch('https://www.spotternetwork.org/feeds/gr.txt', {
        headers: { 'User-Agent': 'MesoVortexWX/1.0', Accept: 'text/plain' },
        next: { revalidate: 30 },
      });

      if (res.ok) {
        const text = await res.text();
        let features = parseGRFeed(text);
        if (lat && lon && radiusKm < 10000) {
          features = filterByRadius(features, lat, lon, radiusKm);
        }

        return NextResponse.json({
          type: 'FeatureCollection',
          features,
          meta: {
            source: 'Spotter Network (GR Feed)',
            mode: 'positions',
            count: features.length,
            fetchedAt: new Date().toISOString(),
          },
        });
      }
    } catch (err: any) {
      console.warn('[Spotter Positions Error]:', err);
    }
  }

  // ── B: Local Storm Reports (IEM LSR / NWS Ground Reports) ─────────────────
  try {
    const hours = Number(searchParams.get('hours') || 4);
    const url = `https://mesonet.agron.iastate.edu/geojson/lsr.geojson?hours=${hours}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'MesoVortexWX/1.0' } });

    if (res.ok) {
      const data = await res.json();
      let features = (data.features || []).map((f: any) => ({
        type: 'Feature',
        geometry: f.geometry,
        properties: {
          id: `lsr-${f.properties?.wfo}-${f.properties?.valid}-${Math.random()}`,
          name: f.properties?.source || 'Storm Spotter',
          callsign: f.properties?.source,
          time: f.properties?.valid,
          hazard: f.properties?.typetext || f.properties?.type,
          description: f.properties?.remark || f.properties?.typetext,
          magnitude: f.properties?.magnitude
            ? `${f.properties.magnitude}${f.properties.magf ? ' ' + f.properties.magf : ''}`
            : undefined,
          verified: true,
          type: 'report',
        },
      }));

      if (lat && lon && radiusKm < 10000) {
        features = filterByRadius(features, lat, lon, radiusKm);
      }

      return NextResponse.json({
        type: 'FeatureCollection',
        features,
        meta: { source: 'IEM LSR / NWS', mode: 'reports', count: features.length, fetchedAt: new Date().toISOString() },
      });
    }
  } catch (err: any) {
    // fallback
  }

  return NextResponse.json({
    type: 'FeatureCollection',
    features: [],
    meta: { source: 'Spotter Network', count: 0, fetchedAt: new Date().toISOString() },
  });
}
