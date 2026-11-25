'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  getProductLegendInfo,
  NO_VERIFIED_SCALE_LABEL,
  type ProductLegendInfo,
  type ProductLegendStep,
} from './UniversalLegend';

/**
 * Compact spectrum banner.
 *
 * The banner intentionally carries no product descriptions, source
 * acknowledgements, provenance rows, or alert marquee. Those details live in
 * the product drawer, hover meaning, or alert surfaces so the map keeps the
 * screen space. The single interactive spectrum is the primary affordance.
 */
type Props = {
  tab: string;
  product: string;
  satelliteLabel?: string;
  satelliteProductId?: string;
  outlookDay?: string;
  modelLabel?: string;
  modelFieldId?: string;
};

const CAPABILITY_ID_ALIASES: Record<string, string> = {
  ref_x: 'ref',
  norm_vel: 'nrot',
};

function normalizedProduct(product: string): string {
  const value = product.trim().toLowerCase();
  return CAPABILITY_ID_ALIASES[value] ?? value;
}

function modelLegendKey(fieldId?: string): string {
  const key = (fieldId || '').toLowerCase();
  if (key.includes('cape')) return 'cape';
  if (key.includes('temp') || key.includes('dewpoint') || key.includes('wetbulb')) return 'temp';
  return '';
}

/**
 * Only the clean longwave IR channel has a verified brightness-temperature
 * palette here. Visible and water-vapor tiles have no independently verified
 * numeric scale, so they stay neutral instead of borrowing the IR spectrum.
 */
function satelliteLegendKey(productId?: string): string {
  const id = (productId || '').trim().toLowerCase();
  return id === 'ir' || id === 'ch13' ? 'satellite' : '';
}

function bannerLegend(props: Props): ProductLegendInfo {
  if (props.tab === 'Satellite') return getProductLegendInfo(satelliteLegendKey(props.satelliteProductId));
  if (props.tab === 'Outlooks') return getProductLegendInfo('spc');
  if (props.tab === 'Models') return getProductLegendInfo(modelLegendKey(props.modelFieldId));
  return getProductLegendInfo(normalizedProduct(props.product));
}

function bannerLabel(props: Props, legend: ProductLegendInfo): string {
  if (legend.title) return legend.title;
  if (props.tab === 'Models') return props.modelLabel || 'Model';
  if (props.tab === 'Satellite') return props.satelliteLabel || 'Satellite';
  if (props.tab === 'Outlooks') return `SPC ${props.outlookDay || 'Day 1'}`;
  return props.product || 'Product';
}

export function ProductInfoBanner(props: Props) {
  const [mounted, setMounted] = useState(false);
  const [hovered, setHovered] = useState<ProductLegendStep | null>(null);
  const legend = useMemo(
    () => mounted ? bannerLegend(props) : getProductLegendInfo(''),
    [mounted, props.tab, props.product, props.satelliteLabel, props.outlookDay, props.modelLabel, props.modelFieldId]
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setHovered(null);
  }, [legend.key]);

  const title = mounted ? bannerLabel(props, legend) : 'PRODUCT';
  const hasScale = legend.hasVerifiedScale && legend.steps.length > 0;

  return (
    <div
      data-spectrum-banner="true"
      data-spectrum-product={legend.key || 'unverified'}
      className="shrink-0 border-b border-slate-800 bg-[#0a111d] px-3 py-1.5 text-slate-100"
    >
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-[10px] font-black uppercase tracking-[0.14em] text-sky-300" title={title}>
          {title}
        </span>
        {hasScale ? (
          <>
            <div
              className="flex h-4 min-w-[6rem] flex-1 overflow-hidden rounded-full border border-slate-700 bg-slate-900"
              aria-label={`${title} ${legend.legendLabel}`}
            >
              {legend.steps.map((step, i) => (
                <button
                  key={`${step.label}-${i}`}
                  type="button"
                  data-spectrum-step="true"
                  data-spectrum-value={step.value}
                  data-spectrum-meaning={step.meaning}
                  className="h-full min-w-[4px] flex-1 transition-opacity hover:opacity-80 focus:opacity-80 focus:outline-none"
                  style={{ backgroundColor: step.color }}
                  title={`${step.value} — ${step.meaning}`}
                  aria-label={`${step.value} — ${step.meaning}`}
                  onMouseEnter={() => setHovered(step)}
                  onMouseLeave={() => setHovered(null)}
                  onFocus={() => setHovered(step)}
                  onBlur={() => setHovered(null)}
                />
              ))}
            </div>
            <div className="min-w-[10rem] max-w-[24rem] flex-1 truncate text-right text-[10px] text-slate-300">
              {hovered ? (
                <span>
                  <span className="font-black text-white">{hovered.value}</span>
                  <span className="text-slate-500"> — {hovered.meaning}</span>
                </span>
              ) : (
                <span className="text-slate-500">{legend.legendLabel} · hover for value</span>
              )}
            </div>
          </>
        ) : (
          <div className="flex min-w-[6rem] flex-1 items-center gap-2" aria-label={NO_VERIFIED_SCALE_LABEL}>
            <div className="h-4 flex-1 rounded-full border border-slate-700 bg-slate-900/60" />
            <span className="shrink-0 text-[10px] text-slate-500">{NO_VERIFIED_SCALE_LABEL}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default ProductInfoBanner;
