export type DataSourceStatus = 'IMPLEMENTED' | 'PARTIAL' | 'NOT_IMPLEMENTED';

export type DataSourceEntry = {
  id: string;
  category: string;
  data: string;
  source: string;
  status: DataSourceStatus;
  notes?: string;
  attribution?: string;
  url?: string;
};

// Evidence-based registry. Status reflects MesoVortexWX implementation/verification,
// not whether the upstream provider exists. "NOT_IMPLEMENTED" means requested/planned
// in product vision or external list, but not verified end-to-end in MesoVortexWX.
export const DATA_SOURCES: DataSourceEntry[] = [
  { id: 'radar-iem-ridge', category: 'Radar', data: 'NEXRAD/TDWR single-site Level III tiles (REF/VEL/SRV/TZL/TV0 as verified)', source: 'Iowa Environmental Mesonet (IEM) / NOAA NEXRAD', status: 'IMPLEMENTED', attribution: 'Iowa Environmental Mesonet (IEM) / NOAA NEXRAD', url: 'https://mesonet.agron.iastate.edu/', notes: 'Capability-gated by lib/radar/capability-matrix.ts. Archive/playback only where verified.' },
  { id: 'radar-rainviewer', category: 'Radar', data: 'Composite radar tile timeline', source: 'RainViewer Weather Maps API', status: 'PARTIAL', attribution: 'RainViewer', url: 'https://www.rainviewer.com/', notes: 'UNVERIFIED composite semantics; not equivalent to single-site verified Level III. /api/radar/tiles.' },
  { id: 'radar-mrms-aws', category: 'Radar', data: 'MRMS real-time S3 object listing (scaffold)', source: 'NOAA MRMS AWS Open Data', status: 'PARTIAL', attribution: 'NOAA MRMS / AWS Open Data', url: 'https://registry.opendata.aws/noaa-mrms-pds/', notes: 'Listing/scaffold only; no verified GRIB2 decode/tile/render.' },
  { id: 'alerts-nws', category: 'Warnings & Alerts', data: 'Active watches/warnings/advisories', source: 'api.weather.gov alerts', status: 'IMPLEMENTED', attribution: 'NOAA/NWS', url: 'https://api.weather.gov/', notes: 'Normalized by lib/alerts/model.ts; polled in use-fast-alerts.' },
  { id: 'warnings-geojson', category: 'Warnings & Alerts', data: 'Warning/watch polygons (legacy endpoints)', source: 'api.weather.gov / IEM', status: 'PARTIAL', attribution: 'NOAA/NWS, IEM', notes: 'Legacy/parallel endpoints exist (/api/warnings, /api/watches, /api/nws/wwa-map); consolidate carefully.' },
  { id: 'spc-outlooks', category: 'Severe Weather', data: 'SPC convective outlooks Day 1-3, MCD', source: 'NOAA SPC GeoJSON / MapServer', status: 'IMPLEMENTED', attribution: 'NOAA/NWS Storm Prediction Center', url: 'https://www.spc.noaa.gov/', notes: 'Real verified endpoints for included products; fire weather GIS GeoJSON remains unavailable.' },
  { id: 'wpc-ero', category: 'Severe Weather', data: 'WPC Excessive Rainfall Outlook Day 1-5', source: 'NOAA WPC GeoJSON', status: 'IMPLEMENTED', attribution: 'NOAA/NWS Weather Prediction Center', url: 'https://www.wpc.ncep.noaa.gov/' },
  { id: 'cpc-outlooks', category: 'Climate Outlooks', data: 'CPC temp/precip outlook layers (6-10, 8-14, monthly, seasonal)', source: 'NOAA CPC MapServer', status: 'PARTIAL', attribution: 'NOAA/NWS Climate Prediction Center', url: 'https://www.cpc.ncep.noaa.gov/', notes: 'Real endpoints proxied; full UI coverage/verification varies.' },
  { id: 'nhc', category: 'Tropical', data: 'NHC tropical outlook/two shapefile/KMZ', source: 'NHC/CPHC', status: 'PARTIAL', attribution: 'NOAA/NWS National Hurricane Center', url: 'https://www.nhc.noaa.gov/', notes: 'GTWO shapefile/KMZ proxied; GeoJSON conversion/UI wiring limited.' },
  { id: 'satellite-iem-goes', category: 'Satellite', data: 'GOES-East/West selected channels/sectors', source: 'IEM GOES cache tiles', status: 'PARTIAL', attribution: 'NOAA/NESDIS via IEM', url: 'https://mesonet.agron.iastate.edu/', notes: 'Only capability-matrix-verified channels/sectors; many advanced products unavailable.' },
  { id: 'satellite-gibs', category: 'Satellite', data: 'NASA GIBS global imagery', source: 'NASA GIBS', status: 'NOT_IMPLEMENTED', attribution: 'NASA GIBS', notes: 'Not verified/wired as end-to-end MesoVortexWX product.' },
  { id: 'obs-metar', category: 'Observations', data: 'METAR observations', source: 'AviationWeather.gov / NWS', status: 'PARTIAL', attribution: 'NOAA/NWS AviationWeather', url: 'https://aviationweather.gov/' },
  { id: 'obs-taf-pirep-airsigmet', category: 'Aviation', data: 'TAF, PIREP, AIRMET/SIGMET', source: 'AviationWeather.gov', status: 'PARTIAL', attribution: 'NOAA/NWS AviationWeather', url: 'https://aviationweather.gov/' },
  { id: 'obs-lsr', category: 'Observations', data: 'Local Storm Reports', source: 'IEM/NWS GeoJSON', status: 'PARTIAL', attribution: 'IEM/NWS', url: 'https://mesonet.agron.iastate.edu/lsr/' },
  { id: 'obs-mping', category: 'Observations', data: 'mPING crowdsourced reports', source: 'mPING / OU NSSL', status: 'PARTIAL', attribution: 'NSSL mPING', url: 'https://mping.ou.edu/' },
  { id: 'obs-spotter', category: 'Observations', data: 'Spotter Network positions/reports', source: 'SpotterNetwork / IEM', status: 'PARTIAL', attribution: 'SpotterNetwork.org (non-commercial), IEM/NWS', url: 'https://www.spotternetwork.org/' },
  { id: 'marine-ndbc', category: 'Marine', data: 'NDBC buoy observations', source: 'NOAA NDBC', status: 'PARTIAL', attribution: 'NOAA NDBC', url: 'https://www.ndbc.noaa.gov/' },
  { id: 'marine-alerts', category: 'Marine', data: 'Marine warnings/alerts', source: 'api.weather.gov marine alerts', status: 'PARTIAL', attribution: 'NOAA/NWS' },
  { id: 'soundings-raob', category: 'Soundings', data: 'RAOB sounding observations proxy', source: 'IEM RAOB JSON', status: 'PARTIAL', attribution: 'IEM / NWS/University of Wyoming RAOB data as upstreams', url: 'https://mesonet.agron.iastate.edu/json/raob.py' },
  { id: 'soundings-weatherpower', category: 'Soundings', data: 'WeatherPower sounding endpoint', source: 'WeatherPower API', status: 'PARTIAL', attribution: 'WeatherPower (authorized use)', notes: 'Requires WEATHERPOWER_API_KEY; returns DATA UNAVAILABLE when missing. External key closure tracked separately.' },
  { id: 'models-open-meteo', category: 'Models', data: 'Selected model fields/proxies (Open-Meteo where verified)', source: 'Open-Meteo and other verified providers per model registry', status: 'PARTIAL', attribution: 'Open-Meteo (CC BY 4.0) and per-model attributions', url: 'https://open-meteo.com/', notes: 'Most model-registry entries are NEEDS_SOURCE/RESTRICTED; only verified READY_NOW/partial end-to-end paths should be exposed.' },
  { id: 'ai-gemini', category: 'AI', data: 'Weather assistant / MCD copilot', source: 'Google Gemini API', status: 'PARTIAL', attribution: 'Google Gemini (user-configured API key)', notes: 'Requires GEMINI_API_KEY; AI output is non-authoritative and must not replace official NWS/SPC products.' },
  { id: 'basemap-mapbox', category: 'Basemap', data: 'Mapbox basemap styles/tiles', source: 'Mapbox', status: 'IMPLEMENTED', attribution: '© Mapbox © OpenStreetMap', url: 'https://www.mapbox.com/' },
  { id: 'basemap-osm', category: 'Basemap', data: 'OpenStreetMap data in basemap attributions', source: 'OpenStreetMap contributors', status: 'IMPLEMENTED', attribution: '© OpenStreetMap contributors', url: 'https://www.openstreetmap.org/copyright' },
  { id: 'placefiles', category: 'Custom', data: 'User placefile overlays', source: 'User-supplied placefile URLs/content', status: 'PARTIAL', attribution: 'User-supplied / upstream placefile provider', notes: 'Input validation/SSRF hardening should be reviewed before broad exposure.' },

  // Requested/planned items from external lists - not verified end-to-end in MesoVortexWX.
  { id: 'plan-forecast-open-meteo', category: 'Planned/Requested', data: 'Forecast/nowcast/recent rainfall/air quality/smoke/pollen/geocoding', source: 'Open-Meteo', status: 'NOT_IMPLEMENTED', attribution: 'Open-Meteo (CC BY 4.0)', notes: 'Not verified end-to-end in current MesoVortexWX workstation.' },
  { id: 'plan-lightning-glm', category: 'Planned/Requested', data: 'GOES GLM flashes / strike density', source: 'NOAA Open Data AWS / nowCOAST', status: 'NOT_IMPLEMENTED', attribution: 'NOAA', notes: 'GLM route exists but is env-fragile/host-specific; not production-verified.' },
  { id: 'plan-snow-maps', category: 'Planned/Requested', data: 'WPC snow probabilities, NOHRSC snow depth', source: 'WPC / NOHRSC', status: 'NOT_IMPLEMENTED', attribution: 'NOAA/NWS WPC, NOHRSC' },
  { id: 'plan-hrrr-future', category: 'Planned/Requested', data: 'HRRR forecast reflectivity', source: 'IEM', status: 'NOT_IMPLEMENTED', attribution: 'IEM/NOAA' },
  { id: 'plan-level2', category: 'Planned/Requested', data: 'NEXRAD Level II/III archive files', source: 'NOAA Open Data AWS', status: 'NOT_IMPLEMENTED', attribution: 'NOAA NEXRAD AWS Open Data' },
  { id: 'plan-terrain-3d', category: 'Planned/Requested', data: 'Terrain shading / 3D terrain', source: 'Terrain Tiles on AWS / Mapzen', status: 'NOT_IMPLEMENTED', attribution: 'Terrain Tiles on AWS (Mapzen; SRTM, USGS 3DEP, GMTED, ETOPO1)' },
  { id: 'plan-cameras-rivers-wildfire', category: 'Planned/Requested', data: 'Live cameras, river/wildfire/Kp/AFD/normals records', source: 'Various government providers', status: 'NOT_IMPLEMENTED', notes: 'Requested in external source list; not verified/wired in MesoVortexWX.' },
];

export const DATA_SOURCE_STATUS_LABEL: Record<DataSourceStatus, string> = {
  IMPLEMENTED: 'Implemented',
  PARTIAL: 'Partial / Limited',
  NOT_IMPLEMENTED: 'Not implemented',
};
