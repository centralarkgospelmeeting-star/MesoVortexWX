/**
 * Authoritative composite radar sources.
 *
 * Only sources that have been verified end-to-end in MesoVortexWX are marked
 * VERIFIED. International/regional composites that are not verified (or require
 * paid/restricted APIs) are listed as UNAVAILABLE so the UI can show them
 * honestly as DATA UNAVAILABLE rather than fabricating a feed.
 */
export type CompositeSourceStatus = 'VERIFIED' | 'UNAVAILABLE';

export interface CompositeSource {
  id: string;
  label: string;
  scope: 'national' | 'regional' | 'international';
  status: CompositeSourceStatus;
  provider: string;
  url: string | null;
  provenance: string;
  refreshMinutes: number | null;
  latencyMinutes: number | null;
  notes: string;
}

export const COMPOSITE_SOURCES: readonly CompositeSource[] = [
  {
    id: 'iem_n0q',
    label: 'IEM National N0Q Composite',
    scope: 'national',
    status: 'VERIFIED',
    provider: 'Iowa Environmental Mesonet (IEM)',
    url: 'https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q-900913/{z}/{x}/{y}.png',
    provenance: 'IEM national NEXRAD N0Q mosaic (NOAA NWS NEXRAD)',
    refreshMinutes: 5,
    latencyMinutes: 5,
    notes: 'Verified national mosaic. No per-site tilt semantics. Archive playback not verified.',
  },
  {
    id: 'iem_n0r',
    label: 'IEM National N0R Composite',
    scope: 'national',
    status: 'VERIFIED',
    provider: 'Iowa Environmental Mesonet (IEM)',
    url: 'https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0r-900913/{z}/{x}/{y}.png',
    provenance: 'IEM national NEXRAD N0R mosaic (NOAA NWS NEXRAD)',
    refreshMinutes: 5,
    latencyMinutes: 5,
    notes: 'Verified national base-reflectivity mosaic. No per-site tilt semantics.',
  },
  {
    id: 'iem_n0q_recent',
    label: 'IEM National N0Q Composite (5-minute)',
    scope: 'national',
    status: 'VERIFIED',
    provider: 'Iowa Environmental Mesonet (IEM)',
    url: 'https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q-m05m/{z}/{x}/{y}.png',
    provenance: 'IEM national NEXRAD N0Q mosaic, 5-minute-offset layer (NOAA NWS NEXRAD)',
    refreshMinutes: 5,
    latencyMinutes: 5,
    notes: 'Verified live: tile.py 1.0.0/nexrad-n0q-m05m/4/3/6.png returned a real 256x256 PNG with 129 distinct reported reflectivity colours. Archive playback not verified.',
  },
  {
    id: 'mrms_cref',
    label: 'MRMS Composite Reflectivity (Merged CREF)',
    scope: 'national',
    status: 'UNAVAILABLE',
    provider: 'NOAA MRMS',
    url: null,
    provenance: 'DATA UNAVAILABLE - no verified MRMS MergedReflectivityComposite tile endpoint in MesoVortexWX.',
    refreshMinutes: null,
    latencyMinutes: null,
    notes: 'DATA UNAVAILABLE. Probes 2026-11-25: IEM tile.py mrms/mrms-t layers are listed but every sampled tile returns HTTP 404; NOAA MRMS S3 (noaa-mrms-pds) publishes GRIB2, not a ready XYZ tile; mrms.nssl.noaa.gov geoserver returns HTTP 410. The verified /api/radar/mrms-tile products are hazard fields (azshear, mesh, tops), not reflectivity.',
  },
  {
    id: 'regional_composite',
    label: 'Regional Composite',
    scope: 'regional',
    status: 'UNAVAILABLE',
    provider: 'Not verified',
    url: null,
    provenance: 'DATA UNAVAILABLE - No verified regional composite tile source.',
    refreshMinutes: null,
    latencyMinutes: null,
    notes: 'DATA UNAVAILABLE. Would require a verified regional NWS/IEM composite endpoint.',
  },
  {
    id: 'canada_composite',
    label: 'Canada Composite (ECCC Radar)',
    scope: 'international',
    status: 'VERIFIED',
    provider: 'Environment and Climate Change Canada (GeoMet WMS)',
    url: 'https://geo.weather.gc.ca/geomet?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=RADAR_1KM_RRAI&STYLES=Radar-Rain_14colors&CRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256&FORMAT=image/png&TRANSPARENT=true',
    provenance: 'ECCC/MSC GeoMet WMS RADAR_1KM_RRAI 1 km national radar composite',
    refreshMinutes: 10,
    latencyMinutes: null,
    notes: 'Verified live 2026-11-25: GetCapabilities 200 and GetMap with EPSG:3857 BBOX returned a real 256x256 PNG with 64 distinct reported colours. No Canadian warnings/forecast zones claimed; latency not published by source.',
  },
  {
    id: 'europe_composite',
    label: 'Europe-wide Radar Composite',
    scope: 'international',
    status: 'UNAVAILABLE',
    provider: 'Not verified',
    url: null,
    provenance: 'DATA UNAVAILABLE - no verified open Europe-wide radar composite feed integrated.',
    refreshMinutes: null,
    latencyMinutes: null,
    notes: 'DATA UNAVAILABLE. Probe 2026-11-25: opendata.dwd.de radar composite path unreachable; EUMETSAT view WMS is verified satellite imagery (SEVIRI), not radar, so it must not be labelled a radar composite. OPERA/EUMETNET composites require access not verified here.',
  },
  {
    id: 'international_composite',
    label: 'International Composite',
    scope: 'international',
    status: 'UNAVAILABLE',
    provider: 'Not verified',
    url: null,
    provenance: 'DATA UNAVAILABLE - No verified international composite feed integrated.',
    refreshMinutes: null,
    latencyMinutes: null,
    notes: 'DATA UNAVAILABLE. No verified global composite source.',
  },
];

export function getCompositeSource(id: string): CompositeSource | undefined {
  return COMPOSITE_SOURCES.find((s) => s.id === id);
}