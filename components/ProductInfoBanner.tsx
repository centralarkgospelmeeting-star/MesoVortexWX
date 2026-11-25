'use client';

import { useEffect, useMemo, useState } from 'react';
import type { WeatherAlert } from '../lib/alerts/model';
import {
  canonicalRadarProductId,
  getRadarCapability,
  type RadarProductCapability,
} from '../lib/radar/capability-matrix';
import {
  getProductLegendInfo,
  NO_VERIFIED_SCALE_LABEL,
  type ProductLegendStep,
} from './UniversalLegend';

// UI-only IDs that do not have a 1:1 capability-matrix id. These are aliases,
// not new products or new scale definitions.
const CAPABILITY_ID_ALIASES: Record<string, string> = {
  ref_x: 'ref',
  norm_vel: 'nrot',
};

function capabilityId(product: string): string {
  const normalized = product.trim().toLowerCase();
  return CAPABILITY_ID_ALIASES[normalized] ?? canonicalRadarProductId(normalized);
}

/** Reuses only capability-matrix wording; no new product claims are introduced. */
function capabilityDescription(cap: RadarProductCapability): string {
  const detail = cap.unavailableReason || cap.source.notes || cap.dataHonesty.reason || '';
  const honesty = cap.dataHonesty.reason && cap.dataHonesty.reason !== detail
    ? ` · ${cap.dataHonesty.reason}`
    : '';
  return `${detail}${honesty}`;
}

/** Display-only provenance derived from the authoritative capability matrix. */
function capabilityProvenance(cap: RadarProductCapability, radarSite?: string, tilt?: string): Array<{ label: string; value: string }> {
  const elevation = cap.tiltSupport.length === 0
    ? 'National grid / no tilt'
    : tilt && cap.tiltSupport.includes(tilt)
      ? `${tilt}°`
      : cap.tiltSupport.map((t) => `${t}°`).join(' · ');
  const domain = cap.id === 'composite_n0q' || cap.source.type === 'NOAA_AWS_MRMS'
    ? 'MULTI-RADAR / MRMS'
    : cap.source.type === 'NONE'
      ? 'UNVERIFIED'
      : 'SINGLE RADAR';
  return [
    { label: 'Domain', value: domain },
    { label: 'Source', value: cap.source.provider },
    { label: 'Grid', value: cap.source.productCode || cap.shortLabel },
    ...(radarSite && cap.tiltSupport.length > 0 ? [{ label: 'Site', value: radarSite }] : []),
    { label: 'Elevation', value: elevation },
    { label: 'Verification', value: `${cap.verification.level} · ${cap.verification.lastCheckedAt}` },
    { label: 'Support', value: `${cap.playbackSupport} · archive ${cap.archiveSupport}` },
  ];
}

type Props = {
  tab: string;
  product: string;
  radarSite?: string;
  tilt?: string;
  satelliteLabel?: string;
  satelliteDescription?: string;
  outlookDay?: string;
  modelLabel?: string;
  modelFieldLabel?: string;
  modelStatus?: string;
  alertBanner: WeatherAlert | null;
};

type BannerInfo = {
  title: string;
  desc: string;
  steps: readonly ProductLegendStep[];
  legendLabel: string;
  hasVerifiedScale: boolean;
  provenance: Array<{ label: string; value: string }>;
};

function alertHeadline(alert: WeatherAlert): string {
  const event = (alert.event || 'Warning').toUpperCase();
  const area = alert.areaDesc || alert.headline || 'selected area';
  return `NEW ${event} ISSUED FOR ${area}`;
}

function radarBannerInfo(product: string, radarSite?: string, tilt?: string): BannerInfo {
  const legend = getProductLegendInfo(product);
  const cap = getRadarCapability(capabilityId(product));
  const legendLabel = legend.hasVerifiedScale ? legend.legendLabel : NO_VERIFIED_SCALE_LABEL;

  if (cap) {
    return {
      title: cap.name,
      desc: capabilityDescription(cap),
      steps: legend.steps,
      legendLabel,
      hasVerifiedScale: legend.hasVerifiedScale,
      provenance: capabilityProvenance(cap, radarSite, tilt),
    };
  }

  return {
    title: product || 'Radar product',
    desc: legend.description,
    steps: legend.steps,
    legendLabel,
    hasVerifiedScale: legend.hasVerifiedScale,
    provenance: [],
  };
}

function satelliteBannerInfo(label?: string, description?: string): BannerInfo {
  const legend = getProductLegendInfo('satellite');
  return {
    title: label || legend.title || 'Satellite',
    desc: description || legend.description,
    steps: legend.steps,
    legendLabel: legend.hasVerifiedScale ? legend.legendLabel : NO_VERIFIED_SCALE_LABEL,
    hasVerifiedScale: legend.hasVerifiedScale,
    provenance: [],
  };
}

function outlookBannerInfo(day?: string): BannerInfo {
  const legend = getProductLegendInfo('spc');
  return {
    title: `SPC ${day || 'Day 1'} Outlook`,
    desc: legend.description || 'Storm Prediction Center categorical convective outlook.',
    steps: legend.steps,
    legendLabel: legend.hasVerifiedScale ? legend.legendLabel : NO_VERIFIED_SCALE_LABEL,
    hasVerifiedScale: legend.hasVerifiedScale,
    provenance: [],
  };
}

function modelBannerInfo(props: Props): BannerInfo {
  return {
    title: props.modelLabel || 'Model',
    desc: `${props.modelFieldLabel || 'Model field'}${props.modelStatus ? ` · ${props.modelStatus}` : ''}`,
    steps: [],
    legendLabel: NO_VERIFIED_SCALE_LABEL,
    hasVerifiedScale: false,
    provenance: [],
  };
}

export function ProductInfoBanner(props: Props) {
  const [hovered, setHovered] = useState<ProductLegendStep | null>(null);
  const [alertVisible, setAlertVisible] = useState<WeatherAlert | null>(null);

  useEffect(() => {
    if (!props.alertBanner) return;
    setAlertVisible(props.alertBanner);
    const t = setTimeout(() => setAlertVisible(null), 10000);
    return () => clearTimeout(t);
  }, [props.alertBanner?.id]);

  useEffect(() => {
    setHovered(null);
  }, [props.tab, props.product]);

  const info = useMemo<BannerInfo>(() => {
    if (props.tab === 'Radar' || props.tab === 'Composite') {
      return radarBannerInfo(props.product, props.radarSite, props.tilt);
    }
    if (props.tab === 'Satellite') {
      return satelliteBannerInfo(props.satelliteLabel, props.satelliteDescription);
    }
    if (props.tab === 'Outlooks') {
      return outlookBannerInfo(props.outlookDay);
    }
    if (props.tab === 'Models') {
      return modelBannerInfo(props);
    }
    return radarBannerInfo(props.product);
  }, [
    props.tab,
    props.product,
    props.radarSite,
    props.tilt,
    props.satelliteLabel,
    props.satelliteDescription,
    props.outlookDay,
    props.modelLabel,
    props.modelFieldLabel,
    props.modelStatus,
  ]);

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
        <div className="min-w-0 max-w-[min(46rem,70vw)]">
          <div className="text-[10px] font-black uppercase tracking-[0.14em] text-sky-300">Product Information</div>
          <div className="flex items-baseline gap-2">
            <span className="shrink-0 text-sm font-black text-white">{info.title}</span>
            <span className="truncate text-[11px] text-slate-400" title={info.desc}>{info.desc}</span>
          </div>
          {info.provenance.length > 0 && (
            <div data-provenance="radar" className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[9px] text-slate-500">
              {info.provenance.map((p) => (
                <span key={p.label} className="whitespace-nowrap">
                  <span className="font-bold uppercase tracking-wide text-slate-600">{p.label}:</span> {p.value}
                </span>
              ))}
            </div>
          )}
        </div>
        {info.hasVerifiedScale && info.steps.length > 0 ? (
          <div className="flex min-w-[220px] flex-1 items-center gap-2">
            <span className="hidden lg:inline text-[10px] font-bold uppercase tracking-wide text-slate-500">{info.legendLabel}</span>
            <div className="flex h-4 flex-1 overflow-hidden rounded-full border border-slate-700 bg-slate-900">
              {info.steps.map((s, i) => (
                <div
                  key={`${s.label}-${i}`}
                  className="flex-1"
                  style={{ background: s.color }}
                  title={`${s.value}${s.meaning ? ` — ${s.meaning}` : ''}`}
                  onMouseEnter={() => setHovered(s)}
                  onMouseLeave={() => setHovered(null)}
                />
              ))}
            </div>
            <div className="min-w-[180px] text-[10px] text-slate-300">
              {hovered ? (
                <span>
                  <span className="font-black text-white">{hovered.value}</span>{' '}
                  <span className="text-slate-400">— {hovered.meaning}</span>
                </span>
              ) : (
                <span className="text-slate-500">Hover spectrum for value</span>
              )}
            </div>
          </div>
        ) : (
          <div className="flex min-w-[220px] flex-1 items-center gap-2" aria-label={NO_VERIFIED_SCALE_LABEL}>
            <span className="hidden lg:inline text-[10px] font-bold uppercase tracking-wide text-slate-500">{NO_VERIFIED_SCALE_LABEL}</span>
            <div className="h-4 flex-1 rounded-full border border-slate-700 bg-slate-900/60" />
            <div className="min-w-[180px] text-[10px] text-slate-500">{NO_VERIFIED_SCALE_LABEL}</div>
          </div>
        )}
      </div>
    </div>
  );
}
