import { NextResponse } from 'next/server';
import { normalizeNwsCollection, type WeatherAlert } from '@/lib/alerts/model';
import { buildObservations, productContext } from '@/lib/mesoai/data-engine';
import { runDetections } from '@/lib/mesoai/detection-engine';
import { saveAnalysis } from '@/lib/mesoai/feedback-store';
import { renderAnalysis } from '@/lib/mesoai/qwen-adapter';
import type { AnalysisMode, AnalysisRequest, ModelContext, WarningContext } from '@/lib/mesoai/types';
import { getModelById } from '@/lib/model-registry';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MODES: AnalysisMode[] = ['storm', 'product', 'warning', 'model'];
const COMPARISON_MODELS = ['hrrr', 'rap', 'gfs', 'nam3km'];

function modelContexts(): ModelContext[] {
  return COMPARISON_MODELS.flatMap((id) => {
    const model = getModelById(id);
    if (!model) return [];
    return [{
      id: model.id,
      label: model.name.split('(')[0].trim(),
      provider: model.provider,
      status: model.status,
      fields: model.fields.map((field) => ({
        id: field.id,
        label: field.label,
        unit: field.unit,
        status: field.status,
        value: field.status === 'READY_NOW' ? 'AVAILABLE' : 'UNAVAILABLE',
      })),
    }];
  });
}

function warningFromAlert(alert: WeatherAlert): WarningContext {
  return {
    event: alert.event,
    headline: alert.headline,
    description: alert.description,
    instruction: alert.instruction,
    areaDesc: alert.areaDesc,
    category: alert.category,
    severity: alert.severity,
    sent: alert.sent,
  };
}

async function getJson(url: URL, timeoutMs: number): Promise<unknown> {
  const response = await fetch(url, {
    cache: 'no-store',
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Request must contain valid JSON.' }, { status: 400 });
  }

  const mode = body.mode as AnalysisMode;
  if (!MODES.includes(mode)) {
    return NextResponse.json({ error: 'Unsupported analysis mode.' }, { status: 400 });
  }

  const siteInput = body.site as Record<string, unknown> | undefined;
  const site = siteInput && {
    id: String(siteInput.id || '').slice(0, 40),
    name: String(siteInput.name || '').slice(0, 160),
    lat: Number(siteInput.lat),
    lon: Number(siteInput.lon),
  };
  if (!site?.id || !site.name || !Number.isFinite(site.lat) || !Number.isFinite(site.lon)) {
    return NextResponse.json({ error: 'A valid radar site is required.' }, { status: 400 });
  }

  const productKey = typeof body.productKey === 'string' ? body.productKey.slice(0, 80) : null;
  const needsRadar = mode === 'storm';
  const needsAlerts = mode === 'storm' || mode === 'warning';

  const [stormResult, lightningResult, outlookResult, alertsResult, mrmsResult, metarResult, lsrResult, mcdResult] = await Promise.allSettled([
    needsRadar
      ? getJson(new URL(`/api/radar/storm-analysis?site=${encodeURIComponent(site.id)}`, request.url), 75_000)
      : Promise.resolve(null),
    needsRadar
      ? getJson(new URL('/api/lightning/glm?minutes=5', request.url), 15_000)
      : Promise.resolve(null),
    needsRadar
      ? getJson(new URL('/api/spc/outlooks?day=1', request.url), 15_000)
      : Promise.resolve(null),
    needsAlerts
      ? getJson(new URL('/api/alerts', request.url), 15_000)
      : Promise.resolve(null),
    needsRadar
      ? getJson(new URL('/api/mrms/aws', request.url), 12_000)
      : Promise.resolve(null),
    needsRadar
      ? getJson(new URL('/api/metar', request.url), 15_000)
      : Promise.resolve(null),
    needsRadar
      ? getJson(new URL('/api/lsr', request.url), 12_000)
      : Promise.resolve(null),
    needsRadar
      ? getJson(new URL('/api/spc/mcd', request.url), 12_000)
      : Promise.resolve(null),
  ]);

  const alerts = alertsResult.status === 'fulfilled' && alertsResult.value
    ? normalizeNwsCollection(alertsResult.value)
    : [];

  const suppliedWarning = body.warning as Partial<WarningContext> | undefined;
  const warning = suppliedWarning?.event
    ? {
        event: String(suppliedWarning.event).slice(0, 160),
        headline: String(suppliedWarning.headline || '').slice(0, 600),
        description: String(suppliedWarning.description || '').slice(0, 4000),
        instruction: String(suppliedWarning.instruction || '').slice(0, 2000),
        areaDesc: String(suppliedWarning.areaDesc || '').slice(0, 400),
        category: String(suppliedWarning.category || '').slice(0, 40),
        severity: String(suppliedWarning.severity || '').slice(0, 40),
        sent: typeof suppliedWarning.sent === 'string' ? suppliedWarning.sent : null,
      }
    : mode === 'warning'
      ? (() => {
          const warning = alerts.find((alert) => alert.category === 'warning') || null;
          return warning ? warningFromAlert(warning) : null;
        })()
      : null;

  const observations = buildObservations({
    site,
    stormAnalysis: stormResult.status === 'fulfilled' ? stormResult.value : null,
    lightning: lightningResult.status === 'fulfilled' ? lightningResult.value : null,
    outlook: outlookResult.status === 'fulfilled' ? outlookResult.value : null,
    alerts,
    productKey,
    mrms: mrmsResult.status === 'fulfilled' ? mrmsResult.value : null,
    metar: metarResult.status === 'fulfilled' ? metarResult.value : null,
    lsr: lsrResult.status === 'fulfilled' ? lsrResult.value : null,
    mcd: mcdResult.status === 'fulfilled' ? mcdResult.value : null,
    includeSatelliteContext: needsRadar,
  });
  const detections = runDetections(observations);

  const analysisRequest: AnalysisRequest = {
    mode,
    site,
    generatedAt: new Date().toISOString(),
    product: productContext(productKey),
    warning,
    models: mode === 'model' ? modelContexts() : [],
    observations,
  };

  const result = await renderAnalysis(analysisRequest, detections);
  await saveAnalysis(result).catch(() => {
    // Local learning storage is best-effort and never blocks an explanation.
  });

  return NextResponse.json(
    { result, detections, observations },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
