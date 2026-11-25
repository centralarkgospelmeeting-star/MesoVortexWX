import { NextRequest } from 'next/server';
import { getSurfaceResponse } from '../../../../lib/metar/surface-response';

export const dynamic = 'force-dynamic';

/**
 * Real METAR observations from AviationWeather.gov.
 *
 *   /api/metar/geojson?ids=KLIT,KDFW,KOKC
 *   /api/metar/geojson?bbox=33,-95,36,-91&hours=3
 *   /api/metar/geojson?bbox=33,-95,36,-91&source=asos
 *
 * source=asos narrows the result to genuine reports with AUTO/AO1/AO2 remarks.
 */
export function GET(request: NextRequest) {
  return getSurfaceResponse(new URL(request.url).searchParams);
}
