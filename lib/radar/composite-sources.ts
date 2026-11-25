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
    id: 'mrms_cref',
    label: 'MRMS Composite Reflectivity (Merged CREF)',
    scope: 'national',
    status: 'UNAVAILABLE',
    provider: 'NOAA MRMS',
    url: null,
    provenance: 'DATA UNAVAILABLE - MRMS MergedReflectivityComposite tile endpoint not verified in MesoVortexWX.',
    refreshMinutes: null,
    latencyMinutes: null,
    notes: 'DATA UNAVAILABLE. MRMS GRIB2 products (azshear, mesh, tops, etc.) are verified via /api/radar/mrms-tile, but a merged composite-reflectivity tile is not.',
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
    label: 'Canada Composite',
    scope: 'international',
    status: 'UNAVAILABLE',
    provider: 'Environment and Climate Change Canada',
    url: null,
    provenance: 'DATA UNAVAILABLE - No verified ECCC composite feed integrated.',
    refreshMinutes: null,
    latencyMinutes: null,
    notes: 'DATA UNAVAILABLE. ECCC radar composites are not integrated/verified in MesoVortexWX.',
  },
  {
    id: 'europe_composite',
    label: 'Europe-wide Composite',
    scope: 'international',
    status: 'UNAVAILABLE',
    provider: 'Not verified',
    url: null,
    provenance: 'DATA UNAVAILABLE - No verified Europe-wide composite feed integrated.',
    refreshMinutes: null,
    latencyMinutes: null,
    notes: 'DATA UNAVAILABLE. OPERA/EUMETNET composites are not integrated/verified in MesoVortexWX.',
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