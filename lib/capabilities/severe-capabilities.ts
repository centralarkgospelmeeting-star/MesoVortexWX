export type CapabilityStatus = 'WORKING' | 'PARTIAL' | 'UNAVAILABLE';

export interface SevereCapability {
  id: string;
  name: string;
  category: 'warning' | 'outlook' | 'report' | 'analysis';
  status: CapabilityStatus;
  reason: string;
  evidence: string[];
}

export const SEVERE_CAPABILITIES: readonly SevereCapability[] = [
  // Warnings/products
  { id: 'nws_watches_warnings', name: 'National Weather Service watches and warnings', category: 'warning', status: 'PARTIAL', reason: 'Warning/watch API routes and map layers exist; full end-to-end verification and completeness not fully audited.', evidence: ['app/api/warnings/route.ts', 'app/api/watches/route.ts', 'RadarMap warning/watch layers'] },
  { id: 'tor_warning', name: 'Tornado Warnings', category: 'warning', status: 'PARTIAL', reason: 'Supported through NWS warning feed if present; dedicated end-to-end verification incomplete.', evidence: ['NWS warnings route/layer'] },
  { id: 'svr_warning', name: 'Severe Thunderstorm Warnings', category: 'warning', status: 'PARTIAL', reason: 'Supported through NWS warning feed if present; dedicated end-to-end verification incomplete.', evidence: ['NWS warnings route/layer'] },
  { id: 'ffw', name: 'Flash Flood Warnings', category: 'warning', status: 'PARTIAL', reason: 'Supported through NWS warning feed if present; dedicated end-to-end verification incomplete.', evidence: ['NWS warnings route/layer'] },
  { id: 'flood_watch', name: 'Flood Watches', category: 'warning', status: 'PARTIAL', reason: 'Supported through NWS watch/warning feeds if present; dedicated verification incomplete.', evidence: ['NWS watches/warnings routes'] },
  { id: 'winter_alerts', name: 'Winter Weather Advisories and Warnings', category: 'warning', status: 'PARTIAL', reason: 'Supported through NWS feeds if present; dedicated verification incomplete.', evidence: ['NWS warnings route/layer'] },
  { id: 'tropical_alerts', name: 'Tropical Storm and Hurricane Warnings', category: 'warning', status: 'PARTIAL', reason: 'Supported through NWS/NHC-related feeds if present; dedicated verification incomplete.', evidence: ['NWS warnings/tropical routes exist in app'] },
  { id: 'sps', name: 'Special Weather Statements', category: 'warning', status: 'PARTIAL', reason: 'May be supported through NWS feed; dedicated verification incomplete.', evidence: ['NWS warnings route'] },
  { id: 'svs', name: 'Severe Weather Statements', category: 'warning', status: 'PARTIAL', reason: 'May be supported through NWS feed; dedicated verification incomplete.', evidence: ['NWS warnings route'] },
  { id: 'mcd', name: 'Mesoscale Discussions', category: 'outlook', status: 'PARTIAL', reason: 'SPC MCD route/UI exists; end-to-end verification incomplete.', evidence: ['app/api/spc/mcd/route.ts', 'MCD UI'] },
  { id: 'spc_convective', name: 'SPC Convective Outlooks', category: 'outlook', status: 'PARTIAL', reason: 'SPC outlook route/UI exists; end-to-end verification incomplete.', evidence: ['app/api/spc/outlooks/route.ts', 'Outlooks UI'] },
  { id: 'spc_fire', name: 'SPC Fire Weather Outlooks', category: 'outlook', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Fire Weather Outlook integration not verified.', evidence: ['No verified SPC fire weather outlook pipeline'] },
  { id: 'wpc_ero', name: 'WPC Excessive Rainfall Outlooks', category: 'outlook', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - WPC ERO integration not verified.', evidence: ['No verified WPC ERO pipeline'] },
  { id: 'cpc_outlooks', name: 'CPC Seasonal and Temperature/Precipitation Outlooks', category: 'outlook', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - CPC outlook integration not verified.', evidence: ['No verified CPC outlook pipeline'] },
  { id: 'nhc_outlooks', name: 'NHC tropical outlooks', category: 'outlook', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - NHC tropical outlook integration not verified.', evidence: ['Tropical cyclone route exists; NHC outlook products not verified'] },
  { id: 'storm_based_polygons', name: 'Storm-based warning polygons', category: 'warning', status: 'PARTIAL', reason: 'Warning polygon rendering exists in map; full verification incomplete.', evidence: ['RadarMap warning polygon layers'] },
  { id: 'county_warning_boundaries', name: 'County warning boundaries', category: 'warning', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - County warning boundary display not verified as separate product.', evidence: ['No verified county warning boundary mode'] },
  { id: 'warning_history', name: 'Warning history', category: 'warning', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Warning history not verified/implemented.', evidence: ['No verified warning history pipeline'] },

  // Reports
  { id: 'lsr', name: 'Local storm reports', category: 'report', status: 'PARTIAL', reason: 'LSR route/UI exists; end-to-end verification incomplete.', evidence: ['app/api/lsr/route.ts', 'showLSR toggle'] },
  { id: 'tornado_reports', name: 'Tornado reports', category: 'report', status: 'PARTIAL', reason: 'May be included in LSR/spotter feeds; dedicated filtering/verification incomplete.', evidence: ['LSR/spotter feeds'] },
  { id: 'hail_reports', name: 'Hail reports', category: 'report', status: 'PARTIAL', reason: 'May be included in LSR/spotter/mPING feeds; dedicated verification incomplete.', evidence: ['LSR/spotter/mPING routes'] },
  { id: 'wind_damage_reports', name: 'Wind damage reports', category: 'report', status: 'PARTIAL', reason: 'May be included in LSR/spotter feeds; dedicated verification incomplete.', evidence: ['LSR/spotter feeds'] },

  // Storm intelligence / analysis
  { id: 'storm_tracks', name: 'Storm tracks and rotation tracks', category: 'analysis', status: 'PARTIAL', reason: 'Storm track toggle/layer exists; rotation track product verification incomplete.', evidence: ['showStormTracks in RadarMap/UI', 'rotation_tracks capability UNAVAILABLE as radar product'] },
  { id: 'hail_probability_size', name: 'Hail probability and estimated hail size', category: 'analysis', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Hail probability/size product not verified end-to-end.', evidence: ['No verified hail probability pipeline; MESH UNAVAILABLE'] },
  { id: 'lightning_detection_density', name: 'Lightning detection and density', category: 'analysis', status: 'PARTIAL', reason: 'Lightning routes/UI exist; density/end-to-end verification incomplete.', evidence: ['app/api/lightning routes', 'showLightning toggle'] },
  { id: 'storm_eta', name: 'Storm arrival-time estimates', category: 'analysis', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Storm arrival-time estimates not verified/implemented.', evidence: ['No verified ETA pipeline'] },
  { id: 'storm_motion_paths', name: 'Storm motion and projected paths', category: 'analysis', status: 'PARTIAL', reason: 'Storm tracks exist; projected path accuracy/verification incomplete.', evidence: ['Storm track UI exists'] },
  { id: 'warning_impact', name: 'Warning impact assessments', category: 'analysis', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Warning impact assessment not verified/implemented.', evidence: ['No verified impact assessment pipeline'] },
  { id: 'population_exposure', name: 'Population exposure estimates', category: 'analysis', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Population exposure estimates not verified/implemented.', evidence: ['No verified population exposure pipeline'] },
  { id: 'custom_warning_notifications', name: 'Custom warning notifications', category: 'warning', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Custom warning notifications not verified/implemented.', evidence: ['No verified notification system'] },
  { id: 'spoken_warnings', name: 'Spoken warning announcements', category: 'warning', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Spoken warning announcements not verified/implemented.', evidence: ['No verified TTS warning system'] },
  { id: 'custom_warning_tones', name: 'Custom warning tones and colors', category: 'warning', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Custom warning tones/colors not verified/implemented.', evidence: ['No verified customization system'] },
  { id: 'alert_filtering', name: 'Alert filtering by warning type and location', category: 'warning', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Full alert filtering not verified/implemented.', evidence: ['No verified filter workflow'] },

  // Advanced storm analysis
  { id: 'auto_storm_id', name: 'Automated storm identification', category: 'analysis', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Not verified/implemented.', evidence: ['No verified storm ID pipeline'] },
  { id: 'meso_id', name: 'Mesocyclone identification', category: 'analysis', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Not verified/implemented.', evidence: ['No verified mesocyclone ID pipeline'] },
  { id: 'rotation_analysis', name: 'Rotation analysis', category: 'analysis', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Not verified/implemented.', evidence: ['No verified rotation analysis pipeline'] },
  { id: 'tds_id', name: 'Tornado debris signature identification', category: 'analysis', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Not verified/implemented.', evidence: ['No verified TDS detection pipeline'] },
  { id: 'hail_detection_analysis', name: 'Hail detection', category: 'analysis', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Not verified/implemented.', evidence: ['MESH/hail detection capabilities UNAVAILABLE'] },
  { id: 'storm_cell_tracking', name: 'Storm-cell tracking', category: 'analysis', status: 'PARTIAL', reason: 'Storm tracks exist; robust storm-cell tracking verification incomplete.', evidence: ['Storm track layer/toggle exists'] },
  { id: 'storm_intensity_trends', name: 'Storm intensity trends', category: 'analysis', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Not verified/implemented.', evidence: ['No verified intensity trend pipeline'] },
  { id: 'sr_analysis', name: 'Storm-relative analysis', category: 'analysis', status: 'PARTIAL', reason: 'SRV product exists as PARTIAL; full storm-relative analysis workflow not verified.', evidence: ['SRV capability PARTIAL'] },
  { id: 'storm_interrogation', name: 'Storm interrogation', category: 'analysis', status: 'PARTIAL', reason: 'Basic inspection exists; full storm interrogation not verified.', evidence: ['Inspection mode exists'] },
  { id: 'historical_storm_events', name: 'Historical storm-event analysis', category: 'analysis', status: 'UNAVAILABLE', reason: 'DATA UNAVAILABLE - Not verified/implemented.', evidence: ['No verified historical event analysis pipeline'] },
] as const;

export function getSevereCapability(id: string): SevereCapability | undefined {
  return SEVERE_CAPABILITIES.find((c) => c.id === id);
}
