import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Spotter Network integration.
 *
 * Data source: the public Spotter Network feeds published at
 * https://www.spotternetwork.org/pages/feeds/gibson-ridge and
 * https://www.spotternetwork.org/pages/feeds/other
 *
 *   - Positions (last ~3 h, all trained members): feeds/rss-positions.xml
 *   - Reports   (last ~3 h):                      feeds/rss-reports.xml
 *
 * Both are unauthenticated and explicitly published for third-party display
 * (non-commercial use). No account or API key is required. The developer API
 * (spotternetwork.docs.apiary.io) requires per-application credentials issued
 * directly by Spotter Network, so it is deliberately not used here.
 *
 * PRIVACY: the upstream feed embeds member contact details (phone, e-mail,
 * social handles). This route drops every field except identity, position,
 * time and the public report text. Nothing else leaves the server.
 */

const POSITIONS_URL = 'https://www.spotternetwork.org/feeds/rss-positions.xml';
const REPORTS_URL = 'https://www.spotternetwork.org/feeds/rss-reports.xml';

type Mode = 'positions' | 'reports' | 'all';

type UpstreamState = {
  ok: boolean;
  status: number | null;
  count: number;
  error?: string;
};

function unescapeXml(input: string): string {
  return input
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&hellip;/g, '…')
    .replace(/&[lr]squo;/g, "'")
    .replace(/&[lr]dquo;/g, '"')
    .replace(/&deg;/g, '°')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function decodeBody(input: string): string {
  // The report feed percent-encodes newlines inside <description>.
  return unescapeXml(input)
    .replace(/%0D%0A/gi, '\n')
    .replace(/%0A/gi, '\n')
    .replace(/%0D/gi, '\n')
    .trim();
}

function readTag(item: string, tag: string): string | null {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i');
  const match = item.match(re);
  if (!match) return null;
  return decodeBody(match[1]).trim() || null;
}

/**
 * Spotter Network descriptions use a flat "(Label) value" layout, e.g.
 *   "(Reported By) Jon Durr (Time) 2017-03-01 09:08:56 UTC (Notes) ..."
 *   "(Reported At) 2026-11-21 01:24:51 (Name) Drake Greaud"
 * Values may themselves contain parentheses, so only labels on a known
 * allow-list are treated as separators.
 */
const KNOWN_LABELS = [
  'reported at',
  'reported by',
  'time',
  'notes',
  'name',
  'movement',
  'report',
  // Recognised here only so their values can be discarded explicitly.
  'email',
  'phone',
  'im',
  'twitter',
  'web',
  'ham',
  'note',
];

function parseLabeledDescription(description: string): Record<string, string> {
  const out: Record<string, string> = {};
  const labelPattern = new RegExp(
    `\\((${KNOWN_LABELS.map((l) => l.replace(/ /g, '\\s+')).join('|')})\\)`,
    'gi'
  );

  const matches = allMatches(description, labelPattern);
  for (let i = 0; i < matches.length; i++) {
    const label = matches[i][1].toLowerCase().replace(/\s+/g, ' ').trim();
    const valueStart = (matches[i].index ?? 0) + matches[i][0].length;
    const valueEnd = i + 1 < matches.length ? matches[i + 1].index ?? description.length : description.length;
    out[label] = description.slice(valueStart, valueEnd).trim().replace(/^"|"$/g, '').trim();
  }

  // No recognised labels -> whole description is free text.
  if (matches.length === 0) {
    const fallback = description.replace(/^"|"$/g, '').trim();
    if (fallback) out.notes = fallback;
  }
  return out;
}

/** Spotter Network timestamps are UTC even when the feed omits the suffix. */
function toUtcIso(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(/\s*UTC\s*$/i, '').trim();
  const withZone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(cleaned) ? cleaned : `${cleaned}Z`;
  const parsed = new Date(withZone.replace(' ', 'T'));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function isValidCoord(lat: number, lon: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Map the SN report headline to a stable hazard group. */
function hazardGroup(reportType: string): string {
  const t = reportType.toLowerCase();
  if (t.includes('tornado')) return 'Tornado';
  if (t.includes('funnel')) return 'Funnel Cloud';
  if (t.includes('wall cloud')) return 'Wall Cloud';
  if (t.includes('hail')) return 'Hail';
  if (t.includes('wind')) return 'Wind';
  if (t.includes('flood')) return 'Flooding';
  if (t.includes('rain') || t.includes('snow') || t.includes('ice') || t.includes('fog') || t.includes('visibility')) {
    return 'Precipitation';
  }
  return 'Other';
}

function splitHeadline(title: string): { reportType: string; location?: string } {
  // Some upstream titles omit the space before "near" ("High Wind 50 mphnear ...").
  const match = title.match(/^(.*?)\s*near\s+(.+)$/i);
  if (match) {
    const reportType = match[1].trim().replace(/[:\s]+$/, '');
    return { reportType: reportType || 'Report', location: match[2].trim() };
  }
  const reportType = title.trim().replace(/[:\s]+$/, '');
  return { reportType: reportType || 'Report' };
}

function extractItems(xml: string): string[] {
  return allMatches(xml, /<item>([\s\S]*?)<\/item>/gi).map((m) => m[1]);
}

/** RegExp matchAll without depending on the project's ES target. */
function allMatches(input: string, pattern: RegExp): RegExpExecArray[] {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
  const re = new RegExp(pattern.source, flags);
  const out: RegExpExecArray[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(input)) !== null) {
    out.push(match);
    if (match.index === re.lastIndex) re.lastIndex++;
  }
  return out;
}

async function fetchFeed(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        Accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
        'User-Agent': 'MesoVortexWX/1.0 (+https://mesovortex-wx.vercel.app)',
      },
    });
    if (!res.ok) {
      throw Object.assign(new Error(`Upstream returned HTTP ${res.status}`), { status: res.status });
    }
    return await res.text();
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const requestedMode = (searchParams.get('mode') || 'all').toLowerCase();
  const mode: Mode = requestedMode === 'positions' || requestedMode === 'reports' ? requestedMode : 'all';

  const lat = searchParams.get('lat');
  const lon = searchParams.get('lon');
  const radiusKm = Number(searchParams.get('radiusKm') || 0);
  const wantRadius = lat !== null && lon !== null && Number.isFinite(Number(lat)) && Number.isFinite(Number(lon)) && radiusKm > 0;

  const features: any[] = [];
  const upstream: { positions?: UpstreamState; reports?: UpstreamState } = {};
  const notes: string[] = [];

  const jobs: Promise<void>[] = [];

  if (mode !== 'reports') {
    jobs.push(
      (async () => {
        try {
          const xml = await fetchFeed(POSITIONS_URL);
          const items = extractItems(xml);
          let count = 0;

          for (const item of items) {
            const title = readTag(item, 'title');
            const latRaw = readTag(item, 'geo:lat');
            const lonRaw = readTag(item, 'geo:long');
            const latNum = latRaw === null ? NaN : Number(latRaw);
            const lonNum = lonRaw === null ? NaN : Number(lonRaw);
            if (!isValidCoord(latNum, lonNum)) continue;

            // Description is parsed only for the timestamp; contact fields are
            // dropped here and never serialised to the client.
            const fields = parseLabeledDescription(readTag(item, 'description') || '');
            const timeIso = toUtcIso(fields['reported at'] || fields.time);
            const publicId = readTag(item, 'public_id');
            const name = title || fields.name || 'Spotter';

            features.push({
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [lonNum, latNum] },
              properties: {
                id: publicId ? `sn-pos-${publicId}` : `sn-pos-${latNum.toFixed(4)}-${lonNum.toFixed(4)}`,
                kind: 'position',
                name,
                timeIso,
                ageMinutes: timeIso ? Math.max(0, Math.round((Date.now() - Date.parse(timeIso)) / 60000)) : null,
              },
            });
            count++;
          }

          upstream.positions = { ok: true, status: 200, count };
        } catch (err: any) {
          upstream.positions = {
            ok: false,
            status: err?.status ?? null,
            count: 0,
            error: String(err?.message || err),
          };
        }
      })()
    );
  }

  if (mode !== 'positions') {
    jobs.push(
      (async () => {
        try {
          const xml = await fetchFeed(REPORTS_URL);
          const items = extractItems(xml);
          let count = 0;

          for (const item of items) {
            const title = readTag(item, 'title') || '';
            const latRaw = readTag(item, 'geo:lat');
            const lonRaw = readTag(item, 'geo:long');
            const latNum = latRaw === null ? NaN : Number(latRaw);
            const lonNum = lonRaw === null ? NaN : Number(lonRaw);
            if (!isValidCoord(latNum, lonNum)) continue;

            const fields = parseLabeledDescription(readTag(item, 'description') || '');
            const { reportType, location } = splitHeadline(title);
            const timeIso = toUtcIso(fields.time || fields['reported at']);
            const guid = readTag(item, 'guid') || '';
            const reportId = guid.match(/[?&]id=(\d+)/)?.[1];
            const url = /^https?:\/\/(www\.)?spotternetwork\.org\//i.test(guid) ? guid : undefined;

            features.push({
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [lonNum, latNum] },
              properties: {
                id: reportId ? `sn-rep-${reportId}` : `sn-rep-${latNum.toFixed(4)}-${lonNum.toFixed(4)}`,
                kind: 'report',
                name: fields['reported by'] || 'Spotter',
                reportType,
                hazard: hazardGroup(reportType),
                location,
                notes: fields.notes && fields.notes.toLowerCase() !== 'none' ? fields.notes : undefined,
                timeIso,
                ageMinutes: timeIso ? Math.max(0, Math.round((Date.now() - Date.parse(timeIso)) / 60000)) : null,
                url,
              },
            });
            count++;
          }

          upstream.reports = { ok: true, status: 200, count };
        } catch (err: any) {
          upstream.reports = {
            ok: false,
            status: err?.status ?? null,
            count: 0,
            error: String(err?.message || err),
          };
        }
      })()
    );
  }

  await Promise.all(jobs);

  // Reports first so they draw/label above plain positions.
  features.sort((a, b) => {
    if (a.properties.kind !== b.properties.kind) return a.properties.kind === 'report' ? -1 : 1;
    return (b.properties.ageMinutes ?? 1e9) - (a.properties.ageMinutes ?? 1e9);
  });

  let output = features;
  if (wantRadius) {
    const cLat = Number(lat);
    const cLon = Number(lon);
    output = output
      .map((f) => {
        const [fLon, fLat] = f.geometry.coordinates;
        return { f, km: haversineKm(cLat, cLon, fLat, fLon) };
      })
      .filter(({ km }) => km <= radiusKm)
      .map(({ f, km }) => ({
        ...f,
        properties: { ...f.properties, distanceKm: Math.round(km) },
      }));
  }

  const positionCount = output.filter((f) => f.properties.kind === 'position').length;
  const reportCount = output.filter((f) => f.properties.kind === 'report').length;

  const anyOk = Boolean(upstream.positions?.ok || upstream.reports?.ok);
  if (!anyOk) {
    notes.push('Spotter Network feeds are unreachable right now.');
  }
  if (upstream.reports?.ok && reportCount === 0) {
    notes.push('No Spotter Network reports in the last 3 hours.');
  }
  if (upstream.positions && !upstream.positions.ok && upstream.reports?.ok) {
    notes.push('Spotter position feed unavailable; showing reports only.');
  }
  if (upstream.reports && !upstream.reports.ok && upstream.positions?.ok) {
    notes.push('Spotter report feed unavailable; showing positions only.');
  }

  const body = {
    type: 'FeatureCollection' as const,
    features: output,
    meta: {
      source: 'Spotter Network',
      attribution: 'SpotterNetwork.org — non-commercial feed',
      mode,
      available: anyOk,
      counts: { positions: positionCount, reports: reportCount, total: output.length },
      fetchedAt: new Date().toISOString(),
      upstream,
      privacy: 'Member contact details (phone, e-mail, social handles) are stripped server-side.',
      notes: notes.length ? notes : undefined,
    },
  };

  return NextResponse.json(body, {
    status: 200,
    headers: {
      'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
