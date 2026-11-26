import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const RAOB_NETWORK = 'https://mesonet.agron.iastate.edu/geojson/network.py?network=RAOB';
const RAOB_PROFILE = 'https://mesonet.agron.iastate.edu/json/raob.py';

type Station = { sid: string; name: string; lat: number; lon: number; elevationM: number | null };

function distanceKm(lat: number, lon: number, s: Station): number {
  const rad = Math.PI / 180;
  const dLat = (s.lat - lat) * rad;
  const dLon = (s.lon - lon) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat * rad) * Math.cos(s.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function candidateTimestamps(): string[] {
  const now = new Date();
  const out: string[] = [];
  for (let back = 0; back < 3; back += 1) {
    const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - back));
    for (const hour of [12, 0]) {
      const stamp = `${day.getUTCFullYear()}${String(day.getUTCMonth() + 1).padStart(2, '0')}${String(day.getUTCDate()).padStart(2, '0')}${String(hour).padStart(2, '0')}00`;
      out.push(stamp);
    }
  }
  return out;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const lat = Number(url.searchParams.get('lat'));
  const lon = Number(url.searchParams.get('lon'));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return NextResponse.json({ available: false, error: 'Valid lat and lon are required' }, { status: 400 });
  }
  try {
    const networkRes = await fetch(RAOB_NETWORK, { cache: 'no-store', signal: AbortSignal.timeout(15_000) });
    if (!networkRes.ok) throw new Error(`RAOB network HTTP ${networkRes.status}`);
    const network = await networkRes.json();
    const stations: Station[] = (Array.isArray(network?.features) ? network.features : [])
      .map((f: any) => {
        const coords = f?.geometry?.coordinates;
        const sid = String(f?.properties?.sid || '').trim();
        return {
          sid,
          name: String(f?.properties?.sname || sid),
          lon: Number(coords?.[0]),
          lat: Number(coords?.[1]),
          elevationM: Number.isFinite(Number(f?.properties?.elevation)) ? Number(f.properties.elevation) : null,
        };
      })
      .filter((s: Station) => s.sid && Number.isFinite(s.lat) && Number.isFinite(s.lon));
    if (!stations.length) throw new Error('No RAOB stations published');
    const nearest = stations.reduce((best, s) => distanceKm(lat, lon, s) < distanceKm(lat, lon, best) ? s : best, stations[0]);
    const distanceKmValue = Math.round(distanceKm(lat, lon, nearest));

    for (const ts of candidateTimestamps()) {
      const res = await fetch(`${RAOB_PROFILE}?ts=${ts}&station=${encodeURIComponent(nearest.sid)}`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(12_000),
        headers: { 'User-Agent': 'MesoVortexWX/2.0' },
      });
      if (!res.ok) continue;
      const data = await res.json();
      const profile = Array.isArray(data?.profiles) ? data.profiles.find((p: any) => p?.profile?.length) : null;
      if (!profile) continue;
      return NextResponse.json({
        available: true,
        source: 'IEM RAOB observed sounding',
        station: profile.station || nearest.sid,
        stationName: nearest.name,
        stationElevationM: nearest.elevationM,
        distanceKm: distanceKmValue,
        observedAt: profile.valid || null,
        levels: profile.profile,
        requested: { lat, lon },
      }, { headers: { 'Cache-Control': 'no-store' } });
    }
    return NextResponse.json({ available: false, source: 'IEM RAOB', error: 'DATA UNAVAILABLE - no recent observed profile at the nearest station', station: nearest.sid, distanceKm: distanceKmValue });
  } catch (err: any) {
    return NextResponse.json({ available: false, source: 'IEM RAOB', error: String(err?.message || err) });
  }
}
