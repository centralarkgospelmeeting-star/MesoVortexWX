import { NextResponse } from 'next/server';
import { fetchJsonWithTimeout, errorPayload } from '../../../../lib/api-utils';

export const dynamic = 'force-dynamic';

// Verified NOAA MapServer services (probed 2026-11-22). Only services present in
// https://mapservices.weather.noaa.gov/vector/rest/services/outlooks?f=json are exposed.
const PRODUCTS: Record<string, { name: string; service: string; layer: number; sourcePage: string }> = {
  '6-10-day': {
    name: 'CPC 6-10 Day Outlook',
    service: 'https://mapservices.weather.noaa.gov/vector/rest/services/outlooks/cpc_6_10_day_outlk/MapServer',
    layer: 0,
    sourcePage: 'https://www.cpc.ncep.noaa.gov/products/predictions/610day/',
  },
  '8-14-day': {
    name: 'CPC 8-14 Day Outlook',
    service: 'https://mapservices.weather.noaa.gov/vector/rest/services/outlooks/cpc_8_14_day_outlk/MapServer',
    layer: 0,
    sourcePage: 'https://www.cpc.ncep.noaa.gov/products/predictions/814day/',
  },
  'monthly-temp': {
    name: 'CPC Monthly Temperature Outlook',
    service: 'https://mapservices.weather.noaa.gov/vector/rest/services/outlooks/cpc_mthly_temp_outlk/MapServer',
    layer: 0,
    sourcePage: 'https://www.cpc.ncep.noaa.gov/products/predictions/30day/',
  },
  'monthly-precip': {
    name: 'CPC Monthly Precipitation Outlook',
    service: 'https://mapservices.weather.noaa.gov/vector/rest/services/outlooks/cpc_mthly_precip_outlk/MapServer',
    layer: 0,
    sourcePage: 'https://www.cpc.ncep.noaa.gov/products/predictions/30day/',
  },
  'seasonal-temp': {
    name: 'CPC Seasonal Temperature Outlook',
    service: 'https://mapservices.weather.noaa.gov/vector/rest/services/outlooks/cpc_sea_temp_outlk/MapServer',
    layer: 0,
    sourcePage: 'https://www.cpc.ncep.noaa.gov/products/predictions/long_range/seasonal.php?lead=1',
  },
  'seasonal-precip': {
    name: 'CPC Seasonal Precipitation Outlook',
    service: 'https://mapservices.weather.noaa.gov/vector/rest/services/outlooks/cpc_sea_precip_outlk/MapServer',
    layer: 0,
    sourcePage: 'https://www.cpc.ncep.noaa.gov/products/predictions/long_range/seasonal.php?lead=1',
  },
};

export async function GET(req: Request) {
  const product = new URL(req.url).searchParams.get('product') || '6-10-day';
  const cfg = PRODUCTS[product];
  if (!cfg) {
    return NextResponse.json(errorPayload(
      { type: 'FeatureCollection', features: [] },
      'NOAA CPC Outlooks',
      `Invalid product ${product}. Use: ${Object.keys(PRODUCTS).join(', ')}`
    ), { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }

  const source = `${cfg.service}/${cfg.layer}/query?where=1%3D1&outFields=*&f=geojson`;
  const result = await fetchJsonWithTimeout(source, {
    headers: { 'User-Agent': 'MesoVortexWX/2.0' },
    timeoutMs: 20000,
  });

  if (!result.ok) {
    return NextResponse.json(errorPayload({ type: 'FeatureCollection', features: [] }, source, result.error), {
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  return NextResponse.json(
    {
      ...result.data,
      _meta: {
        fetchedAt: new Date().toISOString(),
        source,
        service: cfg.service,
        sourcePage: cfg.sourcePage,
        ok: true,
        product: cfg.name,
        productId: product,
      },
    },
    { headers: { 'Cache-Control': 'public, max-age=600, stale-while-revalidate=1200' } }
  );
}
