import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const BUCKET =
  'https://unidata-nexrad-level2.s3.amazonaws.com';

export async function GET() {
  try {
    const prefix = '';

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

    return NextResponse.json({
      available: response.ok,
      status: response.status,
      count: keys.length,
      files: keys,
    });
  } catch (error: any) {
    return NextResponse.json({
      available: false,
      error: String(error?.message || error),
    });
  }
}
