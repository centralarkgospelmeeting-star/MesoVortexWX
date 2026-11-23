import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function parseNdbcRealtime(text: string) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 3) return null;
  const headers = lines[0].replace(/^#/, '').trim().split(/\s+/);
  const units = lines[1].replace(/^#/, '').trim().split(/\s+/);
  const values = lines[2].trim().split(/\s+/);
  const row: Record<string, { value: string; unit: string }> = {};
  for (let i = 0; i < headers.length; i++) {
    row[headers[i]] = { value: values[i] ?? 'MM', unit: units[i] ?? '' };
  }
  return { headers, units, row, observedAt: `${values[0]}-${values[1]}-${values[2]}T${values[3]}:${values[4]}:00Z` };
}

export async function GET(req: Request) {
  const station = (new URL(req.url).searchParams.get('station') || '44013').replace(/[^A-Za-z0-9_]/g, '').slice(0, 10);
  const source = `https://www.ndbc.noaa.gov/data/realtime2/${station}.txt`;
  try {
    const res = await fetch(source, {
      headers: { 'User-Agent': 'MesoVortexWX/2.0' },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) {
      return NextResponse.json({ ok: false, source, error: `DATA UNAVAILABLE - Upstream ${res.status}`, station }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
    }
    const text = await res.text();
    const parsed = parseNdbcRealtime(text);
    if (!parsed) {
      return NextResponse.json({ ok: false, source, error: 'DATA UNAVAILABLE - Could not parse NDBC realtime data', station }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
    }
    return NextResponse.json({
      ok: true,
      station,
      source,
      product: 'NDBC Realtime Buoy Observation',
      observedAt: parsed.observedAt,
      data: parsed.row,
      _meta: { fetchedAt: new Date().toISOString(), source, ok: true },
    }, { headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=600' } });
  } catch (e: any) {
    return NextResponse.json({ ok: false, source, error: `DATA UNAVAILABLE - ${String(e?.message || e)}`, station }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }
}
