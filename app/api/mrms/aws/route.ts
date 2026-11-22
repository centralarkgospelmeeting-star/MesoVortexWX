import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

const BUCKET = 'https://noaa-mrms-pds.s3.amazonaws.com';

// Honest scaffold: list real NOAA MRMS AWS Open Data objects by prefix.
// Full GRIB2->tile pipeline is not yet implemented; this endpoint exposes real bucket availability.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const prefix = (searchParams.get('prefix') || 'CONUS/MergedReflectivityQCComposite_00.50/').replace(/^\//, '');
  const maxKeys = Math.max(1, Math.min(50, Number(searchParams.get('max') || 10)));
  const url = `${BUCKET}/?list-type=2&prefix=${encodeURIComponent(prefix)}&max-keys=${maxKeys}`;
  try {
    const res = await fetch(url, { cache: 'no-store', headers: { 'User-Agent': 'MesoVortexWX/1.0' } });
    if (!res.ok) {
      return NextResponse.json({ available: false, source: 'NOAA MRMS AWS Open Data (S3)', bucket: BUCKET, prefix, error: `HTTP ${res.status}`, objects: [] }, { status: 200 });
    }
    const xml = await res.text();
    const keys = Array.from(xml.matchAll(/<Key>([^<]+)<\/Key>/g)).map(m => m[1]);
    const modified = Array.from(xml.matchAll(/<LastModified>([^<]+)<\/LastModified>/g)).map(m => m[1]);
    const objects = keys.map((key, i) => ({ key, lastModified: modified[i] || null, url: `${BUCKET}/${key}` }));
    return NextResponse.json({
      available: true,
      source: 'NOAA MRMS AWS Open Data (S3)',
      bucket: BUCKET,
      prefix,
      pipelineStatus: 'SCAFFOLD - real S3 listing only; GRIB2 decode/tile/render pipeline not yet implemented',
      objects,
    }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  } catch (err: any) {
    return NextResponse.json({ available: false, source: 'NOAA MRMS AWS Open Data (S3)', bucket: BUCKET, prefix, error: String(err?.message || err), objects: [] }, { status: 200 });
  }
}
