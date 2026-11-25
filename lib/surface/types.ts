/**
 * Phase 4C canonical surface observation model.
 *
 * This module is source-independent: every renderer, panel and future graph
 * consumes the same field contract. Missing values remain null and are rendered
 * as DATA UNAVAILABLE; no field is inferred unless it is explicitly marked as
 * derived in `derived`.
 */

export type SourceVerification = 'VERIFIED' | 'PARTIAL' | 'UNAVAILABLE';

export type SurfaceNetworkId =
  | 'metar'
  | 'speci'
  | 'asos'
  | 'awos'
  | 'mesonet'
  | 'pws'
  | 'wunderground'
  | 'tempest'
  | 'davis'
  | 'coop'
  | 'buoy'
  | 'marine';

/** Independent workstation layer keys requested for Phase 4C. */
export type SurfaceLayerId = 'metar' | 'aviation' | 'mesonet' | 'pws' | 'buoy' | 'marine';

export type ObservationQuality = 'fresh' | 'stale' | 'unavailable';

/** Aviation flight category derived only from reported ceiling and visibility. */
export type FlightCategory = 'VFR' | 'MVFR' | 'IFR' | 'LIFR';

export interface CloudLayer {
  cover: string;
  baseFt: number | null;
}

export type PresentWeatherCode =
  | 'RA' | 'SN' | 'FG' | 'TS' | 'FZRA' | 'DZ' | 'HZ' | 'FU'
  | 'BR' | 'SH' | 'GR' | 'GS' | 'PL' | 'IC' | 'SG' | 'UP';

export interface FieldValue<T> {
  value: T | null;
  source: 'reported' | 'derived' | 'unavailable';
}

export interface StationPlot {
  /** Unique key for this station/network combination. */
  id: string;
  stationId: string;
  name: string | null;
  network: SurfaceNetworkId;
  layer: SurfaceLayerId;
  stationType: string | null;
  lat: number;
  lon: number;
  elevationM: number | null;
  observedAt: string | null;
  observedAtMs: number | null;
  ageMinutes: number | null;
  quality: ObservationQuality;

  tempC: number | null;
  dewpointC: number | null;
  humidityPct: FieldValue<number>;
  windDirDeg: number | 'VRB' | null;
  windSpeedKt: number | null;
  windGustKt: number | null;
  visibilitySm: string | null;
  pressure: { kind: 'altimeter' | 'slp' | 'unavailable'; value: number | null; display: string | null };
  pressureTendency: string | null;
  waveHeightM: number | null;
  wavePeriodS: number | null;
  waterTempC: number | null;
  skyCoverOkta: number | null;
  ceilingFt: number | null;
  cloudLayers: CloudLayer[];
  flightCategory: FlightCategory | null;
  decodedMetar: string | null;
  presentWeather: PresentWeatherCode[];
  weatherConditions: string | null;

  rawOb: string | null;
  reportType: string | null;
  sourceLabel: string;
  sourceUrl: string | null;
  attribution: string | null;
  /** Raw upstream properties are preserved for future history/comparison work. */
  raw: Record<string, unknown>;
}

export interface SurfaceNetworkDefinition {
  id: SurfaceNetworkId;
  name: string;
  layer: SurfaceLayerId;
  verification: SourceVerification;
  implementation: SourceVerification;
  source: string | null;
  endpoint: string | null;
  fields: string[];
  limitation: string | null;
  evidence: string[];
}

export const SURFACE_NETWORKS: readonly SurfaceNetworkDefinition[] = [
  {
    id: 'metar',
    name: 'METAR',
    layer: 'metar',
    verification: 'VERIFIED',
    implementation: 'VERIFIED',
    source: 'AviationWeather.gov METAR API',
    endpoint: '/api/metar/geojson',
    fields: ['stationId', 'obsTime', 'temp', 'dewp', 'wdir', 'wspd', 'wgst', 'visib', 'ceil', 'altim', 'rawOb', 'wx', 'clouds'],
    limitation: null,
    evidence: ['app/api/metar/geojson/route.ts', 'lib/metar/surface-feed.ts'],
  },
  {
    id: 'speci',
    name: 'SPECI',
    layer: 'aviation',
    verification: 'VERIFIED',
    implementation: 'PARTIAL',
    source: 'AviationWeather.gov METAR API (metarType=SPECI in JSON; rawOb prefix in GeoJSON)',
    endpoint: '/api/metar/geojson',
    fields: ['stationId', 'obsTime', 'temp', 'dewp', 'wdir', 'wspd', 'visib', 'ceil', 'altim', 'slp', 'rawOb', 'metarType'],
    limitation: 'No dedicated SPECI endpoint; GeoJSON returns fewer records than format=json.',
    evidence: ['https://aviationweather.gov/api/data/metar?format=json', 'lib/metar/surface-feed.ts reportType'],
  },
  {
    id: 'asos',
    name: 'ASOS',
    layer: 'aviation',
    verification: 'PARTIAL',
    implementation: 'PARTIAL',
    source: 'AviationWeather.gov METAR API (AUTO/AO1/AO2 remark subset)',
    endpoint: '/api/asos/geojson',
    fields: ['stationId', 'obsTime', 'temp', 'dewp', 'wdir', 'wspd', 'visib', 'ceil', 'altim', 'rawOb'],
    limitation: 'Automated remarks cannot distinguish every ASOS/AWOS site; this is a subset view, not an independent ASOS feed.',
    evidence: ['app/api/asos/geojson/route.ts', 'lib/metar/surface-feed.ts isAsosReport'],
  },
  {
    id: 'awos',
    name: 'AWOS',
    layer: 'aviation',
    verification: 'PARTIAL',
    implementation: 'PARTIAL',
    source: 'IEM network.py station metadata IS_AWOS flag, joined to real METAR observations',
    endpoint: '/api/surface/awos',
    fields: ['attributes.IS_AWOS', 'station id', 'real METAR obs from AWC'],
    limitation: 'AWOS classification uses IEM IS_AWOS metadata per network; only networks with that flag are classified. No AWOS value is synthesized.',
    evidence: ['https://mesonet.agron.iastate.edu/geojson/network.py?network=IA_ASOS', 'app/api/surface/awos/route.ts'],
  },
  {
    id: 'mesonet',
    name: 'Mesonet',
    layer: 'mesonet',
    verification: 'VERIFIED',
    implementation: 'PARTIAL',
    source: 'Iowa Environmental Mesonet /api/1/currents.geojson network observations',
    endpoint: '/api/surface/mesonet?network=ISUSM',
    fields: ['station', 'utc_valid', 'tmpf', 'dwpf', 'relh', 'vsby', 'drct', 'sknt', 'gust', 'alti', 'mslp', 'skyc1-4', 'skyl1-4', 'wxcodes', 'raw', 'lat', 'lon'],
    limitation: 'Network-specific; default ISUSM has sparse coverage. Legacy IDs IOWA/OK_MESONET/KS_MESONET return no records.',
    evidence: ['https://mesonet.agron.iastate.edu/api/1/currents.geojson?network=ISUSM', 'app/api/surface/mesonet/route.ts'],
  },
  {
    id: 'pws',
    name: 'Personal Weather Stations',
    layer: 'pws',
    verification: 'PARTIAL',
    implementation: 'PARTIAL',
    source: 'atmowx public AT Protocol station observations (keyless)',
    endpoint: '/api/surface/pws',
    fields: ['name', 'latitude', 'longitude', 'elevation', 'latest.observedAt', 'temperature', 'dewPoint', 'relativeHumidity', 'wind', 'pressureSeaLevel'],
    limitation: 'Sparse verified network (5 stations at probe time); not a global PWS aggregator.',
    evidence: ['https://atmowx.net/xrpc/net.atmowx.queryStations', 'app/api/surface/pws/route.ts'],
  },
  {
    id: 'wunderground',
    name: 'Weather Underground',
    layer: 'pws',
    verification: 'UNAVAILABLE',
    implementation: 'UNAVAILABLE',
    source: null,
    endpoint: null,
    fields: [],
    limitation: 'DATA UNAVAILABLE - vendor API terms/key required; no verified open feed.',
    evidence: ['https://www.wunderground.com/pws-api/observations/current-conditions documents apiKey requirement'],
  },
  {
    id: 'tempest',
    name: 'Tempest',
    layer: 'pws',
    verification: 'UNAVAILABLE',
    implementation: 'UNAVAILABLE',
    source: null,
    endpoint: null,
    fields: [],
    limitation: 'DATA UNAVAILABLE - vendor token required; no verified open station feed.',
    evidence: ['WeatherFlow Tempest REST API requires token; remote multi-station use restricted'],
  },
  {
    id: 'davis',
    name: 'Davis Instruments',
    layer: 'pws',
    verification: 'UNAVAILABLE',
    implementation: 'UNAVAILABLE',
    source: null,
    endpoint: null,
    fields: [],
    limitation: 'DATA UNAVAILABLE - device/network specific; no verified public aggregation feed.',
    evidence: ['WeatherLink API requires user/pass/apiToken; WeatherLink Live is LAN-only'],
  },
  {
    id: 'coop',
    name: 'Cooperative Observer Program (COOP)',
    layer: 'mesonet',
    verification: 'PARTIAL',
    implementation: 'PARTIAL',
    source: 'IEM COOP daily climate network',
    endpoint: null,
    fields: ['stationId', 'daily high', 'daily low', 'precipitation'],
    limitation: 'Daily climate summaries are not realtime surface plots; no COOP layer is plotted.',
    evidence: ['https://mesonet.agron.iastate.edu/api/1/currents.json?network=IA_COOP', 'IEM COOP is once-daily, not realtime'],
  },
  {
    id: 'buoy',
    name: 'NDBC Buoys',
    layer: 'buoy',
    verification: 'VERIFIED',
    implementation: 'PARTIAL',
    source: 'NOAA NDBC realtime2 observations',
    endpoint: '/api/surface/buoy',
    fields: ['stationId', 'time', 'WDIR', 'WSPD', 'GST', 'WVHT', 'DPD', 'APD', 'PRES', 'PTDY', 'ATMP', 'WTMP', 'DEWP', 'VIS'],
    limitation: 'Station coordinates come from the NDBC station directory, never from invented fallbacks.',
    evidence: ['app/api/surface/buoy/route.ts', 'https://www.ndbc.noaa.gov/data/latest_obs/latest_obs.txt'],
  },
  {
    id: 'marine',
    name: 'Marine observations',
    layer: 'marine',
    verification: 'PARTIAL',
    implementation: 'PARTIAL',
    source: 'NOAA NDBC realtime2 non-buoy stations',
    endpoint: '/api/surface/marine',
    fields: ['stationId', 'time', 'WDIR', 'WSPD', 'PRES', 'ATMP', 'WTMP', 'DEWP'],
    limitation: 'Marine layer uses verified NDBC station metadata; ship observations are not claimed.',
    evidence: ['app/api/surface/marine/route.ts', 'https://www.ndbc.noaa.gov/data/latest_obs/latest_obs.txt'],
  },
];

export const SURFACE_LAYERS: readonly { id: SurfaceLayerId; name: string; note: string }[] = [
  { id: 'metar', name: 'METAR', note: 'All real METAR/SPECI reports' },
  { id: 'aviation', name: 'Aviation', note: 'Automated METAR subset (AUTO/AO1/AO2 remarks)' },
  { id: 'mesonet', name: 'Mesonet', note: 'Public IEM mesonet networks only' },
  { id: 'pws', name: 'Personal Weather Stations', note: 'Sparse verified atmowx public network; vendor networks need keys' },
  { id: 'buoy', name: 'Buoys', note: 'NOAA NDBC buoy observations' },
  { id: 'marine', name: 'Marine', note: 'NOAA NDBC marine stations' },
];

/** Future-facing contracts: implemented as adapters, not as claimed live data. */
export interface StationHistoryQuery {
  stationId: string;
  network: SurfaceNetworkId;
  start: string;
  end: string;
}

export interface ObservationComparisonQuery {
  stationIds: string[];
  field: keyof Pick<StationPlot, 'tempC' | 'dewpointC' | 'windSpeedKt' | 'pressure' | 'visibilitySm'>;
}

export interface SurfaceAnalysisJob {
  id: string;
  kind: 'surface-analysis' | 'front-analysis' | 'mesonet-overlay';
  status: 'planned' | 'ready' | 'unavailable';
  requiredSource: SurfaceNetworkId | null;
  note: string;
}

export const FUTURE_SURFACE_ARCHITECTURE: readonly SurfaceAnalysisJob[] = [
  { id: 'station-history', kind: 'surface-analysis', status: 'planned', requiredSource: null, note: 'StationPlot raw observations are retained per station for a future history adapter.' },
  { id: 'time-series', kind: 'surface-analysis', status: 'planned', requiredSource: null, note: 'Uniform StationPlot fields provide a stable series contract.' },
  { id: 'observation-comparison', kind: 'surface-analysis', status: 'planned', requiredSource: null, note: 'Comparison consumes canonical fields, never provider-specific shapes.' },
  { id: 'station-favorites', kind: 'surface-analysis', status: 'planned', requiredSource: null, note: 'Station id/network key is stable across adapters.' },
  { id: 'front-analysis', kind: 'front-analysis', status: 'unavailable', requiredSource: null, note: 'DATA UNAVAILABLE - no analyzed surface fronts feed; NOAA forecast-chart fronts are a different product.' },
  { id: 'mesonet-overlays', kind: 'mesonet-overlay', status: 'planned', requiredSource: 'mesonet', note: 'Mesonet adapter emits the same StationPlot contract.' },
];
