/**
 * IEM RIDGE single-site scan-time resolution.
 *
 * The live `ridge::SITE-PRODUCT-0` tile URL always points at "latest" and has
 * no Last-Modified/ETag header, so it cannot prove that a new scan arrived.
 * IEM publishes the verified volume-scan index here:
 * https://mesonet.agron.iastate.edu/GIS/ridge.phtml
 */

const IEM_RADAR_LIST_URL = 'https://mesonet.agron.iastate.edu/json/radar.py';

export type IemLatestScan = {
  /** ISO-8601 UTC timestamp exactly as published by IEM. */
  scanTime: string;
  /** Compact YYYYMMDDHHMM token used by the IEM tile service. */
  tileStamp: string;
};

function isoMinute(date: Date): string {
  return `${date.toISOString().slice(0, 16)}Z`;
}

export function iemScanTimeToTileStamp(scanTime: string): string | null {
  const digits = String(scanTime || '').replace(/\D/g, '').slice(0, 12);
  return /^\d{12}$/.test(digits) ? digits : null;
}

export async function fetchLatestIemScan(options: {
  radar: string;
  product: string;
  now?: Date;
  windowMinutes?: number;
}): Promise<IemLatestScan | null> {
  const now = options.now || new Date();
  const windowMinutes = options.windowMinutes ?? 75;
  const start = isoMinute(new Date(now.getTime() - windowMinutes * 60_000));
  const end = isoMinute(new Date(now.getTime() + 5 * 60_000));
  const url = new URL(IEM_RADAR_LIST_URL);
  url.searchParams.set('operation', 'list');
  url.searchParams.set('radar', options.radar);
  url.searchParams.set('product', options.product);
  url.searchParams.set('start', start);
  url.searchParams.set('end', end);

  try {
    const response = await fetch(url.toString(), {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) return null;
    const payload: unknown = await response.json();
    const scans = (payload as { scans?: unknown })?.scans;
    if (!Array.isArray(scans)) return null;
    const times = scans
      .map((entry) => String((entry as { ts?: unknown })?.ts || ''))
      .filter((ts) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z$/.test(ts))
      .sort();
    const latest = times[times.length - 1];
    if (!latest) return null;
    const tileStamp = iemScanTimeToTileStamp(latest);
    if (!tileStamp) return null;
    return { scanTime: latest, tileStamp };
  } catch {
    return null;
  }
}
