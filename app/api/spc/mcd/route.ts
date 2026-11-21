import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type McdFeature = {
  type: 'Feature';
  geometry: any;
  properties: {
    id: string;
    discussionNumber: string;
    name: string;
    url: string | null;
    issueTime: string | null;
    ingestTime: string | null;
    info: string | null;
    source: 'NOAA/NWS Storm Prediction Center';
  };
};

const NOAA_MCD_QUERY =
  'https://mapservices.weather.noaa.gov/vector/rest/services/outlooks/spc_mesoscale_discussion/MapServer/0/query?where=1%3D1&outFields=name,popupinfo,folderpath,idp_filedate,idp_ingestdate&returnGeometry=true&outSR=4326&f=geojson';

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function asEpochMs(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  if (typeof value === 'string') {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return n;
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function toIso(value: unknown): string | null {
  const ms = asEpochMs(value);
  if (ms == null) return null;
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function sanitizeUrl(value: unknown): string | null {
  const raw = asString(value);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    // Only allow SPC/NOAA links from this upstream field.
    if (!/(^|\.)spc\.noaa\.gov$/i.test(url.hostname) && !/(^|\.)noaa\.gov$/i.test(url.hostname)) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

function discussionUrl(name: string | null): string | null {
  if (!name) return null;
  const digits = name.replace(/\D/g, '');
  if (!digits) return null;
  const padded = digits.slice(-4).padStart(4, '0');
  return `https://www.spc.noaa.gov/products/md/md${padded}.html`;
}

function normalizeFeature(feature: any, index: number): McdFeature | null {
  const geometry = feature?.geometry;
  if (!geometry || !geometry.type) return null;

  const props = feature?.properties ?? {};
  const name = asString(props.name);
  if (!name || name.toLowerCase() === 'noarea') return null;

  const url = sanitizeUrl(props.popupinfo) || discussionUrl(name);
  const issueTime = toIso(props.idp_filedate);
  const ingestTime = toIso(props.idp_ingestdate);
  const info = asString(props.folderpath);

  return {
    type: 'Feature',
    geometry,
    properties: {
      id: `mcd-${name}-${index}`,
      discussionNumber: name,
      name: `Mesoscale Discussion ${name}`,
      url,
      issueTime,
      ingestTime,
      info,
      source: 'NOAA/NWS Storm Prediction Center',
    },
  };
}

export async function GET() {
  const fetchedAt = new Date().toISOString();

  try {
    const res = await fetch(NOAA_MCD_QUERY, {
      cache: 'no-store',
      headers: {
        Accept: 'application/geo+json,application/json;q=0.9,*/*;q=0.8',
        'User-Agent': 'MesoVortexWX/1.0 (mesoscale discussion map overlay)',
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        {
          type: 'FeatureCollection',
          features: [],
          meta: {
            available: false,
            source: 'NOAA/NWS Storm Prediction Center',
            upstream: NOAA_MCD_QUERY,
            fetchedAt,
            count: 0,
            notes: [`SPC mesoscale discussion service returned HTTP ${res.status}.`],
          },
        },
        { status: 200 }
      );
    }

    const data = await res.json();
    const rawFeatures = Array.isArray(data?.features) ? data.features : [];
    const features = rawFeatures
      .map((f: any, i: number) => normalizeFeature(f, i))
      .filter((f: McdFeature | null): f is McdFeature => Boolean(f));

    return NextResponse.json(
      {
        type: 'FeatureCollection',
        features,
        meta: {
          available: true,
          source: 'NOAA/NWS Storm Prediction Center',
          upstream: NOAA_MCD_QUERY,
          fetchedAt,
          count: features.length,
          notes:
            features.length === 0
              ? ['No active SPC mesoscale discussions at this time.']
              : [],
        },
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        type: 'FeatureCollection',
        features: [],
        meta: {
          available: false,
          source: 'NOAA/NWS Storm Prediction Center',
          upstream: NOAA_MCD_QUERY,
          fetchedAt,
          count: 0,
          notes: [`Unable to fetch SPC mesoscale discussions: ${String(err?.message || err)}`],
        },
      },
      { status: 200 }
    );
  }
}
