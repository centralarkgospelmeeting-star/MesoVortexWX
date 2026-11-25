import { NextRequest } from 'next/server';
import { getSurfaceResponse } from '../../../../lib/metar/surface-response';

export const dynamic = 'force-dynamic';

/**
 * ASOS surface observations.
 *
 * ASOS is identified only from automated-station remarks (AUTO / AO1 / AO2)
 * inside real AviationWeather.gov METAR reports. No separate or invented
 * ASOS feed is used.
 *
 *   /api/asos/geojson?ids=KLIT,KDFW
 *   /api/asos/geojson?bbox=33,-95,36,-91&hours=3
 */
export function GET(request: NextRequest) {
  const params = new URL(request.url).searchParams;
  params.set('source', 'asos');
  return getSurfaceResponse(params, 'asos');
}
