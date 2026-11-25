export type CapabilityStatus = 'WORKING' | 'PARTIAL' | 'UNAVAILABLE';

export interface ObservationCapability {
  id: string;
  name: string;
  category: 'source' | 'reading' | 'tool';
  status: CapabilityStatus;
  reason: string;
  evidence: string[];
}

export const OBSERVATION_CAPABILITIES: readonly ObservationCapability[] = [
  // Sources/products
  { id: 'metar', name: 'METAR observations', category: 'source', status: 'PARTIAL', reason: 'Real AviationWeather METAR stations feed is wired to a live map layer, panel, and MesoAI context; coverage and archive completeness are not fully verified.', evidence: ['app/api/metar/geojson/route.ts', 'lib/metar/surface-feed.ts', 'components/METARPanel.tsx', 'components/RadarMap.tsx'] },
  { id: 'speci', name: 'SPECI reports', category: 'source', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - SPECI-specific parsing/integration not verified.', evidence: ['No dedicated verified SPECI pipeline'] },
  { id: 'asos', name: 'ASOS', category: 'source', status: 'PARTIAL', reason: 'ASOS stations are selected only from genuine METAR reports carrying AUTO/AO1/AO2 remarks; no separate ASOS network feed is claimed.', evidence: ['app/api/asos/geojson/route.ts', 'lib/metar/surface-feed.ts isAsosReport', 'components/METARPanel.tsx'] },
  { id: 'awos', name: 'AWOS', category: 'source', status: 'PARTIAL', reason: 'AWOS observations may be present through METAR/network feeds; dedicated AWOS verification incomplete.', evidence: ['METAR/observation feeds commonly include AWOS; no dedicated AWOS verification'] },
  { id: 'mesonet', name: 'Mesonet networks', category: 'source', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Mesonet network integrations not verified end-to-end.', evidence: ['placefile catalog references mesonets; no verified in-app mesonet data pipeline'] },
  { id: 'pws', name: 'Personal weather stations', category: 'source', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - PWS integration not verified end-to-end.', evidence: ['No verified PWS ingestion pipeline'] },
  { id: 'wu', name: 'Weather Underground station network', category: 'source', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Weather Underground integration not verified.', evidence: ['No verified WU integration'] },
  { id: 'tempest', name: 'Tempest weather stations', category: 'source', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Tempest integration not verified.', evidence: ['No verified Tempest integration'] },
  { id: 'davis', name: 'Davis Instruments stations', category: 'source', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Davis integration not verified.', evidence: ['No verified Davis integration'] },
  { id: 'coop', name: 'Cooperative Observer Program observations', category: 'source', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - COOP integration not verified.', evidence: ['No verified COOP integration'] },
  { id: 'buoy', name: 'Buoy observations', category: 'source', status: 'PARTIAL', reason: 'Real NDBC realtime buoy observation endpoint verified and proxied by API; full network coverage/UI end-to-end verification incomplete.', evidence: ['app/api/buoy/route.ts', 'https://www.ndbc.noaa.gov/data/realtime2/44013.txt'] },
  { id: 'marine', name: 'Marine observations', category: 'source', status: 'PARTIAL', reason: 'Real NDBC realtime marine/buoy observations verified and proxied by API; broader marine observation coverage (ships, C-MAN, etc.) and UI end-to-end verification incomplete.', evidence: ['app/api/buoy/route.ts', 'https://www.ndbc.noaa.gov/data/realtime2/44013.txt'] },
  { id: 'raob', name: 'Upper-air radiosonde observations', category: 'source', status: 'PARTIAL', reason: 'Real IEM RAOB JSON endpoint proxied and WeatherPower sounding route exists; full upper-air product/UI/QA coverage not fully verified.', evidence: ['app/api/sounding/raob/route.ts', 'https://mesonet.agron.iastate.edu/json/raob.py', 'app/api/sounding/route.ts'] },
  { id: 'acars', name: 'Aircraft observations', category: 'source', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Aircraft observations not verified/integrated.', evidence: ['No verified aircraft observation pipeline'] },
  { id: 'pirep', name: 'PIREPs', category: 'source', status: 'PARTIAL', reason: 'Real AviationWeather PIREP API route verified; responses can be empty depending on bbox/time, and full UI/end-to-end coverage incomplete.', evidence: ['app/api/aviation/pirep/route.ts', 'https://aviationweather.gov/api/data/pirep'] },
  { id: 'mping', name: 'mPING reports', category: 'source', status: 'PARTIAL', reason: 'mPING route/layer references exist; end-to-end verification incomplete.', evidence: ['app/api/mping/route.ts', 'placefile/layer references'] },
  { id: 'lsr', name: 'Local storm reports', category: 'source', status: 'PARTIAL', reason: 'LSR route/layer exists; end-to-end verification and completeness not fully verified.', evidence: ['app/api/lsr/route.ts', 'showLSR toggle in UI'] },
  { id: 'spotter_reports', name: 'Spotter reports', category: 'source', status: 'PARTIAL', reason: 'Spotter report routes/UI exist; end-to-end verification/quality control not fully verified.', evidence: ['app/api/spotter/route.ts', 'spotter report UI components'] },
  { id: 'surface_analysis_obs', name: 'Surface analysis observations', category: 'source', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Surface analysis observation product not verified.', evidence: ['No verified surface analysis observation pipeline'] },

  // Individual observation readings
  { id: 'obs_temp', name: 'Temperature', category: 'reading', status: 'PARTIAL', reason: 'Available where METAR/observation source is verified; not all sources verified.', evidence: ['METAR/adapters parse temperature'] },
  { id: 'obs_dewpoint', name: 'Dewpoint', category: 'reading', status: 'PARTIAL', reason: 'Available where METAR/observation source is verified; not all sources verified.', evidence: ['METAR/adapters parse dewpoint'] },
  { id: 'obs_rh', name: 'Relative humidity', category: 'reading', status: 'PARTIAL', reason: 'May be derived/displayed from available observations; end-to-end coverage not fully verified.', evidence: ['Observation adapters/UI'] },
  { id: 'obs_wind', name: 'Wind speed and direction', category: 'reading', status: 'PARTIAL', reason: 'Available where observation source is verified; not all sources verified.', evidence: ['METAR/adapters parse wind'] },
  { id: 'obs_gust', name: 'Wind gusts', category: 'reading', status: 'PARTIAL', reason: 'Available where observation source is verified; not all sources verified.', evidence: ['METAR/adapters parse gusts'] },
  { id: 'obs_pressure', name: 'Barometric pressure', category: 'reading', status: 'PARTIAL', reason: 'Available where observation source is verified; not all sources verified.', evidence: ['METAR/adapters parse pressure'] },
  { id: 'obs_pressure_tendency', name: 'Pressure tendency', category: 'reading', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Pressure tendency not verified end-to-end.', evidence: ['No verified pressure tendency pipeline'] },
  { id: 'obs_precip', name: 'Precipitation', category: 'reading', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Station precipitation observation not verified end-to-end.', evidence: ['No verified station precip observation pipeline'] },
  { id: 'obs_visibility', name: 'Visibility', category: 'reading', status: 'PARTIAL', reason: 'Shown from the real METAR visib field where reported; not all stations report it.', evidence: ['lib/metar/surface-feed.ts visibilitySm', 'components/METARPanel.tsx'] },
  { id: 'obs_ceiling', name: 'Cloud ceilings', category: 'reading', status: 'PARTIAL', reason: 'Shown from the real METAR ceil field where reported; no ceiling is inferred when absent.', evidence: ['lib/metar/surface-feed.ts ceilingFt', 'components/METARPanel.tsx'] },
  { id: 'obs_conditions', name: 'Weather conditions', category: 'reading', status: 'PARTIAL', reason: 'Available where observation source is verified; coverage incomplete.', evidence: ['METAR/weather condition parsing exists in parts'] },
  { id: 'obs_solar', name: 'Solar radiation', category: 'reading', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Solar radiation not verified/integrated.', evidence: ['No verified solar radiation source'] },
  { id: 'obs_uv', name: 'UV index', category: 'reading', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - UV index observation not verified/integrated.', evidence: ['No verified UV observation source'] },
  { id: 'obs_soil', name: 'Soil temperature and moisture, where available', category: 'reading', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Soil temp/moisture not verified/integrated.', evidence: ['No verified soil observation source'] },

  // Tools
  { id: 'obs_clickable_markers', name: 'Clickable station markers', category: 'tool', status: 'PARTIAL', reason: 'METAR/ASOS station points open a real-report popup; full station-type coverage incomplete.', evidence: ['components/RadarMap.tsx SURFACE_POINT_ID popup', 'Map/station UI components'] },
  { id: 'obs_station_history', name: 'Station history', category: 'tool', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Station history not verified/implemented.', evidence: ['No verified station history pipeline'] },
  { id: 'obs_graphs', name: 'Observation graphs', category: 'tool', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Observation graphs not verified/implemented.', evidence: ['No verified observation graph workflow'] },
  { id: 'obs_timeseries_compare', name: 'Time-series comparisons', category: 'tool', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Time-series comparisons not verified/implemented.', evidence: ['No verified time-series comparison workflow'] },
  { id: 'obs_metadata', name: 'Station metadata', category: 'tool', status: 'PARTIAL', reason: 'Some station metadata exists; completeness/verification varies.', evidence: ['Radar/station config and metadata exist in parts'] },
  { id: 'obs_qc', name: 'Quality-control indicators', category: 'tool', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - QC indicators not verified/implemented.', evidence: ['No verified QC indicator pipeline'] },
  { id: 'obs_frequency', name: 'Station reporting frequency', category: 'tool', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Reporting frequency display not verified/implemented.', evidence: ['No verified reporting frequency UI'] },
  { id: 'obs_favorites', name: 'Custom station favorites', category: 'tool', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Station favorites not verified/implemented.', evidence: ['No verified favorites feature'] },
  { id: 'obs_personal_integration', name: 'Personal station integration', category: 'tool', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Personal station integration not verified/implemented.', evidence: ['No verified personal station integration'] },
  { id: 'obs_overlays', name: 'Observation overlays on radar, satellite, and model maps', category: 'tool', status: 'PARTIAL', reason: 'Live METAR/ASOS station points join existing report overlays; full cross-map observation overlay system not verified.', evidence: ['components/RadarMap.tsx SURFACE_SOURCE_ID', 'LSR/spotter/warning overlays'] },
] as const;

export function getObservationCapability(id: string): ObservationCapability | undefined {
  return OBSERVATION_CAPABILITIES.find((c) => c.id === id);
}
