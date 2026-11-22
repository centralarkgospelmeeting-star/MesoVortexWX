import { NextResponse } from 'next/server';
import { getHyperlocalTelemetry } from '@/lib/adapters/weather-gateway';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get('lat') || '34.836');
  const lon = parseFloat(searchParams.get('lon') || '-92.262');
  const stationId = searchParams.get('stationId') || 'KLZK';

  const telemetry = await getHyperlocalTelemetry(lat, lon, stationId);

  return NextResponse.json(
    {
      ...telemetry,
      data: telemetry.observation,
      // Backward-compatible flat fields only when real observation exists; never fabricate.
      ...(telemetry.available && telemetry.observation
        ? {
            tempF: telemetry.observation.tempF,
            feelsLikeF: telemetry.observation.feelsLikeF,
            dewPointF: telemetry.observation.dewPointF,
            wetBulbF: telemetry.observation.wetBulbF,
            humidity: telemetry.observation.humidityPct,
            pressureInHg: telemetry.observation.pressureInHg,
            pressureMb: telemetry.observation.pressureMb,
            windSpeedKt: telemetry.observation.windSpeedKt,
            windGustKt: telemetry.observation.windGustKt,
            windDirDeg: telemetry.observation.windDirDeg,
            currentPrecipInches: 0,
            minutelyPrecip: telemetry.minutely.map((m) => ({
              minute: m.minute,
              amountInches: m.amountInches,
              hasPrecip: m.amountInches > 0.01,
              probabilityPct: m.probabilityPct,
            })),
          }
        : {}),
    },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
      },
    }
  );
}
