/**
 * IEM station metadata adapter.
 *
 * IEM network.py is the only verified source carrying an IS_AWOS flag, so it
 * is used to classify AWOS sites honestly. Observations still come from the
 * real AviationWeather METAR feed; this module only provides station metadata
 * and the AWOS classification. No observation is synthesized.
 */
export interface IemStation {
  id: string;
  name: string | null;
  lat: number;
  lon: number;
  elevationM: number | null;
  isAwos: boolean;
}

export async function fetchIemNetwork(network: string, signal?: AbortSignal): Promise<IemStation[]> {
  const url = `https://mesonet.agron.iastate.edu/geojson/network.py?network=${encodeURIComponent(network)}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'MesoVortexWX/2.0', Accept: 'application/json' },
    cache: 'no-store',
    signal,
  });
  if (!res.ok) throw new Error(`IEM network HTTP ${res.status}`);
  const data = await res.json();
  const out: IemStation[] = [];
  for (const f of data?.features || []) {
    const p = f?.properties || {};
    const id = String(p.sid || p.station || p.id || f?.id || '').trim();
    if (!id) continue;
    const coords = f?.geometry?.coordinates;
    const lon = typeof coords?.[0] === 'number' ? coords[0] : null;
    const lat = typeof coords?.[1] === 'number' ? coords[1] : null;
    if (lat === null || lon === null) continue;
    out.push({
      id,
      name: p.sname ? String(p.sname).trim() : null,
      lat,
      lon,
      elevationM: typeof p.elevation === 'number' ? p.elevation : null,
      isAwos: String(p.attributes?.IS_AWOS ?? '').trim() === '1',
    });
  }
  return out;
}