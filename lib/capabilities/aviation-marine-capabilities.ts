export type CapabilityStatus = 'WORKING' | 'PARTIAL' | 'UNAVAILABLE';

export interface AviationMarineCapability {
  id: string;
  name: string;
  category: 'aviation' | 'marine';
  status: CapabilityStatus;
  reason: string;
  evidence: string[];
}

export const AVIATION_MARINE_CAPABILITIES: readonly AviationMarineCapability[] = [
  { id: 'metar_taf', name: 'METAR and TAF', category: 'aviation', status: 'PARTIAL', reason: 'Real AviationWeather METAR and TAF API routes verified; METAR/SPECI reports render as canvas station models with clickable details, TAF UI remains incomplete.', evidence: ['app/api/metar/geojson/route.ts', 'app/api/aviation/taf/route.ts', 'lib/surface/station-model.ts', 'https://aviationweather.gov/api/data/metar', 'https://aviationweather.gov/api/data/taf'] },
  { id: 'pireps', name: 'PIREPs', category: 'aviation', status: 'PARTIAL', reason: 'Real AviationWeather PIREP API route verified; response can be empty depending on area/time; full UI/end-to-end coverage incomplete.', evidence: ['app/api/aviation/pirep/route.ts', 'https://aviationweather.gov/api/data/pirep'] },
  { id: 'aviation_warnings', name: 'Aviation weather warnings', category: 'aviation', status: 'PARTIAL', reason: 'Real AIRMET/SIGMET endpoint available via AIRSIGMET route; broader aviation warning coverage/UI incomplete.', evidence: ['app/api/aviation/airsigmet/route.ts'] },
  { id: 'ceiling_visibility', name: 'Ceiling and visibility', category: 'aviation', status: 'PARTIAL', reason: 'Shown from real METAR visib/ceil fields on station models and in clickable details where reported; no value is inferred when absent.', evidence: ['lib/metar/surface-feed.ts', 'lib/surface/station-model.ts', 'components/RadarMap.tsx'] },
  { id: 'icing_forecasts', name: 'Icing forecasts', category: 'aviation', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - No verified icing forecast product integration.', evidence: ['No verified icing forecast pipeline'] },
  { id: 'turbulence_forecasts', name: 'Turbulence forecasts', category: 'aviation', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - No verified turbulence forecast product integration.', evidence: ['No verified turbulence forecast pipeline'] },
  { id: 'convective_sigmets', name: 'Convective SIGMETs', category: 'aviation', status: 'PARTIAL', reason: 'Real AIRSIGMET endpoint supports hazard/type filtering; convective SIGMET-specific verification/UI incomplete.', evidence: ['app/api/aviation/airsigmet/route.ts?hazard=conv'] },
  { id: 'sigmets', name: 'SIGMETs', category: 'aviation', status: 'PARTIAL', reason: 'Real AIRSIGMET API route verified; full SIGMET UI/end-to-end coverage incomplete.', evidence: ['app/api/aviation/airsigmet/route.ts'] },
  { id: 'airmets', name: 'AIRMETs', category: 'aviation', status: 'PARTIAL', reason: 'Real AIRSIGMET API route verified; full AIRMET UI/end-to-end coverage incomplete.', evidence: ['app/api/aviation/airsigmet/route.ts?type=airmet'] },
  { id: 'flight_level_winds', name: 'Flight-level winds', category: 'aviation', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - No verified flight-level winds integration.', evidence: ['No verified flight-level winds pipeline'] },
  { id: 'freezing_levels', name: 'Freezing levels', category: 'aviation', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - No verified freezing level integration.', evidence: ['No verified freezing level pipeline'] },
  { id: 'winds_aloft', name: 'Winds aloft', category: 'aviation', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - No verified winds aloft integration.', evidence: ['No verified winds aloft pipeline'] },
  { id: 'aviation_overlays', name: 'Radar and satellite overlays', category: 'aviation', status: 'PARTIAL', reason: 'Radar/satellite overlays exist generally; aviation-specific overlay workflow not fully verified.', evidence: ['Existing radar/satellite layers'] },
  { id: 'aviation_sounding', name: 'Aviation sounding analysis', category: 'aviation', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - No verified aviation sounding analysis pipeline.', evidence: ['No verified aviation sounding analysis'] },

  { id: 'marine_buoy', name: 'Buoy observations', category: 'marine', status: 'PARTIAL', reason: 'NDBC latest_obs buoy stations are plotted as station models with reported fields and source links; full network/field coverage remains source-dependent.', evidence: ['app/api/surface/buoy/route.ts', 'lib/surface/ndbc.ts', 'https://www.ndbc.noaa.gov/data/latest_obs/latest_obs.txt'] },
  { id: 'marine_waves', name: 'Wave height and period', category: 'marine', status: 'PARTIAL', reason: 'Shown in clickable NDBC station details from WVHT/DPD/APD where reported; absent values remain DATA UNAVAILABLE.', evidence: ['lib/surface/ndbc.ts', 'lib/surface/station-model.ts stationDetailFields'] },
  { id: 'marine_wind', name: 'Wind and gust forecasts', category: 'marine', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - No verified marine wind/gust forecast integration.', evidence: ['No verified marine forecast pipeline'] },
  { id: 'marine_warnings', name: 'Marine warnings', category: 'marine', status: 'PARTIAL', reason: 'Real NWS active marine alerts endpoint verified and proxied; full UI/end-to-end coverage incomplete.', evidence: ['app/api/marine/alerts/route.ts', 'https://api.weather.gov/alerts/active?region_type=marine'] },
  { id: 'sst', name: 'Sea-surface temperatures', category: 'marine', status: 'PARTIAL', reason: 'Shown in clickable NDBC station details from WTMP where reported; no gridded SST product is claimed.', evidence: ['lib/surface/ndbc.ts', 'lib/surface/station-model.ts stationDetailFields'] },
  { id: 'tides', name: 'Tidal predictions', category: 'marine', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - No verified tidal prediction integration in app API/UI.', evidence: ['NOAA CO-OPS API exists but not integrated/verified in app'] },
  { id: 'currents', name: 'Ocean currents, where available', category: 'marine', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - No verified ocean currents integration.', evidence: ['No verified currents pipeline'] },
  { id: 'coastal_forecasts', name: 'Coastal weather forecasts', category: 'marine', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - No verified coastal forecast integration.', evidence: ['No verified coastal forecast pipeline'] },
  { id: 'tropical_monitoring', name: 'Tropical cyclone monitoring', category: 'marine', status: 'PARTIAL', reason: 'Tropical/NHC-related routes exist; full tropical monitoring coverage not fully verified end-to-end.', evidence: ['app/api/tropical/cyclones/route.ts', 'app/api/nhc/outlooks/route.ts'] },
] as const;
