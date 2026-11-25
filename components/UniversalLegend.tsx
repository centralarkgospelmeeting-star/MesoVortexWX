'use client';

import { useState } from 'react';
import { canonicalRadarProductId } from '../lib/radar/capability-matrix';

export type LegendType =
  | 'ref'
  | 'max_ref'
  | 'ref_x'
  | 'comp_ref'
  | 'vel'
  | 'srvel'
  | 'norm_vel'
  | 'azshear'
  | 'cc'
  | 'min_cc'
  | 'zdr'
  | 'kdp'
  | 'sw'
  | 'tops'
  | 'vil'
  | 'vil_density'
  | 'mesh'
  | 'rotation_tracks'
  | 'qpe'
  | 'precip_rate'
  | 'hail_detection'
  | 'gate_to_gate_shear'
  | 'rain_mix_snow'
  | 'satellite'
  | 'spc'
  | 'cape'
  | 'temp'
  | 'nrot'
  | 'hhc';

type Props = {
  type: LegendType | string;
  activeAnnouncement?: {
    event: string;
    headline: string;
    area: string;
  } | null;
  onDismissAnnouncement?: () => void;
  onSpeakAnnouncement?: () => void;
};

type LegendStep = {
  color: string;
  label: string;
  value: string;
};

type LegendMeta = {
  title: string;
  description: string;
  legendLabel: string;
};

export type ProductLegendStep = {
  color: string;
  label: string;
  value: string;
  meaning: string;
};

export type ProductLegendInfo = {
  key: string;
  title: string;
  description: string;
  legendLabel: string;
  steps: readonly ProductLegendStep[];
  hasVerifiedScale: boolean;
};

export const NO_VERIFIED_SCALE_LABEL = 'No verified scale available';

const LEGENDS: Record<string, LegendStep[]> = {
  ref: [
    { color: '#04e9e7', label: '5 dBZ', value: '5 dBZ · Very Light / Drizzle' },
    { color: '#019ff4', label: '15 dBZ', value: '15 dBZ · Light Rain' },
    { color: '#0300f4', label: '25 dBZ', value: '25 dBZ · Moderate Rain' },
    { color: '#02fd02', label: '35 dBZ', value: '35 dBZ · Heavy Rain' },
    { color: '#01c501', label: '40 dBZ', value: '40 dBZ · Convective Thunderstorm' },
    { color: '#fdf802', label: '45 dBZ', value: '45 dBZ · Hail Growth Zone' },
    { color: '#fd9500', label: '50 dBZ', value: '50 dBZ · Severe Core / Small Hail' },
    { color: '#fd0000', label: '55 dBZ', value: '55 dBZ · Severe Hail (≥1 inch)' },
    { color: '#d40000', label: '60 dBZ', value: '60 dBZ · Destructive Hail (≥2 inch)' },
    { color: '#f800fd', label: '65 dBZ', value: '65 dBZ · Giant Hail Core / BWER' },
    { color: '#9854c6', label: '70 dBZ', value: '70 dBZ · Violent Supercell Core' },
    { color: '#ffffff', label: '75+ dBZ', value: '75+ dBZ · Extreme Hail / Debris' },
  ],
  vel: [
    { color: '#00ffff', label: '-64 kt', value: '-64 kt · Extreme Inbound Gate' },
    { color: '#00a86b', label: '-45 kt', value: '-45 kt · Strong Inbound' },
    { color: '#10b981', label: '-25 kt', value: '-25 kt · Moderate Inbound' },
    { color: '#64748b', label: '0 kt', value: '0 kt · Zero-Velocity Line / Radial Axis' },
    { color: '#f59e0b', label: '+25 kt', value: '+25 kt · Moderate Outbound' },
    { color: '#ea580c', label: '+45 kt', value: '+45 kt · Strong Outbound' },
    { color: '#ef4444', label: '+64 kt', value: '+64 kt · Extreme Outbound Gate' },
    { color: '#f43f5e', label: '+80+ kt', value: '+80+ kt · Severe Velocity Couplet / TVS' },
  ],
  cc: [
    { color: '#dc0000', label: '0.50–0.80', value: 'Low CC · Mixed or non-meteorological returns' },
    { color: '#ff8000', label: '0.80–0.85', value: 'Reduced CC · Mixed hydrometeors' },
    { color: '#ffdc00', label: '0.85–0.90', value: 'Moderate CC · Mixed precipitation' },
    { color: '#00be00', label: '0.90–0.95', value: 'High CC · More uniform precipitation' },
    { color: '#0064ff', label: '0.95–0.97', value: 'Very high CC · Uniform precipitation' },
    { color: '#00ffff', label: '0.97–0.99', value: 'Near-unity CC · Uniform precipitation' },
    { color: '#ffffff', label: '0.99+', value: 'Near-perfect CC · Highly uniform echoes' },
  ],
  // Relocated from the former ProductInfoBanner MIN_CC table; no values or units changed.
  min_cc: [
    { color: '#9600b4', label: '< 0.50', value: '0.20-0.50 · Very low sampled CC' },
    { color: '#285ad2', label: '0.50-0.65', value: '0.50-0.65 · Low sampled CC' },
    { color: '#00bedc', label: '0.65-0.80', value: '0.65-0.80 · Reduced sampled CC' },
    { color: '#00be00', label: '0.80-0.90', value: '0.80-0.90 · Moderate sampled CC' },
    { color: '#dcdc00', label: '0.90-0.95', value: '0.90-0.95 · High sampled CC' },
    { color: '#ff8000', label: '0.95-0.97', value: '0.95-0.97 · Very high sampled CC' },
    { color: '#ffffff', label: '0.97+', value: '0.97-1.05 · Near-unity minimum CC' },
  ],
  zdr: [
    { color: '#8246c8', label: '< -1 dB', value: 'Negative ZDR · Vertically oriented or mixed targets' },
    { color: '#2878ff', label: '-1–0 dB', value: 'Low ZDR · Small or mixed hydrometeors' },
    { color: '#00bedc', label: '0–0.5 dB', value: 'Near-zero ZDR · Spherical or mixed targets' },
    { color: '#00c800', label: '0.5–1 dB', value: 'Low positive ZDR · Small raindrops' },
    { color: '#b4e600', label: '1–2 dB', value: 'Moderate ZDR · Typical rain drops' },
    { color: '#ffc800', label: '2–3 dB', value: 'Elevated ZDR · Larger oblate drops' },
    { color: '#ff6400', label: '3–4 dB', value: 'High ZDR · Large oblate drops' },
    { color: '#e60000', label: '4–5 dB', value: 'Very high ZDR · Very large drops' },
    { color: '#be00d2', label: '5+ dB', value: 'Extreme ZDR · Interpret with surrounding radar fields' },
  ],
  kdp: [
    { color: '#7800b4', label: '< -0.5°/km', value: 'Negative KDP · Interpret with PHI and other polarimetric data' },
    { color: '#3c50e6', label: '-0.5–0°/km', value: 'Near-zero or negative phase gradient' },
    { color: '#00b4dc', label: '0–0.5°/km', value: 'Low KDP · Light rain or ice' },
    { color: '#00c800', label: '0.5–1°/km', value: 'Increasing KDP · Light to moderate rain' },
    { color: '#bee600', label: '1–2°/km', value: 'Moderate KDP · Moderate rain' },
    { color: '#ffc800', label: '2–3°/km', value: 'Elevated KDP · Heavy precipitation' },
    { color: '#ff6400', label: '3–5°/km', value: 'High KDP · Heavy rain' },
    { color: '#dc0000', label: '5–10°/km', value: 'Very high KDP · Intense precipitation' },
  ],
  sw: [
    { color: '#285ad2', label: '0–1 m/s', value: 'Low spectrum width · Narrow velocity distribution' },
    { color: '#00bedc', label: '1–2 m/s', value: 'Moderate spectrum width' },
    { color: '#00c850', label: '2–4 m/s', value: 'Elevated spectrum width' },
    { color: '#dcdc00', label: '4–8 m/s', value: 'High spectrum width · Turbulent or mixed velocities' },
    { color: '#ff8c00', label: '8–12 m/s', value: 'Very high spectrum width' },
    { color: '#e61e14', label: '12–20 m/s', value: 'Extreme spectrum width' },
    { color: '#be00c8', label: '20–30 m/s', value: 'Maximum scale bin · Values above 30 m/s are transparent' },
  ],
  gate_to_gate_shear: [
    { color: '#00bedc', label: '10–20 kt', value: 'Adjacent-gate velocity difference' },
    { color: '#00c850', label: '20–30 kt', value: 'Elevated gate-to-gate velocity difference' },
    { color: '#e6dc00', label: '30–40 kt', value: 'Strong gate-to-gate velocity difference' },
    { color: '#ff8200', label: '40–50 kt', value: 'Very strong gate-to-gate velocity difference' },
    { color: '#e61414', label: '50–60 kt', value: 'Extreme gate-to-gate velocity difference' },
    { color: '#be00c8', label: '60+ kt', value: 'Extreme gate-to-gate velocity difference' },
  ],
  tops: [
    { color: '#3c78ff', label: '2–4 km MSL', value: 'Lowest visible 18 dBZ echo-top bin' },
    { color: '#00d2dc', label: '4–6 km MSL', value: '18 dBZ echo-top height' },
    { color: '#00d246', label: '6–8 km MSL', value: '18 dBZ echo-top height' },
    { color: '#f0e600', label: '8–10 km MSL', value: '18 dBZ echo-top height' },
    { color: '#ff8200', label: '10–12 km MSL', value: 'Deep convection 18 dBZ echo-top height' },
    { color: '#e61414', label: '12–15 km MSL', value: 'Very deep convection 18 dBZ echo-top height' },
    { color: '#be00c8', label: '15+ km MSL', value: 'Highest 18 dBZ echo-top bin' },
  ],
  vil: [
    { color: '#2896ff', label: '0–5 kg/m²', value: 'Light liquid water mass' },
    { color: '#00d2dc', label: '5–15 kg/m²', value: 'Moderate liquid water mass' },
    { color: '#00d246', label: '15–30 kg/m²', value: 'Moisture core' },
    { color: '#f0e600', label: '30–50 kg/m²', value: 'Severe hail / water loading' },
    { color: '#ff7d00', label: '50–75 kg/m²', value: 'Destructive core / downburst potential' },
    { color: '#dc0014', label: '75+ kg/m²', value: 'Extreme hail mass / supercell core' },
  ],
  mesh: [
    { color: '#2896ff', label: '< 0.5 in (< 12.7 mm)', value: 'Lower MESH estimate from the MRMS millimeter grid' },
    { color: '#00d25a', label: '0.5–1 in (12.7–25.4 mm)', value: 'MESH estimated hail size' },
    { color: '#ffe600', label: '1–2 in (25.4–50.8 mm)', value: 'MESH estimated hail size' },
    { color: '#ff7800', label: '2–3 in (50.8–76.2 mm)', value: 'Large hail MESH estimate' },
    { color: '#dc0014', label: '3+ in (≥ 76.2 mm)', value: 'Very large hail MESH estimate' },
  ],
  vil_density: [
    { color: '#00a0ff', label: '0.5–1.5 g/m³', value: 'MRMS VIL density' },
    { color: '#00dc50', label: '1.5–2.5 g/m³', value: 'MRMS VIL density' },
    { color: '#ffe600', label: '2.5–3.5 g/m³', value: 'Higher VIL density' },
    { color: '#ff7800', label: '3.5–4.5 g/m³', value: 'Very high VIL density' },
    { color: '#dc0014', label: '4.5+ g/m³', value: 'Extreme VIL density' },
  ],
  azshear: [
    { color: '#00dc50', label: '+0.002–0.004 s⁻¹', value: 'Positive MRMS 0–2 km azimuthal shear' },
    { color: '#00b400', label: '+0.004–0.006 s⁻¹', value: 'Stronger positive azimuthal shear' },
    { color: '#ffdc00', label: '+0.006–0.010 s⁻¹', value: 'Strong positive azimuthal shear' },
    { color: '#ff4600', label: '≥ +0.010 s⁻¹', value: 'Extreme positive azimuthal shear' },
    { color: '#0096ff', label: '−0.004 to −0.002 s⁻¹', value: 'Negative MRMS 0–2 km azimuthal shear' },
    { color: '#005ae6', label: '−0.006 to −0.004 s⁻¹', value: 'Stronger negative azimuthal shear' },
    { color: '#aa00dc', label: '−0.010 to −0.006 s⁻¹', value: 'Strong negative azimuthal shear' },
    { color: '#dc00b4', label: '≤ −0.010 s⁻¹', value: 'Extreme negative azimuthal shear' },
  ],
  rotation_tracks: [
    { color: '#00dc50', label: '+0.002–0.004 s⁻¹', value: 'Positive 30-minute rotation track signal' },
    { color: '#00b400', label: '+0.004–0.006 s⁻¹', value: 'Stronger rotation track signal' },
    { color: '#ffdc00', label: '+0.006–0.010 s⁻¹', value: 'Strong rotation track signal' },
    { color: '#ff4600', label: '≥ +0.010 s⁻¹', value: 'Extreme rotation track signal' },
    { color: '#0096ff', label: '−0.004 to −0.002 s⁻¹', value: 'Negative 30-minute rotation track signal' },
    { color: '#005ae6', label: '−0.006 to −0.004 s⁻¹', value: 'Stronger negative rotation track signal' },
    { color: '#aa00dc', label: '−0.010 to −0.006 s⁻¹', value: 'Strong negative rotation track signal' },
    { color: '#dc00b4', label: '≤ −0.010 s⁻¹', value: 'Extreme negative rotation track signal' },
  ],
  qpe: [
    { color: '#2896ff', label: '0–5 mm', value: 'MRMS MultiSensor QPE · 1-hour Pass 1 accumulation' },
    { color: '#00d2dc', label: '5–15 mm', value: '1-hour precipitation accumulation' },
    { color: '#00d246', label: '15–30 mm', value: '1-hour precipitation accumulation' },
    { color: '#f0e600', label: '30–50 mm', value: '1-hour precipitation accumulation' },
    { color: '#ff8200', label: '50–75 mm', value: '1-hour precipitation accumulation' },
    { color: '#e61414', label: '75+ mm', value: '1-hour precipitation accumulation' },
  ],
  precip_rate: [
    { color: '#3282ff', label: '0–1 mm/hr', value: 'MRMS radar precipitation rate' },
    { color: '#00bedc', label: '1–2.5 mm/hr', value: 'MRMS radar precipitation rate' },
    { color: '#00d246', label: '2.5–5 mm/hr', value: 'MRMS radar precipitation rate' },
    { color: '#f5e600', label: '5–10 mm/hr', value: 'MRMS radar precipitation rate' },
    { color: '#ff7d00', label: '10–25 mm/hr', value: 'MRMS radar precipitation rate' },
    { color: '#dc0014', label: '25+ mm/hr', value: 'MRMS radar precipitation rate' },
  ],
  hail_detection: [
    { color: '#00a0ff', label: 'SHI 10–20', value: 'MRMS Severe Hail Index' },
    { color: '#00d250', label: 'SHI 20–40', value: 'MRMS Severe Hail Index' },
    { color: '#ffe600', label: 'SHI 40–80', value: 'MRMS Severe Hail Index' },
    { color: '#ff7800', label: 'SHI 80–130', value: 'MRMS Severe Hail Index' },
    { color: '#dc0014', label: 'SHI 130+', value: 'MRMS Severe Hail Index' },
  ],
  rain_mix_snow: [
    { color: '#e61e1e', label: '1 · Warm rain', value: 'Warm stratiform rain' },
    { color: '#1e5ae6', label: '10 · Cool rain', value: 'Cold stratiform rain' },
    { color: '#00d246', label: '6 · Convection', value: 'Convective rain' },
    { color: '#ffe600', label: '3 · Snow', value: 'Snow at the surface' },
    { color: '#00dce6', label: '7 · Hail mix', value: 'Rain mixed with hail' },
    { color: '#9650d2', label: '91 · Tropical stratiform', value: 'Tropical/stratiform rain mix' },
    { color: '#ff7800', label: '96 · Tropical convective', value: 'Tropical/convective rain mix' },
  ],
  satellite: [
    { color: '#0f172a', label: '-80°C', value: '-80°C · Overshooting Convective Tops' },
    { color: '#7c3aed', label: '-65°C', value: '-65°C · Intense Cold Updraft' },
    { color: '#dc2626', label: '-50°C', value: '-50°C · Deep Convective Cloud Top' },
    { color: '#f59e0b', label: '-30°C', value: '-30°C · Mid-Level Glaciated Cloud' },
    { color: '#94a3b8', label: '0°C', value: '0°C · Low Stratus / Marine Boundary' },
    { color: '#cbd5e1', label: '+15°C', value: '+15°C · Warm Ground / Ocean Surface' },
  ],
  spc: [
    { color: '#c1e9c1', label: 'TSTM', value: 'General Thunderstorms · 10% Cloud-to-Ground Lightning' },
    { color: '#7fc57f', label: 'MRGL', value: 'Marginal Risk (1/5) · Isolated Severe Weather' },
    { color: '#f6f67d', label: 'SLGT', value: 'Slight Risk (2/5) · Scattered Severe Thunderstorms' },
    { color: '#edbf69', label: 'ENH', value: 'Enhanced Risk (3/5) · Numerous Severe Storms / Tornadoes' },
    { color: '#e56d6d', label: 'MDT', value: 'Moderate Risk (4/5) · Widespread Severe Weather / Outbreak' },
    { color: '#ff66ff', label: 'HIGH', value: 'High Risk (5/5) · Major Tornado Outbreak / Violent Derecho' },
  ],
  cape: [
    { color: '#64748b', label: '250 J/kg', value: '250 J/kg · Weak Convective Energy' },
    { color: '#06b6d4', label: '1000 J/kg', value: '1,000 J/kg · Moderate Instability' },
    { color: '#10b981', label: '2000 J/kg', value: '2,000 J/kg · Strong Instability' },
    { color: '#f59e0b', label: '3500 J/kg', value: '3,500 J/kg · Extreme Instability' },
    { color: '#ef4444', label: '5000+ J/kg', value: '5,000+ J/kg · Violent Convective Potential' },
  ],
  temp: [
    { color: '#38bdf8', label: '0°F', value: '0°F · Frigid Arctic Cold' },
    { color: '#60a5fa', label: '32°F', value: '32°F · Freezing Threshold' },
    { color: '#4ade80', label: '65°F', value: '65°F · Mild & Comfortable' },
    { color: '#facc15', label: '80°F', value: '80°F · Warm Convective Boundary' },
    { color: '#f97316', label: '95°F', value: '95°F · High Heat Index' },
    { color: '#ef4444', label: '105°F+', value: '105°F+ · Dangerous Extreme Heat' },
  ],
};

const LEGEND_META: Record<string, LegendMeta> = {
  ref: { title: 'Reflectivity', description: 'Radar reflectivity indicating precipitation intensity and storm structure.', legendLabel: 'Reflectivity scale (dBZ)' },
  vel: { title: 'Base Velocity', description: 'Radial velocity showing inbound/outbound motion relative to radar.', legendLabel: 'Velocity scale (kt)' },
  cc: { title: 'Correlation Coefficient', description: 'Correlation Coefficient (CC) indicating uniformity of targets. Lower values can indicate non-meteorological debris or mixed precipitation.', legendLabel: 'Correlation Coefficient (CC)' },
  min_cc: { title: 'Volume-Minimum Correlation Coefficient', description: 'Lowest valid CC sampled from the live Level II elevation sweeps at each map location. App-derived vertical-column estimate, not a separate official Level III product.', legendLabel: 'Minimum sampled CC' },
  zdr: { title: 'Differential Reflectivity', description: 'Differential Reflectivity (ZDR) comparing horizontal and vertical reflectivity to estimate hydrometeor shape/size.', legendLabel: 'Differential Reflectivity (dB)' },
  kdp: { title: 'Specific Differential Phase', description: 'KDP derived from real Level II differential phase with a seven-gate fit; masked where RHO is below 0.80.', legendLabel: 'Specific differential phase scale (°/km)' },
  sw: { title: 'Spectrum Width', description: 'Per-radar Level II spectrum-width moment showing the spread of velocities inside each gate.', legendLabel: 'Spectrum width scale (m/s)' },
  gate_to_gate_shear: { title: 'Gate-to-Gate Shear', description: 'Absolute velocity difference between adjacent real Level II velocity gates.', legendLabel: 'Gate-to-gate shear scale (kt)' },
  tops: { title: 'Echo Tops', description: 'National MRMS 18 dBZ echo-top height grid in km MSL; not a per-site enhanced echo-top product.', legendLabel: 'Echo-top height scale (km MSL)' },
  vil: { title: 'Vertically Integrated Liquid', description: 'National MRMS vertically integrated liquid grid in kg/m²; not a per-site Level III field.', legendLabel: 'VIL scale (kg/m²)' },
  mesh: { title: 'MESH', description: 'National MRMS Maximum Expected Size of Hail estimate; the displayed grid is the current field, not a time-maximum swath.', legendLabel: 'MESH scale (in)' },
  vil_density: { title: 'VIL Density', description: 'National MRMS VIL divided by 18 dBZ echo-top height, in g/m³.', legendLabel: 'VIL density scale (g/m³)' },
  azshear: { title: 'Azimuthal Shear', description: 'National MRMS merged 0–2 km AGL azimuthal shear grid; not N0S storm-relative velocity.', legendLabel: 'Azimuthal shear scale (s⁻¹)' },
  rotation_tracks: { title: 'Rotation Tracks', description: 'Live MRMS rolling 30-minute rotation-track maximum; no playback or track objects are claimed.', legendLabel: 'Rotation track scale (s⁻¹)' },
  qpe: { title: 'Precipitation / QPE', description: 'National MRMS MultiSensor QPE 1-hour Pass 1 accumulation estimate.', legendLabel: 'QPE accumulation scale (mm)' },
  hhc: { title: 'Hydrometeor Classification', description: 'NCEP BDHC WMS imagery is live-verified, but class names and colors are not independently verified here; no numeric scale is claimed.', legendLabel: NO_VERIFIED_SCALE_LABEL },
  precip_rate: { title: 'Precipitation Rate', description: '', legendLabel: 'Precipitation rate scale (mm/hr)' },
  hail_detection: { title: 'Hail Severity Index (SHI)', description: '', legendLabel: 'Hail severity index scale (SHI)' },
  rain_mix_snow: { title: 'Surface Precipitation Type', description: '', legendLabel: 'Surface precipitation type categories' },
  satellite: { title: 'Satellite', description: 'Satellite imagery product.', legendLabel: 'Temperature / imagery scale' },
  spc: { title: 'SPC Outlook', description: 'Storm Prediction Center categorical convective outlook.', legendLabel: 'Risk category scale' },
  cape: { title: 'CAPE', description: '', legendLabel: 'CAPE scale (J/kg)' },
  temp: { title: 'Temperature', description: '', legendLabel: 'Temperature scale (°F)' },
};

const LEGEND_ALIASES: Record<string, string> = {
  ref: 'ref', reflectivity: 'ref', br: 'ref', max_ref: 'ref', ref_x: 'ref', comp_ref: 'ref',
  vel: 'vel', velocity: 'vel', bv: 'vel', srvel: 'vel', srv: 'vel', sr_v: 'vel', storm_relative_velocity: 'vel',
  cc: 'cc', correlation: 'cc', correlation_coefficient: 'cc',
  min_cc: 'min_cc', mcc: 'min_cc',
  zdr: 'zdr', differential_reflectivity: 'zdr',
  kdp: 'kdp', specific_differential_phase: 'kdp',
  sw: 'sw', spectrum_width: 'sw',
  gate: 'gate_to_gate_shear', gate_to_gate: 'gate_to_gate_shear', gate_to_gate_shear: 'gate_to_gate_shear',
  tops: 'tops', et: 'tops', echo_tops: 'tops', enhanced_echo_tops: 'tops',
  vil: 'vil', vild: 'vil_density', vil_density: 'vil_density',
  mesh: 'mesh',
  az: 'azshear', azshear: 'azshear', az_shear: 'azshear', azimuthal_shear: 'azshear',
  trk: 'rotation_tracks', rotation_tracks: 'rotation_tracks', rotation_track: 'rotation_tracks', rottrk: 'rotation_tracks',
  qpe: 'qpe',
  rate: 'precip_rate', precip_rate: 'precip_rate', precipitation_rate: 'precip_rate',
  hail: 'hail_detection', hail_detection: 'hail_detection', hail_severity_index: 'hail_detection',
  rms: 'rain_mix_snow', rain_mix_snow: 'rain_mix_snow', precip_flag: 'rain_mix_snow',
  satellite: 'satellite', geocolor: 'satellite', goes_east: 'satellite', goes_west: 'satellite', infrared: 'satellite', clean_ir: 'satellite',
  spc: 'spc', outlook: 'spc',
  cape: 'cape', temp: 'temp',
  // Product IDs with no verified scale are mapped to themselves, never to REF.
  nrot: 'nrot', norm_vel: 'nrot', normalized_rotation: 'nrot',
  hhc: 'hhc', gate_filter: 'gate_filter', cross_section: 'cross_section',
  storm_analysis: 'storm_analysis', volume_scan: 'volume_scan', tilt_selection: 'tilt_selection',
};

function normalizeLookupKey(raw: string): string {
  const canonical = canonicalRadarProductId(raw || '');
  return canonical.trim().toLowerCase().replace(/[\s-]+/g, '_').replace(/_+/g, '_');
}

/**
 * Static proof of alias ordering:
 * 1. Exact LEGEND_ALIASES / LEGENDS keys resolve before any substring rule, so
 *    `azshear`, `hail`, `rotation_tracks`/`trk`, and `vild` cannot be captured
 *    by the broad `ref` or `vel` rules.
 * 2. Specialized substring rules (VIL density, rotation, azshear, SHI, gate
 *    shear, precip type) run before generic reflectivity/velocity rules.
 * 3. Unknown or unverified IDs return '' and render a neutral state, not REF.
 */
function normalizeLegendType(raw: string): string {
  const key = normalizeLookupKey(raw);
  if (!key) return '';

  const alias = LEGEND_ALIASES[key];
  if (alias) return alias;
  if (Object.prototype.hasOwnProperty.call(LEGENDS, key)) return key;

  if (key.includes('vil_density') || key.includes('vild')) return 'vil_density';
  if (key.includes('rotation_track') || key.includes('rottrk')) return 'rotation_tracks';
  if (key.includes('azshear') || key.includes('az_shear')) return 'azshear';
  if (key.includes('precip_rate') || key.includes('precipitation_rate')) return 'precip_rate';
  if (key.includes('hail_detection') || key.includes('hail_severity') || key.includes('severe_hail_index') || key.includes('shi') || key.includes('hail')) return 'hail_detection';
  if (key.includes('gate_to_gate') || key.includes('gate_shear')) return 'gate_to_gate_shear';
  if (key.includes('rain_mix_snow') || key.includes('precip_flag') || key.includes('precip_type')) return 'rain_mix_snow';
  if (key.includes('qpe')) return 'qpe';
  if (key.includes('specific_differential_phase') || key.includes('kdp')) return 'kdp';
  if (key.includes('spectrum_width')) return 'sw';
  if (key.includes('echo_tops') || key.includes('tops')) return 'tops';
  if (key.includes('mesh')) return 'mesh';
  if (key.includes('min_cc') || key.includes('minimum_cc') || key.includes('mcc')) return 'min_cc';
  if (key.includes('cc') || key.includes('correlation')) return 'cc';
  if (key.includes('zdr') || key.includes('differential_reflectivity')) return 'zdr';
  if (key.includes('reflect') || key.includes('ref')) return 'ref';
  if (key.includes('vel')) return 'vel';
  if (key.includes('sat') || key.includes('goes') || key.includes('ir') || key.includes('geocolor')) return 'satellite';
  if (key.includes('spc') || key.includes('outlook') || key.includes('cat')) return 'spc';
  if (key.includes('cape')) return 'cape';
  if (key.includes('temp')) return 'temp';
  return '';
}

function toProductLegendStep(step: LegendStep): ProductLegendStep {
  const prefix = `${step.label} · `;
  const meaning = step.value.startsWith(prefix) ? step.value.slice(prefix.length) : step.value;
  return { color: step.color, label: step.label, value: step.label, meaning };
}

/** Read-only accessor: returns fresh step objects so callers cannot mutate LEGENDS. */
export function getProductLegendInfo(type: string): ProductLegendInfo {
  const key = normalizeLegendType(type);
  const steps = key ? LEGENDS[key] : undefined;
  const meta = key ? LEGEND_META[key] : undefined;

  if (!steps || steps.length === 0 || !meta) {
    return {
      key,
      title: '',
      description: '',
      legendLabel: NO_VERIFIED_SCALE_LABEL,
      steps: [],
      hasVerifiedScale: false,
    };
  }

  return {
    key,
    title: meta.title,
    description: meta.description,
    legendLabel: meta.legendLabel,
    steps: steps.map(toProductLegendStep),
    hasVerifiedScale: true,
  };
}

export function UniversalLegend({
  type,
  activeAnnouncement,
  onDismissAnnouncement,
  onSpeakAnnouncement,
}: Props) {
  const [hovered, setHovered] = useState<LegendStep | null>(null);
  const legendKey = normalizeLegendType(type);
  const steps = legendKey ? LEGENDS[legendKey] ?? [] : [];

  return (
    <div className="relative w-full z-50 select-none">
      {/* 1. Optional Temporary Alert Announcement Banner (Section 11) */}
      {activeAnnouncement && (
        <div className="flex items-center justify-between bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 px-3 py-1 text-white shadow-xl text-xs font-bold">
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-[11px]">
              ⚠️
            </span>
            <span className="font-mono uppercase tracking-wider text-[10px] bg-[#050a12]/80 px-1.5 py-0.5 rounded">
              OFFICIAL NWS ALERT
            </span>
            <span className="truncate">
              <b>{activeAnnouncement.event}:</b> {activeAnnouncement.area || activeAnnouncement.headline}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
            {onSpeakAnnouncement && (
              <button
                onClick={onSpeakAnnouncement}
                className="flex items-center gap-1 rounded bg-[#050a12]/80 hover:bg-black/50 px-2 py-0.5 text-[10px] font-bold text-white transition cursor-pointer"
                title="Speak Warning Announcement"
              >
                <span>🔊</span> Listen
              </button>
            )}
            {onDismissAnnouncement && (
              <button
                onClick={onDismissAnnouncement}
                className="rounded bg-black/20 hover:bg-black/40 px-1.5 py-0.5 text-[10px] text-white transition cursor-pointer"
                title="Dismiss Banner"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      )}

      {/* 2. Pinned Universal Data Legend Color Strip (Section 2.A) */}
      {steps.length > 0 ? (
        <div className="flex h-2 w-full cursor-crosshair shadow-md">
          {steps.map((s, idx) => (
            <div
              key={idx}
              style={{ backgroundColor: s.color }}
              className="flex-1 transition-opacity hover:opacity-80"
              onMouseEnter={() => setHovered(s)}
              onMouseLeave={() => setHovered(null)}
            />
          ))}
        </div>
      ) : (
        <div className="flex h-4 w-full items-center justify-center bg-slate-800 text-[9px] font-bold uppercase tracking-wide text-slate-400">
          {NO_VERIFIED_SCALE_LABEL}
        </div>
      )}

      {/* 3. Floating Tooltip on Hover */}
      {hovered && steps.length > 0 && (
        <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full border border-white/20 bg-[#0b1220] px-3 py-1 text-[10px] font-mono font-bold text-white shadow-2xl z-50 flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full border border-white/40"
            style={{ backgroundColor: hovered.color }}
          />
          <span>{hovered.value}</span>
        </div>
      )}
    </div>
  );
}
