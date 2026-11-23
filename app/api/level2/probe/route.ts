import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const TEST_URL =
  'https://unidata-nexrad-level2.s3.amazonaws.com/';

export async function GET() {
  try {
    const response = await fetch(TEST_URL, {
      cache: 'no-store',
    });

    return NextResponse.json({
      available: response.ok,
      status: response.status,
      source: TEST_URL,
      message: response.ok
        ? 'Level II source reachable'
        : 'Level II source returned an error',
    });
  } catch (error: any) {
    return NextResponse.json({
      available: false,
      error: String(error?.message || error),
    });
  }
}
