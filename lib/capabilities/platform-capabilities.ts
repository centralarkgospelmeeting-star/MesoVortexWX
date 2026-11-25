export type CapabilityStatus = 'WORKING' | 'PARTIAL' | 'UNAVAILABLE';

export interface PlatformCapability {
  id: string;
  name: string;
  category: 'map' | 'aviation' | 'marine' | 'analysis' | 'export' | 'workspace';
  status: CapabilityStatus;
  reason: string;
  evidence: string[];
}

export const PLATFORM_CAPABILITIES: readonly PlatformCapability[] = [
  // Mapping / basemaps / location
  { id: 'map_street', name: 'High-resolution street maps', category: 'map', status: 'PARTIAL', reason: 'Map basemap styles exist; high-resolution street map quality/licensing/end-to-end verification incomplete.', evidence: ['Map basemap switching exists in app/page.tsx and RadarMap'] },
  { id: 'map_terrain', name: 'Terrain maps', category: 'map', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Verified terrain basemap layer not integrated/verified end-to-end.', evidence: ['No verified terrain basemap pipeline'] },
  { id: 'map_satellite_basemap', name: 'Satellite basemaps', category: 'map', status: 'PARTIAL', reason: 'Satellite-streets basemap option exists; end-to-end source/licensing/availability verification incomplete.', evidence: ['Basemap controls include satellite-streets'] },
  { id: 'map_topographic', name: 'Topographic maps', category: 'map', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Verified topographic basemap not integrated.', evidence: ['No verified topo basemap'] },
  { id: 'map_3d_globe', name: '3D globe', category: 'map', status: 'PARTIAL', reason: 'Projection toggle includes globe; full 3D globe capability and data rendering verification incomplete.', evidence: ['app/page.tsx projectionMode globe', 'RadarMap projection support'] },
  { id: 'map_elevation', name: 'Elevation data', category: 'map', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Elevation data not verified/integrated.', evidence: ['No verified elevation pipeline'] },
  { id: 'map_boundaries', name: 'County and state boundaries', category: 'map', status: 'PARTIAL', reason: 'Boundary layers/overlays exist in parts; full verified county/state boundary product coverage incomplete.', evidence: ['Map overlays/boundaries referenced in app'] },
  { id: 'map_radar_coverage', name: 'Radar coverage maps', category: 'map', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Radar coverage map not verified/integrated as dedicated product.', evidence: ['No verified coverage map'] },
  { id: 'map_radar_stations', name: 'Radar station locations', category: 'map', status: 'PARTIAL', reason: 'Radar station metadata/endpoints exist; dedicated station location map UI verification incomplete.', evidence: ['app/api/radar/stations/route.ts', 'radar station registries'] },
  { id: 'map_airports', name: 'Airport locations', category: 'map', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Airport location layer not verified/integrated.', evidence: ['No verified airport layer'] },
  { id: 'map_weather_stations', name: 'Weather station locations', category: 'map', status: 'PARTIAL', reason: 'Station data exists in parts; full weather station location layer not verified end-to-end.', evidence: ['METAR/station APIs exist'] },
  { id: 'map_custom_layers', name: 'Custom map layers', category: 'map', status: 'PARTIAL', reason: 'Local user drawing/annotation layers exist; external/custom meteorological data layer ingestion is not fully verified.', evidence: ['components/RadarMap.tsx tool overlays'] },
  { id: 'map_coord_search', name: 'Coordinate search', category: 'map', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Coordinate search not verified/implemented.', evidence: ['No verified coordinate search UI'] },
  { id: 'map_zip_city_search', name: 'ZIP code and city search', category: 'map', status: 'PARTIAL', reason: 'Location search exists in parts; ZIP/city search coverage/verification incomplete.', evidence: ['Location search UI exists in app components'] },
  { id: 'map_latlon_search', name: 'Latitude/longitude search', category: 'map', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Dedicated lat/lon search not verified/implemented.', evidence: ['No verified lat/lon search UI'] },
  { id: 'map_distance', name: 'Distance measurement', category: 'map', status: 'WORKING', reason: 'Map distance measurement tool implemented using geodesic calculations; user measurement, not meteorological data.', evidence: ['components/RadarMap.tsx tool mode', 'lib/map-tools/geo.ts'] },
  { id: 'map_area', name: 'Area measurement', category: 'map', status: 'WORKING', reason: 'Map area measurement tool implemented using geodesic spherical polygon area; user measurement, not meteorological data.', evidence: ['components/RadarMap.tsx tool mode', 'lib/map-tools/geo.ts'] },
  { id: 'map_drawing', name: 'Drawing tools', category: 'map', status: 'WORKING', reason: 'Drawing/annotation tools implemented as local user overlays (point/line/polygon/annotation).', evidence: ['components/RadarMap.tsx', 'components/map-tools/ToolboxPanel.tsx'] },
  { id: 'map_storm_path_plot', name: 'Storm-path plotting', category: 'map', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Storm-path plotting tool not verified/implemented.', evidence: ['Storm tracks may exist but user plotting not verified'] },
  { id: 'map_offline', name: 'Offline maps', category: 'map', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Offline map caching/product not verified/implemented.', evidence: ['PWA service worker exists but offline maps not verified'] },
  { id: 'map_custom_location_lists', name: 'Custom location lists', category: 'map', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Custom location lists not verified/implemented.', evidence: ['No verified location list feature'] },
  { id: 'map_saved_locations', name: 'Saved locations', category: 'map', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Saved locations not verified/implemented.', evidence: ['No verified saved locations feature'] },
  { id: 'map_custom_markers', name: 'Custom map markers', category: 'map', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Custom map markers not verified/implemented.', evidence: ['No verified custom marker feature'] },

  // Aviation
  { id: 'av_metar_taf', name: 'METAR and TAF', category: 'aviation', status: 'PARTIAL', reason: 'Real AviationWeather METAR/TAF API routes verified; full UI coverage incomplete.', evidence: ['app/api/metar/geojson/route.ts', 'app/api/aviation/taf/route.ts'] },
  { id: 'av_pireps', name: 'PIREPs', category: 'aviation', status: 'PARTIAL', reason: 'Real AviationWeather PIREP route verified; may be empty by area/time; UI incomplete.', evidence: ['app/api/aviation/pirep/route.ts'] },
  { id: 'av_warnings', name: 'Aviation weather warnings', category: 'aviation', status: 'PARTIAL', reason: 'AIRMET/SIGMET data available via real route; full aviation warning product coverage incomplete.', evidence: ['app/api/aviation/airsigmet/route.ts'] },
  { id: 'av_ceil_vis', name: 'Ceiling and visibility', category: 'aviation', status: 'PARTIAL', reason: 'Present in verified METAR where reported; dedicated product/UI incomplete.', evidence: ['METAR fields'] },
  { id: 'av_icing', name: 'Icing forecasts', category: 'aviation', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - No verified icing forecast integration.', evidence: ['No verified pipeline'] },
  { id: 'av_turb', name: 'Turbulence forecasts', category: 'aviation', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - No verified turbulence forecast integration.', evidence: ['No verified pipeline'] },
  { id: 'av_convsigmet', name: 'Convective SIGMETs', category: 'aviation', status: 'PARTIAL', reason: 'Real AIRSIGMET endpoint supports convective hazard filter; dedicated UI/verification incomplete.', evidence: ['app/api/aviation/airsigmet/route.ts'] },
  { id: 'av_sigmet', name: 'SIGMETs', category: 'aviation', status: 'PARTIAL', reason: 'Real AIRSIGMET route verified; dedicated UI incomplete.', evidence: ['app/api/aviation/airsigmet/route.ts'] },
  { id: 'av_airmet', name: 'AIRMETs', category: 'aviation', status: 'PARTIAL', reason: 'Real AIRSIGMET route verified; dedicated UI incomplete.', evidence: ['app/api/aviation/airsigmet/route.ts'] },
  { id: 'av_fl_winds', name: 'Flight-level winds', category: 'aviation', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - No verified flight-level winds integration.', evidence: ['No verified pipeline'] },
  { id: 'av_freezing', name: 'Freezing levels', category: 'aviation', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - No verified freezing level integration.', evidence: ['No verified pipeline'] },
  { id: 'av_winds_aloft', name: 'Winds aloft', category: 'aviation', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - No verified winds aloft integration.', evidence: ['No verified pipeline'] },
  { id: 'av_overlays', name: 'Radar and satellite overlays', category: 'aviation', status: 'PARTIAL', reason: 'General radar/satellite overlays exist; aviation-specific workflows not fully verified.', evidence: ['Radar/satellite modes exist'] },
  { id: 'av_sounding', name: 'Aviation sounding analysis', category: 'aviation', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - No verified aviation sounding analysis integration.', evidence: ['No verified pipeline'] },

  // Marine
  { id: 'mar_buoy', name: 'Buoy observations', category: 'marine', status: 'PARTIAL', reason: 'Real NDBC realtime buoy route verified; full coverage/UI incomplete.', evidence: ['app/api/buoy/route.ts'] },
  { id: 'mar_waves', name: 'Wave height and period', category: 'marine', status: 'PARTIAL', reason: 'Available from verified NDBC realtime data where reported; dedicated UI incomplete.', evidence: ['NDBC WVHT/DPD/APD fields'] },
  { id: 'mar_wind', name: 'Wind and gust forecasts', category: 'marine', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - No verified marine wind/gust forecast integration.', evidence: ['No verified pipeline'] },
  { id: 'mar_warnings', name: 'Marine warnings', category: 'marine', status: 'PARTIAL', reason: 'Real NWS marine alerts route verified; full UI/end-to-end coverage incomplete.', evidence: ['app/api/marine/alerts/route.ts'] },
  { id: 'mar_sst', name: 'Sea-surface temperatures', category: 'marine', status: 'PARTIAL', reason: 'Available from verified NDBC realtime data where reported; dedicated product/UI incomplete.', evidence: ['NDBC WTMP field'] },
  { id: 'mar_tides', name: 'Tidal predictions', category: 'marine', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - No verified tidal prediction integration.', evidence: ['NOAA CO-OPS not integrated in app'] },
  { id: 'mar_currents', name: 'Ocean currents, where available', category: 'marine', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - No verified currents integration.', evidence: ['No verified pipeline'] },
  { id: 'mar_coastal', name: 'Coastal weather forecasts', category: 'marine', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - No verified coastal forecast integration.', evidence: ['No verified pipeline'] },
  { id: 'mar_tropical', name: 'Tropical cyclone monitoring', category: 'marine', status: 'PARTIAL', reason: 'Tropical/NHC routes exist; full end-to-end monitoring coverage incomplete.', evidence: ['app/api/tropical/cyclones/route.ts', 'app/api/nhc/outlooks/route.ts'] },

  // Analysis / workspace / export
  { id: 'an_multi_display', name: 'Radar, satellite, models, and observations displayed simultaneously', category: 'analysis', status: 'PARTIAL', reason: 'Some layers/modes exist independently; fully verified simultaneous multi-dataset rendering workflow incomplete.', evidence: ['Separate radar/satellite/model/observation components exist'] },
  { id: 'an_multi_view', name: 'Dual View, Triple View, and Quad View', category: 'analysis', status: 'PARTIAL', reason: 'Dual/Expert, Triple, and Quad layouts exist with synchronized camera. Full verification across all product combinations remains partial.', evidence: ['app/page.tsx', 'lib/map-sync.ts', 'SynchronizedQuadView.tsx'] },
  { id: 'an_expert_mode', name: 'Expert Mode', category: 'analysis', status: 'PARTIAL', reason: 'Expert mode UI exists with synced panes and per-pane selection; complete verified meteorological workflow remains partial.', evidence: ['app/page.tsx expertMode'] },
  { id: 'an_custom_dash', name: 'Customizable dashboards', category: 'analysis', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Customizable dashboards not verified/implemented.', evidence: ['No verified dashboard builder'] },
  { id: 'an_floating_panels', name: 'Floating analysis panels', category: 'analysis', status: 'PARTIAL', reason: 'Floating panels exist; full configurable analysis panel system not verified.', evidence: ['FloatingProductPanel.tsx exists'] },
  { id: 'an_resizable', name: 'Resizable windows', category: 'analysis', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Resizable window system not verified/implemented.', evidence: ['No verified resizable panel system'] },
  { id: 'an_independent_controls', name: 'Independent map controls', category: 'analysis', status: 'PARTIAL', reason: 'Some independent controls exist; full per-panel control system not verified.', evidence: ['Multi-view components exist'] },
  { id: 'an_sync_timelines', name: 'Synchronized timelines', category: 'analysis', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Fully verified synchronized timeline system across all products not implemented.', evidence: ['No verified cross-product timeline sync'] },
  { id: 'an_sync_nav', name: 'Synchronized map navigation', category: 'analysis', status: 'PARTIAL', reason: 'Map sync utility exists; full multi-view navigation verification incomplete.', evidence: ['lib/map-sync.ts'] },
  { id: 'an_multiple_products', name: 'Multiple simultaneous products', category: 'analysis', status: 'PARTIAL', reason: 'Some simultaneous overlays exist; full verified multi-product system incomplete.', evidence: ['Multiple toggles/layers exist'] },
  { id: 'an_cross_sections', name: 'Cross sections', category: 'analysis', status: 'PARTIAL', reason: 'Live single-radar NOAA Level II reflectivity transect extraction and display passed production-build and live KLZK smoke validation; terrain-corrected AGL and Cartesian volume reconstruction remain out of scope.', evidence: ['app/api/radar/cross-section/route.ts great-circle transect sampling', 'components/RadarMap.tsx', 'components/CrossSectionModal.tsx', 'GitHub Actions live KLZK test: 12 sweeps and 135 measured gates'] },
  { id: 'an_vertical_profiles', name: 'Vertical profiles', category: 'analysis', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Vertical profiles not verified/implemented.', evidence: ['No verified vertical profile pipeline'] },
  { id: 'an_timeseries', name: 'Time-series graphs', category: 'analysis', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Time-series graphs not verified/implemented.', evidence: ['No verified time-series graph workflow'] },
  { id: 'an_soundings', name: 'Sounding diagrams', category: 'analysis', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Sounding diagrams not verified/implemented end-to-end.', evidence: ['No verified sounding diagram pipeline'] },
  { id: 'an_hodographs', name: 'Hodographs', category: 'analysis', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Hodographs not verified/implemented.', evidence: ['No verified hodograph pipeline'] },

  { id: 'ws_custom_color_tables', name: 'Custom color tables', category: 'workspace', status: 'PARTIAL', reason: 'Color table selection exists; full custom authoring/import not verified.', evidence: ['Color table selector in UI'] },
  { id: 'ws_custom_overlays', name: 'Custom overlays', category: 'workspace', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Custom overlay authoring not verified/implemented.', evidence: ['No verified overlay authoring'] },
  { id: 'ws_custom_display', name: 'Custom display configurations', category: 'workspace', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Custom display configurations not verified/implemented.', evidence: ['No verified config persistence'] },
  { id: 'ws_saveable', name: 'Saveable workspaces', category: 'workspace', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Saveable workspaces not verified/implemented.', evidence: ['No verified workspace persistence'] },
  { id: 'ws_custom_themes', name: 'Custom themes', category: 'workspace', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Custom themes not verified/implemented.', evidence: ['No verified theme system'] },
  { id: 'ws_notifications', name: 'Custom notification settings', category: 'workspace', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Custom notification settings not verified/implemented.', evidence: ['No verified notification settings'] },
  { id: 'ws_shortcuts', name: 'Keyboard shortcuts', category: 'workspace', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Keyboard shortcuts not verified/implemented.', evidence: ['No verified shortcut system'] },

  { id: 'ex_data_export', name: 'Data export', category: 'export', status: 'PARTIAL', reason: 'PNG map canvas export implemented for currently rendered real pixels. Structured meteorological data export pipeline is not fully verified/end-to-end.', evidence: ['app/page.tsx exportMapPng', 'components/map-tools/ToolboxPanel.tsx'] },
  { id: 'ex_image_anim_export', name: 'Image and animation export', category: 'export', status: 'PARTIAL', reason: 'PNG export available; animated GIF/video export is only allowed from real frames and currently reports unavailable when no verified encoder/capture path exists. No fake/interpolated frames.', evidence: ['app/page.tsx exportMapPng/exportMapGif'] },
  { id: 'ex_data_sampling', name: 'Custom data sampling', category: 'export', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Custom data sampling not verified/implemented.', evidence: ['No verified sampling tool'] },
  { id: 'ex_historical_playback', name: 'Historical event playback', category: 'export', status: 'PARTIAL', reason: 'Historical playback exists for some verified radar products; broad historical event playback not fully verified.', evidence: ['Radar playback/archive partial per capability matrix'] },
] as const;
