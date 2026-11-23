import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const BUCKET =
  'https://unidata-nexrad-level2.s3.amazonaws.com';

export async function GET() {
  try {
    const prefix = '2026/11/22/KLZK/';

    const url =
      `${BUCKET}/?list-type=2&prefix=${prefix}&max-keys=5`;

    const response = await fetch(url, {
      cache: 'no-store',
    });

    const text = await response.text();

    const keys = Array.from(
      text.matchAll(/<Key>(.*?)<\/Key>/g),
      match => match[1]
    );

    const latestFile =
  keys.length > 0 ? keys[keys.length - 1] : null;

return NextResponse.json({
  available: response.ok,
  status: response.status,
  count: keys.length,
  latestFile,
  latestUrl: latestFile
    ? `${BUCKET}/${latestFile}`
    : null,
});
  } catch (error: any) {
    return NextResponse.json({
      available: false,
      error: String(error?.message || error),
    });
  }
}
