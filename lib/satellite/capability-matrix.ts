/**
 * Satellite Capability Matrix - source of truth for satellite products/features.
 * No fake data, no silent substitution. Unknown/unverified = UNAVAILABLE.
 */

export type SatelliteCapabilityStatus = 'WORKING' | 'PARTIAL' | 'UNAVAILABLE' | 'RESTRICTED';
export type SatelliteVerificationLevel = 'VERIFIED' | 'PARTIALLY_VERIFIED' | 'UNVERIFIED' | 'TESTED_LIVE';

export interface SatelliteCapability {
  id: string;
  name: string;
  category: 'platform' | 'product' | 'sector' | 'feature';
  availability: SatelliteCapabilityStatus;
  verification: { level: SatelliteVerificationLevel; lastCheckedAt: string; evidence: string[] };
  unavailableReason?: string;
  notes: string;
}

const CHECKED_AT = '2026-11-22';

export const SATELLITE_CAPABILITY_MATRIX: readonly SatelliteCapability[] = [
  // Platforms / coverage
  { id: 'goes_east', name: 'GOES-East', category: 'platform', availability: 'PARTIAL', verification: { level: 'PARTIALLY_VERIFIED', lastCheckedAt: CHECKED_AT, evidence: ['lib/satellite.ts constructs IEM GOES-East TMS URLs', 'RadarMap probes selected tile at runtime'] }, notes: 'Real IEM TMS tiles for supported channels/sectors; not all products/sectors verified end-to-end.' },
  { id: 'goes_west', name: 'GOES-West', category: 'platform', availability: 'PARTIAL', verification: { level: 'PARTIALLY_VERIFIED', lastCheckedAt: CHECKED_AT, evidence: ['lib/satellite.ts constructs IEM GOES-West TMS URLs', 'RadarMap probes selected tile at runtime'] }, notes: 'Real IEM TMS tiles for supported channels/sectors; not all products/sectors verified end-to-end.' },
  { id: 'himawari', name: 'Himawari Coverage', category: 'platform', availability: 'PARTIAL', verification: { level: 'PARTIALLY_VERIFIED', lastCheckedAt: CHECKED_AT, evidence: ['lib/satellite.ts has verified legacy IEM Himawari ch02 fulldisk path'] }, unavailableReason: 'Only limited Himawari channel/sector verified (visible/ch02 full disk on IEM legacy path).', notes: 'Limited coverage only; other Himawari products/sectors UNAVAILABLE until verified.' },
  { id: 'meteosat', name: 'Meteosat Coverage', category: 'platform', availability: 'UNAVAILABLE', verification: { level: 'UNVERIFIED', lastCheckedAt: CHECKED_AT, evidence: ['No Meteosat source wired/verified in current app'] }, unavailableReason: 'DATA UNAVAILABLE - Meteosat coverage not verified/integrated.', notes: 'No verified tile/API source in app.' },
  { id: 'viirs', name: 'VIIRS Polar-Orbiting Satellite Imagery', category: 'platform', availability: 'UNAVAILABLE', verification: { level: 'UNVERIFIED', lastCheckedAt: CHECKED_AT, evidence: ['No VIIRS source wired/verified in current app'] }, unavailableReason: 'DATA UNAVAILABLE - VIIRS imagery not verified/integrated.', notes: 'No verified tile/API source in app.' },

  // ABI channels / core imagery
  { id: 'abi_channels', name: 'GOES ABI Channels', category: 'product', availability: 'PARTIAL', verification: { level: 'PARTIALLY_VERIFIED', lastCheckedAt: CHECKED_AT, evidence: ['lib/satellite.ts exposes Ch01-Ch16 with IEM TMS channel URLs', 'RadarMap probes fixed in-sector tiles from VERIFIED_SATELLITE_PROBE_TILES', 'IEM WMS capabilities checked 2026-11-24'] }, notes: 'Individual ABI channels available through IEM TMS for supported GOES sectors; moving mesoscale sectors have no fixed probe; archive/playback not verified.' },
  { id: 'visible', name: 'Visible Satellite Imagery', category: 'product', availability: 'PARTIAL', verification: { level: 'PARTIALLY_VERIFIED', lastCheckedAt: CHECKED_AT, evidence: ['IEM goes_{east|west}_{sector}_ch02 tile URL', 'RadarMap runtime probe'] }, notes: 'GOES Ch02 visible via IEM; daytime only by nature of visible band.' },
  { id: 'infrared', name: 'Infrared Satellite Imagery', category: 'product', availability: 'PARTIAL', verification: { level: 'PARTIALLY_VERIFIED', lastCheckedAt: CHECKED_AT, evidence: ['IEM goes_{east|west}_{sector}_ch13 tile URL', 'RadarMap runtime probe'] }, notes: 'GOES Ch13 clean longwave IR via IEM.' },
  { id: 'water_vapor', name: 'Water Vapor Imagery', category: 'product', availability: 'PARTIAL', verification: { level: 'PARTIALLY_VERIFIED', lastCheckedAt: CHECKED_AT, evidence: ['IEM Ch08/09/10 tile URLs', 'RadarMap runtime probe'] }, notes: 'Upper/mid/lower water vapor channels available via IEM.' },
  { id: 'wv_upper', name: 'Upper-Level Water Vapor', category: 'product', availability: 'PARTIAL', verification: { level: 'PARTIALLY_VERIFIED', lastCheckedAt: CHECKED_AT, evidence: ['IEM Ch08 tile URL'] }, notes: 'GOES ABI Ch08 via IEM.' },
  { id: 'wv_mid', name: 'Mid-Level Water Vapor', category: 'product', availability: 'PARTIAL', verification: { level: 'PARTIALLY_VERIFIED', lastCheckedAt: CHECKED_AT, evidence: ['IEM Ch09 tile URL'] }, notes: 'GOES ABI Ch09 via IEM.' },
  { id: 'wv_lower', name: 'Lower-Level Water Vapor', category: 'product', availability: 'PARTIAL', verification: { level: 'PARTIALLY_VERIFIED', lastCheckedAt: CHECKED_AT, evidence: ['IEM Ch10 tile URL'] }, notes: 'GOES ABI Ch10 via IEM.' },
  { id: 'enhanced_ir', name: 'Enhanced Infrared Imagery', category: 'product', availability: 'UNAVAILABLE', verification: { level: 'UNVERIFIED', lastCheckedAt: CHECKED_AT, evidence: ['No verified enhanced IR XYZ tile product wired'] }, unavailableReason: 'DATA UNAVAILABLE - Enhanced IR product not verified/integrated.', notes: 'Raw IR channels available; enhanced IR color table product not verified.' },
  { id: 'geocolor', name: 'GeoColor', category: 'product', availability: 'UNAVAILABLE', verification: { level: 'UNVERIFIED', lastCheckedAt: CHECKED_AT, evidence: ['lib/satellite.ts marks GeoColor unavailable; NOAA STAR static imagery not verified as XYZ tile pipeline'] }, unavailableReason: 'DATA UNAVAILABLE - No verified real public XYZ tile endpoint for GeoColor.', notes: 'Do not fake with static imagery.' },
  { id: 'airmass_rgb', name: 'Air Mass RGB', category: 'product', availability: 'UNAVAILABLE', verification: { level: 'UNVERIFIED', lastCheckedAt: CHECKED_AT, evidence: ['lib/satellite.ts marks unavailable; no verified XYZ tile endpoint'] }, unavailableReason: 'DATA UNAVAILABLE - No verified real public XYZ tile endpoint for Air Mass RGB.', notes: '' },
  { id: 'dust_rgb', name: 'Dust RGB', category: 'product', availability: 'UNAVAILABLE', verification: { level: 'UNVERIFIED', lastCheckedAt: CHECKED_AT, evidence: ['lib/satellite.ts marks unavailable; no verified XYZ tile endpoint'] }, unavailableReason: 'DATA UNAVAILABLE - No verified real public XYZ tile endpoint for Dust RGB.', notes: '' },
  { id: 'fire_smoke', name: 'Fire and Smoke Imagery', category: 'product', availability: 'UNAVAILABLE', verification: { level: 'UNVERIFIED', lastCheckedAt: CHECKED_AT, evidence: ['Fire Temperature RGB unavailable in satellite.ts; no verified smoke product XYZ tile'] }, unavailableReason: 'DATA UNAVAILABLE - Fire/smoke satellite products not verified/integrated as real XYZ tiles.', notes: '' },
  { id: 'cloud_phase', name: 'Cloud-Phase Products', category: 'product', availability: 'UNAVAILABLE', verification: { level: 'UNVERIFIED', lastCheckedAt: CHECKED_AT, evidence: ['Day Cloud Phase RGB unavailable in satellite.ts'] }, unavailableReason: 'DATA UNAVAILABLE - Cloud-phase product not verified as real XYZ tile.', notes: '' },
  { id: 'day_night', name: 'Day/Night Satellite Imagery', category: 'product', availability: 'UNAVAILABLE', verification: { level: 'UNVERIFIED', lastCheckedAt: CHECKED_AT, evidence: ['GeoColor/day-night composite not verified as XYZ tile'] }, unavailableReason: 'DATA UNAVAILABLE - Day/night composite imagery not verified/integrated.', notes: '' },
  { id: 'glm_lightning', name: 'Satellite Lightning Imagery (GLM)', category: 'product', availability: 'UNAVAILABLE', verification: { level: 'UNVERIFIED', lastCheckedAt: CHECKED_AT, evidence: ['No GLM tile/API source wired/verified in app'] }, unavailableReason: 'DATA UNAVAILABLE - GLM satellite lightning not verified/integrated.', notes: '' },

  // Sectors
  { id: 'sector_conus', name: 'CONUS Imagery', category: 'sector', availability: 'PARTIAL', verification: { level: 'PARTIALLY_VERIFIED', lastCheckedAt: CHECKED_AT, evidence: ['lib/satellite.ts supports CONUS sector for GOES East/West IEM TMS'] }, notes: 'CONUS sector for supported GOES channels via IEM.' },
  { id: 'sector_fulldisk', name: 'Full-Disk Imagery', category: 'sector', availability: 'PARTIAL', verification: { level: 'PARTIALLY_VERIFIED', lastCheckedAt: CHECKED_AT, evidence: ['lib/satellite.ts supports fulldisk sector; IEM GOES fulldisk channel paths used'] }, notes: 'Full-disk support exists for supported GOES/Himawari limited paths; not all verified end-to-end.' },
  { id: 'sector_mesoscale', name: 'Mesoscale Sector Imagery', category: 'sector', availability: 'PARTIAL', verification: { level: 'PARTIALLY_VERIFIED', lastCheckedAt: '2026-11-24', evidence: ['IEM WMS capabilities list goes_east/goes_west mesoscale-1 and mesoscale-2 ABI layers', 'lib/satellite.ts emits those IEM tile.py layer names for supported channels', 'Moving sector footprints have no fixed probe tile or fixed map bounds'] }, notes: 'Live IEM mesoscale tile layers are wired; the tracked sector moves, so no fixed bounds or content probe is claimed. Archive/playback not verified.' },
  { id: 'rapid_scan', name: 'One-Minute Rapid-Scan Imagery', category: 'feature', availability: 'UNAVAILABLE', verification: { level: 'UNVERIFIED', lastCheckedAt: CHECKED_AT, evidence: ['No rapid-scan cadence/archive pipeline verified'] }, unavailableReason: 'DATA UNAVAILABLE - One-minute rapid-scan imagery not verified/integrated.', notes: '' },

  // Features
  { id: 'sat_history', name: 'Satellite History and Playback', category: 'feature', availability: 'UNAVAILABLE', verification: { level: 'UNVERIFIED', lastCheckedAt: CHECKED_AT, evidence: ['RadarMap sets satellite archiveAvailable=false; no satellite archive/playback pipeline'] }, unavailableReason: 'DATA UNAVAILABLE - Satellite history/playback not verified/integrated.', notes: '' },
  { id: 'sat_smoothing', name: 'Satellite Smoothing and Enhancement', category: 'feature', availability: 'UNAVAILABLE', verification: { level: 'UNVERIFIED', lastCheckedAt: CHECKED_AT, evidence: ['No verified satellite smoothing/enhancement controls'] }, unavailableReason: 'DATA UNAVAILABLE - Satellite smoothing/enhancement not verified/integrated.', notes: '' },
  { id: 'sat_custom_color', name: 'Custom Satellite Color Enhancements', category: 'feature', availability: 'UNAVAILABLE', verification: { level: 'UNVERIFIED', lastCheckedAt: CHECKED_AT, evidence: ['No verified custom color enhancement pipeline'] }, unavailableReason: 'DATA UNAVAILABLE - Custom satellite color enhancements not verified/integrated.', notes: '' },
  { id: 'sat_cross_section', name: 'Satellite Cross Sections', category: 'feature', availability: 'UNAVAILABLE', verification: { level: 'UNVERIFIED', lastCheckedAt: CHECKED_AT, evidence: ['No verified satellite cross-section implementation'] }, unavailableReason: 'DATA UNAVAILABLE - Satellite cross sections not implemented/verified.', notes: '' },
  { id: 'sat_3d', name: 'Three-Dimensional Satellite Visualization', category: 'feature', availability: 'UNAVAILABLE', verification: { level: 'UNVERIFIED', lastCheckedAt: CHECKED_AT, evidence: ['No verified 3D satellite visualization implementation'] }, unavailableReason: 'DATA UNAVAILABLE - 3D satellite visualization not implemented/verified.', notes: '' },
  { id: 'sat_radar_compare', name: 'Satellite and Radar Comparison', category: 'feature', availability: 'UNAVAILABLE', verification: { level: 'UNVERIFIED', lastCheckedAt: CHECKED_AT, evidence: ['No verified satellite/radar comparison feature'] }, unavailableReason: 'DATA UNAVAILABLE - Satellite/radar comparison not verified/integrated.', notes: '' },
  { id: 'sat_atmo_overlays', name: 'Satellite and Atmospheric-Analysis Overlays', category: 'feature', availability: 'UNAVAILABLE', verification: { level: 'UNVERIFIED', lastCheckedAt: CHECKED_AT, evidence: ['No verified satellite/atmospheric-analysis overlay pipeline'] }, unavailableReason: 'DATA UNAVAILABLE - Satellite/atmospheric-analysis overlays not verified/integrated.', notes: '' },
] as const;

export function getSatelliteCapability(id: string): SatelliteCapability | undefined {
  return SATELLITE_CAPABILITY_MATRIX.find((c) => c.id === id);
}
