import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Composite radar tile timeline from RainViewer Weather Maps API.
 * Free tier is limited (zoom, rate limits, no large composites) as of 2025/2026.
 * For single-station (terminal) radar use /api/nexrad/frames (IEM). The legacy
 * /api/radar endpoint is retired and returns 410 Gone.
 */
export async function GET() {
  const source = 'https://api.rainviewer.com/public/weather-maps.json';

  try {
    const res = await fetch(source, {
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      return NextResponse.json(
        {
          data: [],
          available: false,
          reason: `DATA UNAVAILABLE - RainViewer HTTP ${res.status}`,
          playbackSupport: 'UNKNOWN',
          archiveSupport: 'UNKNOWN',
          verificationLevel: 'UNVERIFIED',
          tiles: [],
          attribution: 'RainViewer',
          error: `RainViewer HTTP ${res.status}`,
          _meta: { ok: false, source },
        },
        { status: 502, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const data = await res.json();
    const host = data.host || 'https://tilecache.rainviewer.com';
    const past = data.radar?.past || [];

    // Past frames only (nowcast discontinued for free use Jan 2026)
    const tiles = past.slice(-12).map((frame: { time: number; path: string }) => ({
      timestamp: frame.time,
      // Free tier: keep zoom modest; path already includes /v2/radar/{ts}
      url: `${host}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`,
      time: new Date(frame.time * 1000).toISOString(),
    }));

    return NextResponse.json(
      {
        data: tiles,
        available: tiles.length > 0,
        reason: tiles.length > 0 ? null : 'DATA UNAVAILABLE - No RainViewer composite frames returned.',
        playbackSupport: tiles.length > 0 ? 'REAL_ARCHIVE' : 'NONE',
        archiveSupport: tiles.length > 0 ? 'PARTIAL' : 'UNKNOWN',
        verificationLevel: 'UNVERIFIED',
        tiles,
        attribution: 'RainViewer',
        host,
        generated: data.generated,
        _meta: {
          fetchedAt: new Date().toISOString(),
          source,
          ok: true,
          count: tiles.length,
          note: 'Composite tiles. Single-station radar: /api/nexrad/frames?site=KLZK',
        },
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        data: [],
        available: false,
        reason: `DATA UNAVAILABLE - ${err?.message || 'Failed to fetch RainViewer'}`,
        playbackSupport: 'UNKNOWN',
        archiveSupport: 'UNKNOWN',
        verificationLevel: 'UNVERIFIED',
        tiles: [],
        attribution: 'RainViewer',
        error: err?.message || 'Failed to fetch RainViewer',
        _meta: { ok: false, source },
      },
      { status: 502, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
