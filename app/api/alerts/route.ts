import { NextResponse } from 'next/server';
import {
  ALL_ALERT_CATEGORIES,
  alertsToFeatureCollection,
  categoryCounts,
  normalizeNwsCollection,
} from '@/lib/alerts/model';

export const dynamic = 'force-dynamic';

const NWS_ACTIVE_ALERTS =
  'https://api.weather.gov/alerts/active?status=actual&message_type=alert';

/**
 * Normalized NWS alert feed.
 *
 * One upstream request feeds both the map (polygons) and the alert panel/list
 * (warnings, watches, advisories, statements). Consumers no longer parse NWS
 * event strings themselves.
 */
export async function GET() {
  try {
    const response = await fetch(NWS_ACTIVE_ALERTS, {
      headers: {
        'User-Agent': 'MesoVortexWX/2.0 (mesovortexwx@example.com)',
        Accept: 'application/geo+json',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000),
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          type: 'FeatureCollection',
          features: [],
          _meta: {
            ok: false,
            error: `NWS alert feed returned HTTP ${response.status}`,
            fetchedAt: new Date().toISOString(),
            source: NWS_ACTIVE_ALERTS,
          },
        },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const payload = await response.json();
    const alerts = normalizeNwsCollection(payload);
    const counts = categoryCounts(alerts);
    const collection = alertsToFeatureCollection(alerts);

    return NextResponse.json(
      {
        ...collection,
        _meta: {
          ok: true,
          source: NWS_ACTIVE_ALERTS,
          fetchedAt: new Date().toISOString(),
          total: alerts.length,
          mapped: collection.features.length,
          counts,
          categories: ALL_ALERT_CATEGORIES,
        },
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=0, s-maxage=20, stale-while-revalidate=30',
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        type: 'FeatureCollection',
        features: [],
        _meta: {
          ok: false,
          error: String(error?.message || error),
          fetchedAt: new Date().toISOString(),
          source: NWS_ACTIVE_ALERTS,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
