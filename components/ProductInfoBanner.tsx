'use client';

import { useEffect, useMemo, useState } from 'react';
import type { WeatherAlert } from '../lib/alerts/model';

type LegendStep = { color: string; label: string; value: string; meaning: string; unit?: string };

const REF: LegendStep[] = [
  { color: '#04e9e7', label: '5', value: '5', unit: 'dBZ', meaning: 'Very light / drizzle' },
  { color: '#019ff4', label: '15', value: '15', unit: 'dBZ', meaning: 'Light rain' },
  { color: '#0300f4', label: '25', value: '25', unit: 'dBZ', meaning: 'Moderate rain' },
  { color: '#02fd02', label: '35', value: '35', unit: 'dBZ', meaning: 'Heavy rain' },
  { color: '#01c501', label: '40', value: '40', unit: 'dBZ', meaning: 'Convective thunderstorm' },
  { color: '#fdf802', label: '45', value: '45', unit: 'dBZ', meaning: 'Hail growth zone' },
  { color: '#fd9500', label: '50', value: '50', unit: 'dBZ', meaning: 'Severe core / small hail' },
  { color: '#fd0000', label: '55', value: '55', unit: 'dBZ', meaning: 'Severe hail possible' },
  { color: '#d40000', label: '60', value: '60', unit: 'dBZ', meaning: 'Destructive hail possible' },
  { color: '#f800fd', label: '65', value: '65', unit: 'dBZ', meaning: 'Giant hail core / BWER' },
  { color: '#9854c6', label: '70', value: '70', unit: 'dBZ', meaning: 'Violent supercell core' },
  { color: '#ffffff', label: '75+', value: '75+', unit: 'dBZ', meaning: 'Extreme hail / debris' },
];

const VEL: LegendStep[] = [
  { color: '#00ffff', label: '-64', value: '-64', unit: 'kt', meaning: 'Extreme inbound' },
  { color: '#00a86b', label: '-45', value: '-45', unit: 'kt', meaning: 'Strong inbound' },
  { color: '#10b981', label: '-25', value: '-25', unit: 'kt', meaning: 'Moderate inbound' },
  { color: '#64748b', label: '0', value: '0', unit: 'kt', meaning: 'Zero radial velocity' },
  { color: '#f59e0b', label: '+25', value: '+25', unit: 'kt', meaning: 'Moderate outbound' },
  { color: '#ea580c', label: '+45', value: '+45', unit: 'kt', meaning: 'Strong outbound' },
  { color: '#ef4444', label: '+64', value: '+64', unit: 'kt', meaning: 'Extreme outbound' },
  { color: '#f43f5e', label: '+80+', value: '+80+', unit: 'kt', meaning: 'Severe velocity couplet / TVS' },
];

const SAT: LegendStep[] = [
  { color: '#0f172a', label: '-80°C', value: '-80', unit: '°C', meaning: 'Overshooting convective tops' },
  { color: '#7c3aed', label: '-65°C', value: '-65', unit: '°C', meaning: 'Intense cold updraft' },
  { color: '#dc2626', label: '-50°C', value: '-50', unit: '°C', meaning: 'Deep convective cloud top' },
  { color: '#f59e0b', label: '-30°C', value: '-30', unit: '°C', meaning: 'Mid-level glaciated cloud' },
  { color: '#94a3b8', label: '0°C', value: '0', unit: '°C', meaning: 'Low stratus / boundary' },
  { color: '#cbd5e1', label: '+15°C', value: '+15', unit: '°C', meaning: 'Warm ground / ocean surface' },
];

const CC: LegendStep[] = [
  { color: '#dc0000', label: '0.50', value: '0.50-0.80', unit: 'CC', meaning: 'Low CC: mixed/non-meteorological returns' },
  { color: '#ff8000', label: '0.85', value: '0.80-0.85', unit: 'CC', meaning: 'Reduced CC: mixed hydrometeors' },
  { color: '#ffdc00', label: '0.90', value: '0.85-0.90', unit: 'CC', meaning: 'Moderate CC: mixed precipitation' },
  { color: '#00be00', label: '0.95', value: '0.90-0.95', unit: 'CC', meaning: 'High CC: more uniform precipitation' },
  { color: '#0064ff', label: '0.97', value: '0.95-0.97', unit: 'CC', meaning: 'Very high CC: uniform precipitation' },
  { color: '#00ffff', label: '0.99', value: '0.97-0.99', unit: 'CC', meaning: 'Near-unity CC: uniform precipitation' },
  { color: '#ffffff', label: '1.00', value: '0.99+', unit: 'CC', meaning: 'Near-perfect CC: highly uniform echoes' },
];

const MIN_CC: LegendStep[] = [
  { color: '#9600b4', label: '< 0.50', value: '0.20-0.50', unit: 'CC', meaning: 'Very low sampled CC' },
  { color: '#285ad2', label: '0.50-0.65', value: '0.50-0.65', unit: 'CC', meaning: 'Low sampled CC' },
  { color: '#00bedc', label: '0.65-0.80', value: '0.65-0.80', unit: 'CC', meaning: 'Reduced sampled CC' },
  { color: '#00be00', label: '0.80-0.90', value: '0.80-0.90', unit: 'CC', meaning: 'Moderate sampled CC' },
  { color: '#dcdc00', label: '0.90-0.95', value: '0.90-0.95', unit: 'CC', meaning: 'High sampled CC' },
  { color: '#ff8000', label: '0.95-0.97', value: '0.95-0.97', unit: 'CC', meaning: 'Very high sampled CC' },
  { color: '#ffffff', label: '0.97+', value: '0.97-1.05', unit: 'CC', meaning: 'Near-unity minimum CC' },
];

const ZDR: LegendStep[] = [
  { color: '#8246c8', label: '-1', value: '< -1', unit: 'dB', meaning: 'Negative ZDR: vertically oriented/mixed targets' },
  { color: '#2878ff', label: '0', value: '-1-0', unit: 'dB', meaning: 'Low ZDR: small/mixed hydrometeors' },
  { color: '#00bedc', label: '0.5', value: '0-0.5', unit: 'dB', meaning: 'Near-zero ZDR: spherical/mixed targets' },
  { color: '#00c800', label: '1', value: '0.5-1', unit: 'dB', meaning: 'Low positive ZDR: small raindrops' },
  { color: '#b4e600', label: '2', value: '1-2', unit: 'dB', meaning: 'Moderate ZDR: typical rain drops' },
  { color: '#ffc800', label: '3', value: '2-3', unit: 'dB', meaning: 'Elevated ZDR: larger oblate drops' },
  { color: '#ff6400', label: '4', value: '3-4', unit: 'dB', meaning: 'High ZDR: large oblate drops' },
  { color: '#e60000', label: '5+', value: '4-5+', unit: 'dB', meaning: 'Very high ZDR: very large drops/interpret with CC' },
];

const SPC: LegendStep[] = [
  { color: '#c1e9c1', label: 'TSTM', value: 'TSTM', unit: '', meaning: 'General thunderstorms' },
  { color: '#7fc57f', label: 'MRGL', value: 'MRGL', unit: '', meaning: 'Marginal risk (1/5)' },
  { color: '#f6f67d', label: 'SLGT', value: 'SLGT', unit: '', meaning: 'Slight risk (2/5)' },
  { color: '#edbf69', label: 'ENH', value: 'ENH', unit: '', meaning: 'Enhanced risk (3/5)' },
  { color: '#e56d6d', label: 'MDT', value: 'MDT', unit: '', meaning: 'Moderate risk (4/5)' },
  { color: '#ff66ff', label: 'HIGH', value: 'HIGH', unit: '', meaning: 'High risk (5/5)' },
];

type Props = {
  tab: string;
  product: string;
  satelliteLabel?: string;
  satelliteDescription?: string;
  outlookDay?: string;
  modelLabel?: string;
  modelFieldLabel?: string;
  modelStatus?: string;
  alertBanner: WeatherAlert | null;
};

function alertHeadline(alert: WeatherAlert): string {
  const event = (alert.event || 'Warning').toUpperCase();
  const area = alert.areaDesc || alert.headline || 'selected area';
  return `NEW ${event} ISSUED FOR ${area}`;
}

export function ProductInfoBanner(props: Props) {
  const [hovered, setHovered] = useState<LegendStep | null>(null);
  const [alertVisible, setAlertVisible] = useState<WeatherAlert | null>(null);

  useEffect(() => {
    if (!props.alertBanner) return;
    setAlertVisible(props.alertBanner);
    const t = setTimeout(() => setAlertVisible(null), 10000);
    return () => clearTimeout(t);
  }, [props.alertBanner?.id]);

  const info = useMemo(() => {
    if (props.tab === 'Radar' || props.tab === 'Composite') {
      if (props.product === 'vel' || props.product === 'srvel' || props.product === 'norm_vel') {
        return { title: props.product === 'srvel' ? 'Storm Relative Velocity' : props.product === 'norm_vel' ? 'Normal Velocity' : 'Base Velocity', desc: 'Radial velocity showing inbound/outbound motion relative to radar.', scale: VEL, legendLabel: 'Velocity scale (kt)' };
      }
      if (props.product === 'min_cc') {
        return { title: 'Volume-Minimum Correlation Coefficient', desc: 'Lowest valid CC sampled from the live Level II elevation sweeps at each map location. App-derived vertical-column estimate, not a separate official Level III product.', scale: MIN_CC, legendLabel: 'Minimum sampled CC' };
      }
      if (props.product === 'cc') {
        return { title: 'Correlation Coefficient', desc: 'Correlation Coefficient (CC) indicating uniformity of targets. Lower values can indicate non-meteorological debris or mixed precipitation.', scale: CC, legendLabel: 'Correlation Coefficient (CC)' };
      }
      if (props.product === 'zdr') {
        return { title: 'Differential Reflectivity', desc: 'Differential Reflectivity (ZDR) comparing horizontal and vertical reflectivity to estimate hydrometeor shape/size.', scale: ZDR, legendLabel: 'Differential Reflectivity (dB)' };
      }
      return { title: props.product === 'max_ref' ? 'Maximum Reflectivity' : 'Reflectivity', desc: 'Radar reflectivity indicating precipitation intensity and storm structure.', scale: REF, legendLabel: 'Reflectivity scale (dBZ)' };
    }
    if (props.tab === 'Satellite') {
      return { title: props.satelliteLabel || 'Satellite', desc: props.satelliteDescription || 'Satellite imagery product.', scale: SAT, legendLabel: 'Temperature / imagery scale' };
    }
    if (props.tab === 'Outlooks') {
      return { title: `SPC ${props.outlookDay || 'Day 1'} Outlook`, desc: 'Storm Prediction Center categorical convective outlook.', scale: SPC, legendLabel: 'Risk category scale' };
    }
    if (props.tab === 'Models') {
      return { title: props.modelLabel || 'Model', desc: `${props.modelFieldLabel || 'Model field'}${props.modelStatus ? ` · ${props.modelStatus}` : ''}`, scale: [], legendLabel: '' };
    }
    return { title: 'MesoVortexWX', desc: 'Operational weather workstation.', scale: REF, legendLabel: 'Scale' };
  }, [props.tab, props.product, props.satelliteLabel, props.satelliteDescription, props.outlookDay, props.modelLabel, props.modelFieldLabel, props.modelStatus]);

  return (
    <div className={`shrink-0 border-b border-slate-800 bg-[#0a111d] text-slate-100 transition-all duration-300 ${alertVisible ? 'py-2' : 'py-1.5'}`}>
      {alertVisible && (
        <div className="mx-3 mb-1.5 overflow-hidden rounded-full border border-red-700 bg-red-950/70 px-3 py-1">
          <div className="animate-[marquee_10s_linear_1] whitespace-nowrap text-[11px] font-black tracking-wide text-red-100">
            {alertHeadline(alertVisible)}
          </div>
        </div>
      )}
      <div className="mx-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <div className="min-w-0">
          <div className="text-[10px] font-black uppercase tracking-[0.14em] text-sky-300">Product Information</div>
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-black text-white">{info.title}</span>
            <span className="hidden md:inline text-[11px] text-slate-400 truncate">{info.desc}</span>
          </div>
        </div>
        {info.scale.length > 0 && (
          <div className="flex min-w-[220px] flex-1 items-center gap-2">
            <span className="hidden lg:inline text-[10px] font-bold uppercase tracking-wide text-slate-500">{info.legendLabel}</span>
            <div className="flex h-4 flex-1 overflow-hidden rounded-full border border-slate-700 bg-slate-900">
              {info.scale.map((s, i) => (
                <div key={`${s.label}-${i}`} className="flex-1" style={{ background: s.color }} title={`${s.value}${s.unit ? ' ' + s.unit : ''} — ${s.meaning}`}
                  onMouseEnter={() => setHovered(s)} onMouseLeave={() => setHovered(null)} />
              ))}
            </div>
            <div className="min-w-[180px] text-[10px] text-slate-300">
              {hovered ? <span><span className="font-black text-white">{hovered.value}{hovered.unit ? ` ${hovered.unit}` : ''}</span> <span className="text-slate-400">— {hovered.meaning}</span></span> : <span className="text-slate-500">Hover spectrum for value</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
