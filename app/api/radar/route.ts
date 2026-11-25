import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const REPLACEMENT = '/api/nexrad/frames';

/**
 * GET /api/radar is deprecated and returns no radar data.
 *
 * The legacy handler generated archive frame timestamps from the server clock
 * (new Date() minus fixed offsets) and presented them as radar frame metadata.
 * Those timestamps were not observations, so this route now fails closed.
 *
 * Use /api/nexrad/frames for capability-checked frame metadata and tile URLs.
 */
export async function GET(request: NextRequest) {
  const pathname = new URL(request.url).pathname;
  const reason = `GONE - ${pathname} is a deprecated radar endpoint. No radar frames or timestamps are provided here. Use ${REPLACEMENT} instead.`;

  return NextResponse.json(
    {
      data: null,
      available: false,
      error: reason,
      reason,
      deprecatedEndpoint: pathname,
      replacement: REPLACEMENT,
      status: 'GONE',
      playbackSupport: 'NONE',
      archiveSupport: 'UNKNOWN',
      verificationLevel: 'UNVERIFIED',
      notes: ['No synthesized frames, frame times, or observation metadata are returned by this endpoint.'],
    },
    { status: 410, headers: { 'Cache-Control': 'no-store' } }
  );
}
