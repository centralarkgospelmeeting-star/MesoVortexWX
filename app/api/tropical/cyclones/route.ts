import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const NHC_CURRENT = 'https://www.nhc.noaa.gov/CurrentStorms.json';
const MAPSERVER = 'https://mapservices.weather.noaa.gov/tropical/rest/services/tropical/NHC_tropical_weather/MapServer';

type Slot = { basin: 'AT' | 'EP' | 'CP'; num: number; ids: Record<string, number> };

const SLOTS: Slot[] = [
  { basin: 'AT', num: 1, ids: { points: 6, track: 7, cone: 8, watchWarning: 9, pastPoints: 11, windRadii: 16, advisoryWind: 17 } },
  { basin: 'AT', num: 2, ids: { points: 32, track: 33, cone: 34, watchWarning: 35, pastPoints: 37, windRadii: 42, advisoryWind: 43 } },
  { basin: 'AT', num: 3, ids: { points: 58, track: 59, cone: 60, watchWarning: 61, pastPoints: 63, windRadii: 68, advisoryWind: 69 } },
  { basin: 'AT', num: 4, ids: { points: 84, track: 85, cone: 86, watchWarning: 87, pastPoints: 89, windRadii: 94, advisoryWind: 95 } },
  { basin: 'AT', num: 5, ids: { points: 110, track: 111, cone: 112, watchWarning: 113, pastPoints: 115, windRadii: 120, advisoryWind: 121 } },
  { basin: 'EP', num: 1, ids: { points: 136, track: 137, cone: 138, watchWarning: 139, pastPoints: 141, windRadii: 146, advisoryWind: 147 } },
  { basin: 'EP', num: 2, ids: { points: 162, track: 163, cone: 164, watchWarning: 165, pastPoints: 167, windRadii: 172, advisoryWind: 173 } },
  { basin: 'EP', num: 3, ids: { points: 188, track: 189, cone: 190, watchWarning: 191, pastPoints: 193, windRadii: 198, advisoryWind: 199 } },
  { basin: 'EP', num: 4, ids: { points: 214, track: 215, cone: 216, watchWarning: 217, pastPoints: 219, windRadii: 224, advisoryWind: 225 } },
  { basin: 'EP', num: 5, ids: { points: 240, track: 241, cone: 242, watchWarning: 243, pastPoints: 245, windRadii: 250, advisoryWind: 251 } },
  { basin: 'CP', num: 1, ids: { points: 266, track: 267, cone: 268, watchWarning: 269, pastPoints: 271, windRadii: 276, advisoryWind: 277 } },
  { basin: 'CP', num: 2, ids: { points: 292, track: 293, cone: 294, watchWarning: 295, pastPoints: 297, windRadii: 302, advisoryWind: 303 } },
  { basin: 'CP', num: 3, ids: { points: 318, track: 319, cone: 320, watchWarning: 321, pastPoints: 323, windRadii: 328, advisoryWind: 329 } },
  { basin: 'CP', num: 4, ids: { points: 344, track: 345, cone: 346, watchWarning: 347, pastPoints: 349, windRadii: 354, advisoryWind: 355 } },
  { basin: 'CP', num: 5, ids: { points: 370, track: 371, cone: 372, watchWarning: 373, pastPoints: 375, windRadii: 380, advisoryWind: 381 } },
];

async function fetchJson(url: string, timeoutMs = 12000): Promise<any | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { cache: 'no-store', signal: ctrl.signal, headers: { 'User-Agent': 'MesoVortexWX/1.0 (tropical-data)' } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function queryLayer(layerId: number): Promise<any | null> {
  const url = `${MAPSERVER}/${layerId}/query?where=1%3D1&outFields=*&outSR=4326&f=geojson`;
  return fetchJson(url);
}

function normalizeIntensity(props: any): string {
  const ss = Number(props?.ssnum ?? props?.SSNUM);
  if (Number.isFinite(ss)) {
    if (ss >= 5) return 'Category 5 Hurricane';
    if (ss === 4) return 'Category 4 Hurricane';
    if (ss === 3) return 'Category 3 Hurricane';
    if (ss === 2) return 'Category 2 Hurricane';
    if (ss === 1) return 'Category 1 Hurricane';
    if (ss === 0) return 'Tropical Storm';
    if (ss < 0) return 'Tropical Depression';
  }
  const stormType = String(props?.stormtype ?? props?.TCDVLP ?? props?.tcvtype ?? '').trim();
  return stormType || 'Unknown';
}

function extractCurrentPoint(pointsFc: any): any | null {
  const feats = Array.isArray(pointsFc?.features) ? pointsFc.features : [];
  if (!feats.length) return null;
  const current = feats.find((f: any) => {
    const p = f.properties || {};
    const hr = Number(p.fcstprd ?? p.FCSTPRD ?? p.tau ?? p.TAU);
    const dv = String(p.dvlabel ?? p.DVLABEL ?? '').toLowerCase();
    return hr === 0 || dv.includes('now') || dv.includes('current');
  }) || feats[0];
  return current;
}

function stormFromSlot(slot: Slot, pointsFc: any, trackFc: any, coneFc: any, windFc: any, currentStorms: any[]): any | null {
  const points = Array.isArray(pointsFc?.features) ? pointsFc.features : [];
  if (!points.length) return null;
  const cur = extractCurrentPoint(pointsFc);
  const p = cur?.properties || points[0]?.properties || {};
  const stormName = String(p.stormname ?? p.STORMNAME ?? '').trim();
  if (!stormName) return null;
  const basin = String(p.basin ?? p.BASIN ?? slot.basin).trim();
  const stormNum = p.stormnum ?? p.STORMNUM ?? '';
  const id = `${basin}-${stormNum}-${stormName}`.replace(/\s+/g, '-').toUpperCase();

  const coords = cur?.geometry?.coordinates;
  const lon = Array.isArray(coords) ? Number(coords[0]) : NaN;
  const lat = Array.isArray(coords) ? Number(coords[1]) : NaN;

  const cs = currentStorms.find((s: any) => {
    const n = String(s.name || '').toLowerCase();
    const b = String(s.id || '').slice(0, 2).toLowerCase();
    return n === stormName.toLowerCase() && (!basin || b === slot.basin.toLowerCase());
  });

  const advisoryNum = String(p.advisnum ?? p.ADVISNUM ?? cs?.publicAdvisory?.issuance ?? cs?.advisoryNumber ?? '').trim();
  const advDate = String(p.advdate ?? p.ADVDATE ?? cs?.lastUpdate ?? '').trim();
  const movement = cs?.movementDir != null && cs?.movementSpeed != null
    ? `${cs.movementDir} at ${cs.movementSpeed} ${cs.movementSpeedUnit || 'mph'}`
    : String(p.tcdirm ?? p.TCDIRM ?? '').trim() || 'Unavailable';
  const intensity = normalizeIntensity(p);
  const maxWind = p.maxwind ?? p.MAXWIND ?? cs?.intensity;
  const pressure = p.mslp ?? p.MSLP ?? cs?.pressure;

  return {
    id,
    name: stormName,
    basin: slot.basin,
    stormNum,
    intensity,
    maxWindKt: Number.isFinite(Number(maxWind)) ? Number(maxWind) : null,
    pressureMb: Number.isFinite(Number(pressure)) ? Number(pressure) : null,
    position: (Number.isFinite(lat) && Number.isFinite(lon)) ? { lat, lon } : null,
    movement,
    advisory: {
      number: advisoryNum || 'Unavailable',
      date: advDate || 'Unavailable',
      headline: String(cs?.headline || '').trim(),
      url: cs?.publicAdvisory?.url || cs?.forecastAdvisory?.url || 'https://www.nhc.noaa.gov/',
      source: slot.basin === 'CP' ? 'CPHC' : 'NHC',
    },
    forecastPoints: pointsFc?.type === 'FeatureCollection' ? pointsFc : { type: 'FeatureCollection', features: [] },
    forecastTrack: trackFc?.type === 'FeatureCollection' ? trackFc : { type: 'FeatureCollection', features: [] },
    forecastCone: coneFc?.type === 'FeatureCollection' ? coneFc : { type: 'FeatureCollection', features: [] },
    windRadii: windFc?.type === 'FeatureCollection' ? windFc : { type: 'FeatureCollection', features: [] },
  };
}

export async function GET() {
  try {
    const currentStormsData = await fetchJson(NHC_CURRENT, 10000);
    const currentStorms = Array.isArray(currentStormsData?.activeStorms) ? currentStormsData.activeStorms : [];

    const slotResults = await Promise.all(SLOTS.map(async (slot) => {
      const points = await queryLayer(slot.ids.points);
      const feats = Array.isArray(points?.features) ? points.features : [];
      if (!feats.length) return null;
      const [track, cone, windRadii] = await Promise.all([
        queryLayer(slot.ids.track),
        queryLayer(slot.ids.cone),
        queryLayer(slot.ids.windRadii),
      ]);
      return stormFromSlot(slot, points, track, cone, windRadii, currentStorms);
    }));

    const storms = slotResults.filter(Boolean);
    return NextResponse.json({
      available: true,
      source: 'NOAA/NWS National Hurricane Center & Central Pacific Hurricane Center',
      generatedAt: new Date().toISOString(),
      storms,
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (err: any) {
    return NextResponse.json({
      available: false,
      source: 'NOAA/NWS National Hurricane Center & Central Pacific Hurricane Center',
      generatedAt: new Date().toISOString(),
      storms: [],
      error: String(err?.message || err),
    }, { status: 200, headers: { 'Cache-Control': 'no-store, max-age=0' } });
  }
}
