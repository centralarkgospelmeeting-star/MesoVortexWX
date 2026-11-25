/**
 * Feature Capability Matrix - honest status for requested advanced features.
 * No fake data, no unverified enablement. UNKNOWN/UNVERIFIED => UNAVAILABLE/PARTIAL as justified.
 */

export type FeatureStatus = 'WORKING' | 'PARTIAL' | 'UNAVAILABLE';

export interface FeatureCapability {
  id: string;
  name: string;
  category: 'radar' | 'model' | 'analysis' | 'overlay';
  status: FeatureStatus;
  reason: string;
  evidence: string[];
}

const E = '2026-11-22';

export const FEATURE_CAPABILITIES: readonly FeatureCapability[] = [
  // Radar features
  { id: 'fastscan', name: 'FastScan and low-latency radar updates', category: 'radar', status: 'PARTIAL', reason: 'FastScan now polls verified IEM RIDGE volume-scan times and reveals only when a new scan timestamp appears. True ultra-low-latency feed latency is not verified.', evidence: ['lib/radar/iem-scan-time.ts resolves published IEM volume scan timestamps', 'app/api/nexrad/frames/route.ts pins tiles to verified scan timestamps and reports scanTimeAvailable', 'components/RadarMap.tsx reveals only on verified scan-key changes', 'No verified ultra-low-latency feed proof'] },
  { id: 'scan_beam_anim', name: 'Scan-synchronized radar beam animation', category: 'radar', status: 'PARTIAL', reason: 'The beam is no longer always-on decoration. It appears only during a reveal triggered by a verified IEM volume-scan timestamp, while old tiles are replaced by new scan tiles. Level II beam timing itself remains unverified.', evidence: ['components/RadarMap.tsx startReveal/stopReveal gate the beam on scanIngesting', 'components/RadarMap.tsx retains old raster layer and cross-fades to new scan behind the beam', 'lib/radar/iem-scan-time.ts supplies verified volume-scan timestamps', 'No verified Level II beam timing integration'] },
  { id: 'radar_playback', name: 'Historical radar playback', category: 'radar', status: 'PARTIAL', reason: 'Real-archive playback exists only for verified/partial products; many products are LIVE_ONLY/UNAVAILABLE.', evidence: ['Radar capability matrix playback/archive fields', 'nexrad/frames and archive probes show partial archive'] },
  { id: 'extended_archives', name: 'Extended radar archives', category: 'radar', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Extended archives not verified end-to-end across requested products.', evidence: ['Archive probes show PARTIAL/LIVE_ONLY/503 for many products'] },
  { id: 'multi_product_compare', name: 'Multi-product radar comparison', category: 'radar', status: 'PARTIAL', reason: 'Multi-pane views allow side-by-side display of different verified products/sources per pane. Full cross-product comparison analytics/workflow not fully verified; capability gating remains authoritative.', evidence: ['app/page.tsx Dual/Triple/Quad pane product selection', 'lib/radar/capability-matrix.ts gating'] },
  { id: 'multi_view', name: 'Dual View, Triple View and Quad View', category: 'radar', status: 'PARTIAL', reason: 'Dual/Expert, Triple, and Quad view layouts exist with synchronized map camera. End-to-end verification across all products/modes/data sources is still partial; unavailable products remain gated.', evidence: ['app/page.tsx expert/triple/quad layouts', 'lib/map-sync.ts', 'components/SynchronizedQuadView.tsx'] },
  { id: 'expert_mode', name: 'Expert Mode with multiple meteorological products', category: 'radar', status: 'PARTIAL', reason: 'Expert mode dual-pane UI exists with synced camera and per-pane mode selection. Not all meteorological products are verified/available; complete expert workflow remains partially verified.', evidence: ['app/page.tsx expertMode/tripleMode', 'lib/radar/capability-matrix.ts', 'lib/capabilities/feature-capabilities.ts'] },
  { id: 'radar_3d', name: 'Three-dimensional radar visualization', category: 'radar', status: 'PARTIAL', reason: '3D map pitch/tilt and globe projection controls exist, but verified 3D radar volumetric rendering is NOT implemented. UI must not claim volumetric radar rendering.', evidence: ['app/page.tsx mapPitch/projectionMode', 'components/RadarMap.tsx setPitch/setProjection', 'No verified 3D radar volume pipeline'] },
  { id: 'volume_rendering', name: 'Radar volume rendering', category: 'radar', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - True radar volume rendering not verified/implemented. 3D map tilt is visual only and not volumetric radar data.', evidence: ['No verified volume rendering pipeline', 'components/RadarMap.tsx has no volumetric render'] },
  { id: 'cross_sections', name: 'Vertical radar cross sections', category: 'radar', status: 'PARTIAL', reason: 'Live NOAA Level II measured-gate transect API and map-to-viewer workflow are implemented on the XSEC development branch; end-to-end live validation remains pending. This is not a Cartesian 3-D volume reconstruction.', evidence: ['app/api/radar/cross-section/route.ts', 'components/RadarMap.tsx two-point transect selection', 'components/CrossSectionModal.tsx measured sweep display', 'lib/radar/capability-matrix.ts cross_section PARTIAL'] },
  { id: 'storm_interrogation', name: 'Storm interrogation and point sampling', category: 'radar', status: 'PARTIAL', reason: 'Basic inspection/point sampling UI exists in limited form; full storm interrogation not verified end-to-end.', evidence: ['Inspection mode toggle exists', 'No verified full storm interrogation workflow'] },
  { id: 'radar_wind_analysis', name: 'Radar-derived wind analysis', category: 'radar', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Radar-derived wind analysis not verified/implemented.', evidence: ['No verified wind analysis product'] },
  { id: 'storm_relative_analysis', name: 'Storm-relative analysis', category: 'radar', status: 'PARTIAL', reason: 'SRV product exists as PARTIAL where verified; full storm-relative analysis workflow not verified.', evidence: ['SRV capability PARTIAL'] },
  { id: 'storm_tracking', name: 'Storm tracking and projected storm paths', category: 'radar', status: 'PARTIAL', reason: 'Storm tracks overlay/toggle exists in UI; accuracy and end-to-end verification limited.', evidence: ['showStormTracks/toggle present', 'No full verification report for projected paths'] },
  { id: 'distance_tools', name: 'Distance and measurement tools', category: 'radar', status: 'WORKING', reason: 'Local map measurement tools (distance/area) implemented with geodesic calculations; clearly labeled as user measurements, not meteorological data.', evidence: ['components/RadarMap.tsx tool handlers', 'lib/map-tools/geo.ts', 'components/map-tools/ToolboxPanel.tsx'] },
  { id: 'drawing_tools', name: 'Drawing and annotation tools', category: 'radar', status: 'WORKING', reason: 'Local drawing/annotation tools implemented (point/line/polygon/text annotation). Clearly labeled as user annotations, not meteorological data.', evidence: ['components/RadarMap.tsx tool layers', 'components/map-tools/ToolboxPanel.tsx'] },
  { id: 'custom_overlays', name: 'Custom radar overlays', category: 'radar', status: 'PARTIAL', reason: 'Local user drawing/annotation overlays exist. Arbitrary meteorological custom overlay ingestion/authoring from external data is not fully verified.', evidence: ['components/RadarMap.tsx user tool overlays', 'No verified external meteorological overlay ingestion'] },
  { id: 'custom_palettes', name: 'Custom radar color palettes', category: 'radar', status: 'PARTIAL', reason: 'Color table selection and .pal import/parsing exist. Applying imported custom palettes to raster radar tiles is not verified/end-to-end; UI must disclose when mapping is not applied.', evidence: ['app/page.tsx parsePal import status', 'lib/pal.ts', 'components/PalColorTableModal.tsx'] },
  { id: 'export_gif', name: 'Radar data export and animated video/GIF export', category: 'radar', status: 'PARTIAL', reason: 'PNG canvas export is implemented for currently rendered real pixels; animated GIF encoding is explicitly unavailable unless a verified encoder/capture path is present. No fake/interpolated frames are generated.', evidence: ['app/page.tsx exportMapPng/exportMapGif', 'components/map-tools/ToolboxPanel.tsx'] },

  // Model functionality
  { id: 'model_side_by_side', name: 'Side-by-side model comparison', category: 'model', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Model comparison not verified/implemented.', evidence: ['No verified model comparison workflow'] },
  { id: 'model_run_compare', name: 'Model-run comparison', category: 'model', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Model-run comparison not verified/implemented.', evidence: ['No verified run comparison workflow'] },
  { id: 'model_historical_runs', name: 'Historical model runs', category: 'model', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Historical model runs not verified/implemented.', evidence: ['No verified historical model run archive'] },
  { id: 'forecast_hour_selection', name: 'Forecast-hour selection', category: 'model', status: 'PARTIAL', reason: 'UI/state plumbing exists in some areas; no verified end-to-end model map rendering for most models/fields.', evidence: ['modelForecastHour exists in app state/registry', 'Most model fields NEEDS_SOURCE/RESTRICTED'] },
  { id: 'ensemble_mean_spread', name: 'Ensemble mean and spread', category: 'model', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Ensemble mean/spread not verified/implemented.', evidence: ['No verified ensemble product pipeline'] },
  { id: 'probability_forecasts', name: 'Probability forecasts', category: 'model', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Probability forecasts not verified/implemented.', evidence: ['No verified probability product pipeline'] },
  { id: 'plume_diagrams', name: 'Plume diagrams', category: 'model', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Plume diagrams not verified/implemented.', evidence: ['No verified plume diagram pipeline'] },
  { id: 'point_soundings', name: 'Point soundings', category: 'model', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Point soundings not verified/implemented end-to-end.', evidence: ['Sounding route exists but data source/verification not complete for this feature scope'] },
  { id: 'skewt', name: 'Skew-T/log-P diagrams', category: 'model', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Skew-T/log-P not verified/implemented end-to-end.', evidence: ['No verified end-to-end Skew-T pipeline'] },
  { id: 'hodographs', name: 'Hodographs', category: 'model', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Hodographs not verified/implemented.', evidence: ['No verified hodograph pipeline'] },
  { id: 'forecast_cross_sections', name: 'Forecast cross sections', category: 'model', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Forecast cross sections not verified/implemented.', evidence: ['No verified forecast cross-section pipeline'] },
  { id: 'model_profiles', name: 'Model-derived atmospheric profiles', category: 'model', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Model-derived profiles not verified/implemented.', evidence: ['No verified profile pipeline'] },
  { id: 'model_custom_overlays', name: 'Custom model overlays', category: 'model', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Custom model overlays not verified/implemented.', evidence: ['No verified custom model overlay workflow'] },
  { id: 'model_smoothing_contours', name: 'Model smoothing and contours', category: 'model', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Model smoothing/contours not verified/implemented.', evidence: ['No verified smoothing/contours pipeline'] },

  // Atmospheric analysis
  { id: 'surface_analysis', name: 'Surface analysis', category: 'analysis', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Not verified/implemented.', evidence: ['No verified source/pipeline'] },
  { id: 'upper_air_analysis', name: 'Upper-air analysis', category: 'analysis', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Not verified/implemented.', evidence: ['No verified source/pipeline'] },
  { id: 'mb_analysis', name: '850, 700, 500, and 300 mb analysis', category: 'analysis', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Not verified/implemented.', evidence: ['No verified source/pipeline'] },
  { id: 'temp_advection', name: 'Temperature advection', category: 'analysis', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Not verified/implemented.', evidence: ['No verified source/pipeline'] },
  { id: 'moisture_advection', name: 'Moisture advection', category: 'analysis', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Not verified/implemented.', evidence: ['No verified source/pipeline'] },
  { id: 'vort_advection', name: 'Vorticity advection', category: 'analysis', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Not verified/implemented.', evidence: ['No verified source/pipeline'] },
  { id: 'jet_stream', name: 'Jet-stream analysis', category: 'analysis', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Not verified/implemented.', evidence: ['No verified source/pipeline'] },
  { id: 'div_conv', name: 'Divergence and convergence', category: 'analysis', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Not verified/implemented.', evidence: ['No verified source/pipeline'] },
  { id: 'vertical_motion', name: 'Vertical motion', category: 'analysis', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Not verified/implemented.', evidence: ['No verified source/pipeline'] },
  { id: 'frontogenesis', name: 'Frontogenesis', category: 'analysis', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Not verified/implemented.', evidence: ['No verified source/pipeline'] },
  { id: 'fronts_boundaries', name: 'Fronts and boundaries', category: 'analysis', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Not verified/implemented.', evidence: ['No verified source/pipeline'] },
  { id: 'drylines', name: 'Drylines', category: 'analysis', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Not verified/implemented.', evidence: ['No verified source/pipeline'] },
  { id: 'mesoscale_boundaries', name: 'Mesoscale boundaries', category: 'analysis', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Not verified/implemented.', evidence: ['No verified source/pipeline'] },
  { id: 'instability_analysis', name: 'Atmospheric instability analysis', category: 'analysis', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Not verified/implemented.', evidence: ['No verified source/pipeline'] },
  { id: 'convective_initiation', name: 'Convective initiation analysis', category: 'analysis', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Not verified/implemented.', evidence: ['No verified source/pipeline'] },
  { id: 'sr_env_analysis', name: 'Storm-relative environmental analysis', category: 'analysis', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Not verified/implemented.', evidence: ['No verified source/pipeline'] },
  { id: 'sounding_analysis', name: 'Sounding analysis', category: 'analysis', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Not verified/implemented.', evidence: ['No verified end-to-end sounding analysis pipeline'] },
  { id: 'hodograph_analysis', name: 'Hodograph analysis', category: 'analysis', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Not verified/implemented.', evidence: ['No verified source/pipeline'] },
  { id: 'severe_params', name: 'Severe-weather parameter overlays', category: 'analysis', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Not verified/implemented.', evidence: ['No verified source/pipeline'] },
  { id: 'composite_indices', name: 'Composite severe-weather indices', category: 'analysis', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Not verified/implemented.', evidence: ['No verified source/pipeline'] },
  { id: 'mesoscale_analysis', name: 'Mesoscale analysis', category: 'analysis', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Not verified/implemented.', evidence: ['No verified source/pipeline'] },
  { id: 'thermo_analysis', name: 'Thermodynamic analysis', category: 'analysis', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Not verified/implemented.', evidence: ['No verified source/pipeline'] },
  { id: 'atmo_cross_sections', name: 'Atmospheric cross sections', category: 'analysis', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Not verified/implemented.', evidence: ['No verified source/pipeline'] },

  // Multi-parameter overlays / data fusion
  { id: 'overlay_adjust_opacity', name: 'Adjustable layer opacity', category: 'overlay', status: 'PARTIAL', reason: 'Radar opacity control exists; full independent multi-layer opacity system not verified across all requested datasets.', evidence: ['radarOpacity control exists'] },
  { id: 'overlay_independent_controls', name: 'Independent layer controls', category: 'overlay', status: 'PARTIAL', reason: 'Some layer toggles exist; full independent control for all requested datasets not verified.', evidence: ['Multiple overlay toggles exist in UI'] },
  { id: 'overlay_custom_order', name: 'Custom layer ordering', category: 'overlay', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Custom layer ordering not verified/implemented.', evidence: ['No verified layer ordering UI'] },
  { id: 'overlay_multiple_palettes', name: 'Multiple color palettes', category: 'overlay', status: 'PARTIAL', reason: 'Limited palette selection exists; full multi-palette system for all datasets not verified.', evidence: ['Color table selector exists'] },
  { id: 'overlay_blend_modes', name: 'Blend modes', category: 'overlay', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Blend modes not verified/implemented.', evidence: ['No verified blend mode control'] },
  { id: 'overlay_grouping', name: 'Layer grouping', category: 'overlay', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Layer grouping not verified/implemented.', evidence: ['No verified layer grouping UI'] },
  { id: 'overlay_saved_presets', name: 'Saved overlay presets', category: 'overlay', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Saved overlay presets not verified/implemented.', evidence: ['No verified preset persistence'] },
  { id: 'overlay_custom_combinations', name: 'Custom combinations', category: 'overlay', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Custom combination builder not verified/implemented.', evidence: ['No verified custom combination workflow'] },
  { id: 'overlay_split_screen', name: 'Split-screen comparison', category: 'overlay', status: 'PARTIAL', reason: 'Quad compare entry exists; full split-screen comparison for all requested datasets not verified.', evidence: ['Quad Compare button exists'] },
  { id: 'overlay_multi_panel', name: 'Multi-panel analysis', category: 'overlay', status: 'PARTIAL', reason: 'Quad view exists; full multi-panel analysis workflow not verified.', evidence: ['Quad View entry exists'] },
  // Requested overlay examples
  { id: 'ex_sat_cape', name: 'Example: Satellite + CAPE', category: 'overlay', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Required model/CAPE layer not verified end-to-end.', evidence: ['CAPE model field NEEDS_SOURCE in model registry'] },
  { id: 'ex_sat_radar', name: 'Example: Satellite + Radar Reflectivity', category: 'overlay', status: 'PARTIAL', reason: 'Satellite and radar layers exist separately; verified synchronized composite workflow not fully verified.', evidence: ['Satellite and radar modes exist separately'] },
  { id: 'ex_radar_srh', name: 'Example: Radar + Storm-Relative Helicity', category: 'overlay', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - SRH model field not verified end-to-end.', evidence: ['SRH field NEEDS_SOURCE'] },
  { id: 'ex_radar_lightning', name: 'Example: Radar + Lightning Density', category: 'overlay', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Verified lightning density overlay not integrated.', evidence: ['Lightning toggle exists but density product not verified as requested'] },
  { id: 'ex_sat_wv_temp', name: 'Example: Satellite + Water Vapor + Temperature', category: 'overlay', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Combined verified overlay not implemented.', evidence: ['Component layers partially available/unverified'] },
  { id: 'ex_ref_vel', name: 'Example: Reflectivity + Velocity', category: 'overlay', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Verified dual-product same-view overlay not implemented.', evidence: ['Products exist separately; combined overlay not verified'] },
  { id: 'ex_radar_sfc_obs', name: 'Example: Radar + Surface Observations', category: 'overlay', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Verified combined overlay not implemented.', evidence: ['No verified combined overlay workflow'] },
  { id: 'ex_sat_model', name: 'Example: Satellite + Model Forecasts', category: 'overlay', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Model forecast map layers mostly NEEDS_SOURCE/RESTRICTED.', evidence: ['Model catalog statuses'] },
  { id: 'ex_cape_shear', name: 'Example: CAPE + Wind Shear', category: 'overlay', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Required model fields not verified end-to-end.', evidence: ['Model fields NEEDS_SOURCE'] },
  { id: 'ex_t_td_wind', name: 'Example: Temperature + Dewpoint + Wind Fields', category: 'overlay', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Required model fields not verified end-to-end.', evidence: ['Most model fields NEEDS_SOURCE'] },
  { id: 'ex_radar_mrms_qpe', name: 'Example: Radar + MRMS Precipitation Estimates', category: 'overlay', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - MRMS QPE not verified end-to-end.', evidence: ['QPE capability UNAVAILABLE'] },
] as const;

export function getFeatureCapability(id: string): FeatureCapability | undefined {
  return FEATURE_CAPABILITIES.find((c) => c.id === id);
}

export function getFeatureCapabilitiesByCategory(category: FeatureCapability['category']): FeatureCapability[] {
  return FEATURE_CAPABILITIES.filter((c) => c.category === category);
}
