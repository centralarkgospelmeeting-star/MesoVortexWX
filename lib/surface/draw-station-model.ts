/**
 * Workstation-style station model renderer.
 *
 * Draws temperature / dew point / pressure / sky cover / wind barb / station id
 * / present-weather glyphs directly on a canvas overlay. This deliberately does
 * not render generic map dots.
 */

import type { PresentWeatherCode, StationPlot } from './types';

export interface PositionedStationPlot extends StationPlot {
  x: number;
  y: number;
}

const COLORS = {
  fresh: '#e2e8f0',
  stale: '#fbbf24',
  unavailable: '#64748b',
  accent: '#38bdf8',
  halo: '#020617',
};

function qualityColor(plot: StationPlot): string {
  return COLORS[plot.quality];
}

function label(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, align: CanvasTextAlign, color: string) {
  ctx.font = '600 10px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 3;
  ctx.strokeStyle = COLORS.halo;
  ctx.strokeText(value, x, y);
  ctx.fillStyle = color;
  ctx.fillText(value, x, y);
}

function drawSkyCover(ctx: CanvasRenderingContext2D, plot: StationPlot, color: string) {
  const okta = plot.skyCoverOkta;
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, 5.2, 0, Math.PI * 2);
  ctx.fillStyle = '#0b1220';
  ctx.fill();
  if (okta === null) {
    ctx.setLineDash([2, 2]);
    ctx.strokeStyle = COLORS.unavailable;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    label(ctx, '?', 0, 0, 'center', COLORS.unavailable);
    ctx.restore();
    return;
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.3;
  ctx.stroke();
  if (okta > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, 5.2, -Math.PI / 2, -Math.PI / 2 + (okta / 8) * Math.PI * 2);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fillStyle = color === COLORS.stale ? 'rgba(251,191,36,0.75)' : 'rgba(56,189,248,0.72)';
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function drawWindBarb(ctx: CanvasRenderingContext2D, plot: StationPlot, color: string) {
  const speed = plot.windSpeedKt;
  const dir = plot.windDirDeg;
  if (speed === null || dir === null) return;
  const radians = dir === 'VRB' ? 0 : (dir * Math.PI) / 180;
  const len = Math.min(34, 13 + Math.max(0, speed) * 0.34);
  const ex = Math.sin(radians) * len;
  const ey = -Math.cos(radians) * len;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(ex, ey);
  ctx.stroke();
  if (dir !== 'VRB') {
    const ux = ex / len;
    const uy = ey / len;
    let remaining = Math.round(speed);
    let step = 1;
    while (remaining >= 5 && step < 8) {
      const bx = ex - ux * (4 + step * 4);
      const by = ey - uy * (4 + step * 4);
      const long = remaining >= 10;
      const barbLen = long ? 7 : 4;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + uy * barbLen, by - ux * barbLen);
      ctx.stroke();
      remaining -= long ? 10 : 5;
      step += 1;
    }
    if (plot.windGustKt !== null && plot.windGustKt >= speed + 10) {
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex + ux * 8, ey + uy * 8);
      ctx.stroke();
    }
  } else {
    label(ctx, 'VRB', ex + 8, ey, 'left', color);
  }
  ctx.restore();
}

function drawPresentWeather(ctx: CanvasRenderingContext2D, code: PresentWeatherCode, color: string) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.3;
  switch (code) {
    case 'RA':
      for (const dx of [-3, 0, 3]) { ctx.beginPath(); ctx.moveTo(dx - 1, -2); ctx.lineTo(dx + 1, 3); ctx.stroke(); }
      break;
    case 'SN':
      for (const [x, y] of [[-3, -1], [2, -2], [0, 3]]) { ctx.beginPath(); ctx.moveTo(x - 2, y); ctx.lineTo(x + 2, y); ctx.moveTo(x, y - 2); ctx.lineTo(x, y + 2); ctx.stroke(); }
      break;
    case 'FG':
    case 'BR':
      ctx.beginPath(); ctx.moveTo(-4, -1); ctx.lineTo(4, -1); ctx.moveTo(-4, 2); ctx.lineTo(4, 2); ctx.stroke();
      break;
    case 'TS':
      ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(-2, 0); ctx.lineTo(0, 0); ctx.lineTo(-1, 4); ctx.lineTo(3, -1); ctx.lineTo(1, -1); ctx.lineTo(2, -4); ctx.closePath(); ctx.fill();
      break;
    case 'FZRA':
    case 'PL':
    case 'IC':
      ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(4, 3); ctx.lineTo(-4, 3); ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -1); ctx.lineTo(0, 3); ctx.stroke();
      break;
    case 'DZ':
      for (const dx of [-3, 0, 3]) { ctx.beginPath(); ctx.arc(dx, 1, 0.9, 0, Math.PI * 2); ctx.fill(); }
      break;
    case 'HZ':
    case 'FU':
      ctx.setLineDash([2, 2]); ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(4, 0); ctx.stroke();
      break;
    default:
      label(ctx, code, 0, 0, 'center', color);
  }
  ctx.restore();
}

export function drawStationModels(
  ctx: CanvasRenderingContext2D,
  plots: PositionedStationPlot[],
  options: { width: number; height: number; devicePixelRatio?: number } = { width: 0, height: 0 }
) {
  const dpr = options.devicePixelRatio ?? 1;
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, options.width, options.height);
  ctx.lineCap = 'round';

  for (const plot of plots) {
    if (plot.x < -80 || plot.y < -80 || plot.x > options.width + 80 || plot.y > options.height + 80) continue;
    const color = qualityColor(plot);
    ctx.save();
    ctx.translate(Math.round(plot.x), Math.round(plot.y));

    if (plot.quality === 'stale') {
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.setLineDash([2, 2]);
      ctx.strokeStyle = COLORS.stale;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.setLineDash([]);
    }

    drawWindBarb(ctx, plot, color);
    drawSkyCover(ctx, plot, color);

    label(ctx, plot.tempC === null ? '—' : String(Math.round(plot.tempC)), -9, -9, 'right', color);
    label(ctx, plot.dewpointC === null ? '—' : String(Math.round(plot.dewpointC)), -9, 9, 'right', color);
    label(ctx, plot.pressure.display ?? '—', 9, -9, 'left', plot.pressure.display ? COLORS.accent : COLORS.unavailable);
    label(ctx, plot.stationId, 0, 19, 'center', color);
    if (plot.visibilitySm !== null) label(ctx, `${plot.visibilitySm}sm`, 9, 9, 'left', COLORS.unavailable);

    const weather = plot.presentWeather[0];
    if (weather) {
      ctx.save();
      ctx.translate(-19, 1);
      drawPresentWeather(ctx, weather, color);
      ctx.restore();
      if (plot.presentWeather.length > 1) label(ctx, `+${plot.presentWeather.length - 1}`, -19, 11, 'center', color);
    }
    ctx.restore();
  }
  ctx.restore();
}

/** Nearest station within a compact workstation pick radius. */
export function hitTestStationModels(plots: PositionedStationPlot[], x: number, y: number, radius = 24): PositionedStationPlot | null {
  let best: PositionedStationPlot | null = null;
  let bestDistance = radius * radius;
  for (const plot of plots) {
    const dx = plot.x - x;
    const dy = plot.y - y;
    const distance = dx * dx + dy * dy;
    if (distance <= bestDistance) {
      best = plot;
      bestDistance = distance;
    }
  }
  return best;
}
