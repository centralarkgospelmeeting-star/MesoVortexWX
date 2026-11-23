import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const SOURCES = {
  atlantic_kmz: 'https://www.nhc.noaa.gov/xgtwo/gtwo_atl.kmz',
  east_pacific_kmz: 'https://www.nhc.noaa.gov/xgtwo/gtwo_pac.kmz',
  central_pacific_kmz: 'https://www.nhc.noaa.gov/xgtwo/gtwo_cpac.kmz',
  shapefile_zip: 'https://www.nhc.noaa.gov/xgtwo/gtwo_shapefiles.zip',
  gis_page: 'https://www.nhc.noaa.gov/gis/',
};

export async function GET(req: Request) {
  const basin = new URL(req.url).searchParams.get('basin') || 'atlantic';
  const format = new URL(req.url).searchParams.get('format') || 'json';

  if (format === 'zip') {
    try {
      const res = await fetch(SOURCES.shapefile_zip, {
        headers: { 'User-Agent': 'MesoVortexWX/2.0' },
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) {
        return NextResponse.json({ ok: false, source: SOURCES.shapefile_zip, error: `Upstream ${res.status}` }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
      }
      const buf = await res.arrayBuffer();
      return new NextResponse(buf, {
        headers: {
          'Content-Type': 'application/zip',
          'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
          'X-Source': SOURCES.shapefile_zip,
        },
      });
    } catch (e: any) {
      return NextResponse.json({ ok: false, source: SOURCES.shapefile_zip, error: String(e?.message || e) }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
    }
  }

  // Return verified real source endpoints. NHC GTWO is often empty outside active areas; consumers must handle empty/no-data.
  return NextResponse.json({
    ok: true,
    product: 'NHC Tropical Weather Outlook (GTWO)',
    basin,
    sources: SOURCES,
    note: 'Real NHC GTWO GIS endpoints. Shapefile/KMZ may contain no active outlook areas during quiet periods; this is real data, not a failure.',
    _meta: { fetchedAt: new Date().toISOString(), source: SOURCES.gis_page },
  }, { headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=600' } });
}
