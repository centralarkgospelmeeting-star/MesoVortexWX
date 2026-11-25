import { NextResponse } from 'next/server';
import { fetchLevel2Frame } from '../../../../lib/radar/level2-polar';
import { RADAR_SITES } from '../../../../lib/radar-config';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Point = { lon: number; lat: number };
type Radial = {
  azimuth?: number;
  elevation_angle?: number;
  reflect?: Array<number | null> | { moment_data?: Array<number | null>; gate_size?: number; first_gate?: number };
};

const EARTH_KM = 6371.0088;
const EFFECTIVE_EARTH_KM = EARTH_KM * 4 / 3;
const MAX_RANGE_KM = 460;
const MAX_COLUMNS = 180;
const MAX_SWEEPS = 24;

function finitePoint(value: unknown): value is Point {
  if (!value || typeof value !== 'object') return false;
  const point = value as Record<string, unknown>;
  return typeof point.lon === 'number' && Number.isFinite(point.lon) && Math.abs(point.lon) <= 180
    && typeof point.lat === 'number' && Number.isFinite(point.lat) && Math.abs(point.lat) <= 90;
}

function inverse(origin: Point, target: Point) {
  const rad = Math.PI / 180;
  const p1 = origin.lat * rad;
  const p2 = target.lat * rad;
  const dLat = (target.lat - origin.lat) * rad;
  const rawDLon = (target.lon - origin.lon) * rad;
  const dLon = ((rawDLon + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dLon / 2) ** 2;
  const distanceKm = EARTH_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const y = Math.sin(dLon) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dLon);
  return { distanceKm, bearing: (Math.atan2(y, x) / rad + 360) % 360 };
}

function beamHeightKm(slantRangeKm: number, elevationDegrees: number) {
  const elevation = elevationDegrees * Math.PI / 180;
  return Math.sqrt(
    EFFECTIVE_EARTH_KM ** 2 + slantRangeKm ** 2
      + 2 * EFFECTIVE_EARTH_KM * slantRangeKm * Math.sin(elevation),
  ) - EFFECTIVE_EARTH_KM;
}

function interpolatePoint(a: Point, b: Point, fraction: number): Point {
  // Sample at equal great-circle distance intervals rather than linearly in
  // latitude/longitude, which does not preserve distance or bearing.
  const { distanceKm, bearing } = inverse(a, b);
  const angularDistance = (distanceKm / EARTH_KM) * fraction;
  const bearingRad = bearing * Math.PI / 180;
  const lat1 = a.lat * Math.PI / 180;
  const lon1 = a.lon * Math.PI / 180;
  const sinLat2 = Math.sin(lat1) * Math.cos(angularDistance)
    + Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearingRad);
  const lat2 = Math.asin(Math.max(-1, Math.min(1, sinLat2)));
  const lon2 = lon1 + Math.atan2(
    Math.sin(bearingRad) * Math.sin(angularDistance) * Math.cos(lat1),
    Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2),
  );
  const lonDegrees = ((lon2 * 180 / Math.PI + 540) % 360) - 180;
  return { lon: lonDegrees, lat: lat2 * 180 / Math.PI };
}

function nearestRadial(radials: Radial[], bearing: number): Radial | undefined {
  let best: Radial | undefined;
  let difference = Infinity;
  for (const radial of radials) {
    if (!Number.isFinite(radial.azimuth)) continue;
    const delta = Math.abs((radial.azimuth as number) - bearing);
    const wrapped = Math.min(delta, 360 - delta);
    if (wrapped < difference) { best = radial; difference = wrapped; }
  }
  return difference <= 1.1 ? best : undefined;
}

function reflectivity(radial: Radial | undefined, slantRangeKm: number): number | null {
  if (!radial?.reflect) return null;
  const moment = Array.isArray(radial.reflect) ? null : radial.reflect;
  const values = Array.isArray(radial.reflect) ? radial.reflect : moment?.moment_data;
  if (!values?.length) return null;
  const gateSizeKm = moment && Number.isFinite(moment.gate_size) ? moment.gate_size as number : 0.25;
  const firstGateKm = moment && Number.isFinite(moment.first_gate) ? moment.first_gate as number : 2.125;
  const gate = Math.round((slantRangeKm - firstGateKm) / gateSizeKm);
  if (gate < 0 || gate >= values.length) return null;
  const value = values[gate];
  return value != null && Number.isFinite(value) && value >= -10 && value <= 100 ? value : null;
}

export async function POST(request: Request) {
  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 }); }
  const siteId = typeof body?.site === 'string' ? body.site.toUpperCase() : '';
  const start = body?.start;
  const end = body?.end;
  const columns = Number.isInteger(body?.columns) ? Math.max(24, Math.min(MAX_COLUMNS, body.columns)) : 120;
  if (!finitePoint(start) || !finitePoint(end)) {
    return NextResponse.json({ error: 'Provide start and end points as { lon, lat } coordinates.' }, { status: 400 });
  }
  const site = RADAR_SITES.find((item) => item.network === 'NEXRAD' && (item.id === siteId || item.radarId === siteId || item.radarId === siteId.replace(/^K/, '')));
  if (!site) return NextResponse.json({ error: 'Unknown NEXRAD radar site.' }, { status: 400 });

  const length = inverse(start, end).distanceKm;
  if (length < 0.1 || length > 300) return NextResponse.json({ error: 'Cross-section line must be between 0.1 and 300 km.' }, { status: 400 });
  const fromRadarStart = inverse({ lon: site.lon, lat: site.lat }, start).distanceKm;
  const fromRadarEnd = inverse({ lon: site.lon, lat: site.lat }, end).distanceKm;
  if (Math.min(fromRadarStart, fromRadarEnd) > MAX_RANGE_KM || Math.max(fromRadarStart, fromRadarEnd) > MAX_RANGE_KM + length) {
    return NextResponse.json({ error: 'The selected transect is outside the supported 460 km radar range.' }, { status: 422 });
  }

  try {
    const frame = await fetchLevel2Frame(site.id);
    const sweepEntries = frame.volume.listElevations().slice(0, MAX_SWEEPS);
    const sweeps = sweepEntries.map((elevationIndex: number, index: number) => {
      const radials = (frame.volume.data[elevationIndex] || [])
        .map((item: any) => item.record as Radial | undefined)
        .filter((radial: Radial | undefined): radial is Radial => Boolean(radial && Number.isFinite(radial.azimuth) && Number.isFinite(radial.elevation_angle)))
        .sort((a: Radial, b: Radial) => (a.azimuth || 0) - (b.azimuth || 0));
      const angles = radials.map((radial: Radial) => radial.elevation_angle as number);
      const elevation = angles.length ? angles.reduce((sum: number, angle: number) => sum + angle, 0) / angles.length : null;
      return { index, radials, elevation };
    }).filter((sweep: { radials: Radial[]; elevation: number | null }) => sweep.elevation !== null && sweep.radials.length > 0);
    if (!sweeps.length) throw new Error('The downloaded volume contains no usable elevation sweeps.');

    const grid = sweeps.map((sweep: { radials: Radial[]; elevation: number | null }) => {
      const values: Array<number | null> = [];
      const heightsFt: Array<number | null> = [];
      for (let column = 0; column < columns; column++) {
        const point = interpolatePoint(start, end, column / (columns - 1));
        const { distanceKm, bearing } = inverse({ lon: site.lon, lat: site.lat }, point);
        if (distanceKm > MAX_RANGE_KM) { values.push(null); heightsFt.push(null); continue; }
        const radial = nearestRadial(sweep.radials, bearing);
        if (!radial) { values.push(null); heightsFt.push(null); continue; }
        const angle = radial.elevation_angle ?? sweep.elevation ?? 0;
        // Convert ground distance to beam slant range using the 4/3-earth model.
        const elevationRad = angle * Math.PI / 180;
        const groundAngle = distanceKm / EFFECTIVE_EARTH_KM;
        const denominator = Math.cos(elevationRad + groundAngle);
        if (denominator <= 0) { values.push(null); heightsFt.push(null); continue; }
        const slantRangeKm = EFFECTIVE_EARTH_KM * Math.sin(groundAngle) / denominator;
        const heightFt = beamHeightKm(slantRangeKm, angle) * 3280.839895;
        values.push(reflectivity(radial, slantRangeKm));
        heightsFt.push(Number.isFinite(heightFt) ? heightFt : null);
      }
      return { elevationDegrees: Number((sweep.elevation as number).toFixed(2)), reflectivityDbz: values, beamHeightFtAboveRadar: heightsFt };
    });

    const valid = grid.reduce((sum: number, sweep: { reflectivityDbz: Array<number | null> }) => sum + sweep.reflectivityDbz.filter((v) => v !== null).length, 0);
    if (!valid) throw new Error('No reflectivity gates intersected this transect. Move the line closer to the radar or try a different azimuth.');
    return NextResponse.json({
      site: site.id, siteName: site.name, scanTime: frame.time,
      source: 'NOAA NEXRAD Level II live volume (single radar)',
      liveOnly: true, lengthKm: Number(length.toFixed(2)), columns,
      note: 'Each plotted value is a measured reflectivity gate from the nearest available radial in an actual elevation sweep. Beam heights are 4/3-earth geometric estimates above radar level, not a gridded Cartesian volume; gaps are left blank rather than filled.',
      sweeps: grid,
    }, { headers: { 'Cache-Control': 'no-store', 'X-MesoVortex-Source': 'NOAA-NEXRAD-Level-II' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to build cross section from the live Level II volume.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
