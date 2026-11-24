'use client';

import { useState } from 'react';

export type LegendType =
  | 'ref'
  | 'max_ref'
  | 'ref_x'
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
  | 'azshear'
  | 'rotation_tracks'
  | 'qpe'
  | 'precip_rate'
  | 'hail_detection'
  | 'gate_to_gate_shear'
  | 'rain_mix_snow'
  | 'satellite'
  | 'spc'
  | 'cape'
  | 'temp';

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
    { color: '#7830b4', label: '< -0.5°/km', value: 'Negative KDP · Interpret with PHI and other polarimetric data' },
    { color: '#3c50e6', label: '-0.5–0°/km', value: 'Near-zero or negative phase gradient' },
    { color: '#00b4dc', label: '0–0.5°/km', value: 'Low KDP · Light rain or ice' },
    { color: '#00c800', label: '0.5–1°/km', value: 'Increasing KDP · Light to moderate rain' },
    { color: '#bee600', label: '1–2°/km', value: 'Moderate KDP · Moderate rain' },
    { color: '#ffc800', label: '2–3°/km', value: 'Elevated KDP · Heavy precipitation' },
    { color: '#ff6400', label: '3–5°/km', value: 'High KDP · Heavy rain' },
    { color: '#dc0000', label: '5+°/km', value: 'Very high KDP · Intense precipitation' },
  ],
  sw: [
    { color: '#285ad2', label: '0–1 m/s', value: 'Low spectrum width · Narrow velocity distribution' },
    { color: '#00bedc', label: '1–2 m/s', value: 'Moderate spectrum width' },
    { color: '#00c850', label: '2–4 m/s', value: 'Elevated spectrum width' },
    { color: '#dcdc00', label: '4–8 m/s', value: 'High spectrum width · Turbulent or mixed velocities' },
    { color: '#ff8c00', label: '8–12 m/s', value: 'Very high spectrum width' },
    { color: '#e61e14', label: '12–20 m/s', value: 'Extreme spectrum width' },
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
    { color: '#3c78ff', label: '4 km MSL', value: '4 km MSL · 18 dBZ echo-top height' },
    { color: '#00d2dc', label: '6 km MSL', value: '6 km MSL · 18 dBZ echo-top height' },
    { color: '#00d246', label: '8 km MSL', value: '8 km MSL · 18 dBZ echo-top height' },
    { color: '#f0e600', label: '10 km MSL', value: '10 km MSL · 18 dBZ echo-top height' },
    { color: '#ff8200', label: '12 km MSL', value: '12 km MSL · 18 dBZ echo-top height' },
    { color: '#e61414', label: '15+ km MSL', value: '15+ km MSL · 18 dBZ echo-top height' },
  ],
  vil: [
    { color: '#04e9e7', label: '10 kg/m²', value: '10 kg/m² · Light Water Mass' },
    { color: '#02fd02', label: '25 kg/m²', value: '25 kg/m² · Moderate Moisture Core' },
    { color: '#fdf802', label: '45 kg/m²', value: '45 kg/m² · Severe Hail / Water Loading' },
    { color: '#fd0000', label: '60 kg/m²', value: '60 kg/m² · Destructive Core / Downburst Potential' },
    { color: '#f800fd', label: '75+ kg/m²', value: '75+ kg/m² · Extreme Hail Mass / Supercell Core' },
  ],
  mesh: [
    { color: '#2896ff', label: '< 0.5 in', value: 'Lower MESH estimate' },
    { color: '#00d25a', label: '0.5–1 in', value: 'MESH estimated hail size' },
    { color: '#ffe600', label: '1–2 in', value: 'MESH estimated hail size' },
    { color: '#ff7800', label: '2–3 in', value: 'MESH estimated hail size' },
    { color: '#dc0014', label: '3+ in', value: 'MESH estimated hail size' },
  ],
  vil_density: [
    { color: '#00a0ff', label: '0.5–1.5 g/m³', value: 'MRMS VIL density' },
    { color: '#00dc50', label: '1.5–2.5 g/m³', value: 'MRMS VIL density' },
    { color: '#ffe600', label: '2.5–3.5 g/m³', value: 'Higher VIL density' },
    { color: '#ff7800', label: '3.5–4.5 g/m³', value: 'Very high VIL density' },
    { color: '#dc0014', label: '4.5+ g/m³', value: 'Extreme VIL density' },
  ],
  azshear: [
    { color: '#00dc50', label: '+0.004 s⁻¹', value: 'Positive MRMS 0–2 km azimuthal shear' },
    { color: '#ffe600', label: '+0.006 s⁻¹', value: 'Stronger positive azimuthal shear' },
    { color: '#ff7800', label: '+0.010 s⁻¹', value: 'Strong positive azimuthal shear' },
    { color: '#005ae6', label: '−0.004 s⁻¹', value: 'Negative MRMS 0–2 km azimuthal shear' },
    { color: '#dc00b4', label: '−0.010 s⁻¹', value: 'Strong negative azimuthal shear' },
  ],
  rotation_tracks: [
    { color: '#00dc50', label: '+0.004 s⁻¹', value: 'Positive 30-minute rotation track signal' },
    { color: '#ffe600', label: '+0.006 s⁻¹', value: 'Stronger rotation track signal' },
    { color: '#ff7800', label: '+0.010 s⁻¹', value: 'Strong rotation track signal' },
    { color: '#005ae6', label: '−0.004 s⁻¹', value: 'Negative rotation track signal' },
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

function normalizeLegendType(raw: string): string {
  const lower = (raw || '').toLowerCase();
  if (lower === 'sw') return 'sw';
  if (lower.includes('vil_density') || lower === 'vild') return 'vil_density';
  if (lower.includes('rotation_tracks') || lower === 'trk') return 'rotation_tracks';
  if (lower.includes('azshear') || lower === 'az') return 'azshear';
  if (lower === 'qpe') return 'qpe';
  if (lower.includes('precip_rate') || lower === 'rate') return 'precip_rate';
  if (lower.includes('hail_detection') || lower === 'hail') return 'hail_detection';
  if (lower.includes('gate_to_gate') || lower === 'gate') return 'gate_to_gate_shear';
  if (lower.includes('rain_mix_snow') || lower === 'rms') return 'rain_mix_snow';
  if (lower.includes('max_ref') || lower.includes('ref_x') || lower.includes('ref')) return 'ref';
  if (lower.includes('vel') || lower.includes('srvel') || lower.includes('azshear')) return 'vel';
  if (lower.includes('cc')) return 'cc';
  if (lower.includes('zdr')) return 'zdr';
  if (lower.includes('kdp')) return 'kdp';
  if (lower.includes('tops')) return 'tops';
  if (lower.includes('vil')) return 'vil';
  if (lower.includes('mesh') || lower.includes('hail')) return 'mesh';
  if (lower.includes('sat') || lower.includes('goes') || lower.includes('ir') || lower.includes('geocolor')) return 'satellite';
  if (lower.includes('spc') || lower.includes('outlook') || lower.includes('cat')) return 'spc';
  if (lower.includes('cape')) return 'cape';
  if (lower.includes('temp')) return 'temp';
  return 'ref';
}

export function UniversalLegend({
  type,
  activeAnnouncement,
  onDismissAnnouncement,
  onSpeakAnnouncement,
}: Props) {
  const [hovered, setHovered] = useState<LegendStep | null>(null);
  const legendKey = normalizeLegendType(type);
  const steps = LEGENDS[legendKey] || LEGENDS.ref;

  return (
    <div className="relative w-full z-50 select-none">
      {/* 1. Optional Temporary Alert Announcement Banner (Section 11) */}
      {activeAnnouncement && (
        <div className="flex items-center justify-between bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 px-3 py-1 text-white shadow-xl animate-fade-in text-xs font-bold">
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-[11px] animate-pulse">
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

      {/* 3. Floating Tooltip on Hover */}
      {hovered && (
        <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full border border-white/20 bg-[#0b1220] px-3 py-1 text-[10px] font-mono font-bold text-white shadow-2xl animate-fade-in z-50 flex items-center gap-1.5">
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
