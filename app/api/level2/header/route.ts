import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const FILE_URL =
  'https://unidata-nexrad-level2.s3.amazonaws.com/2026/11/22/KLZK/KLZK20261122_020312_V06';

export async function GET() {
  try {
    const response = await fetch(FILE_URL, {
      headers: {
        Range: 'bytes=0-255',
      },
      cache: 'no-store',
    });

    const buffer = await response.arrayBuffer();

    return NextResponse.json({
      status: response.status,
      bytesRead: buffer.byteLength,
      contentType: response.headers.get('content-type'),
      contentLength: response.headers.get('content-length'),
    });
  } catch (error: any) {
    return NextResponse.json({
      error: String(error?.message || error),
    });
  }
}
