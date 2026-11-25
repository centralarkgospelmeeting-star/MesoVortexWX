/**
 * Optional Qwen-compatible renderer.
 *
 * Disabled by default. Environment-only configuration; no key is stored in
 * source control. Every response is validated against the structured detections
 * and falls back to the deterministic local renderer when rejected.
 */

import type { AnalysisRequest, AnalysisResult, Detection } from './types';
import { renderLocalAnalysis, validateAnalysisText } from './local-renderer';
import { stableHash, truncate } from './util';

type QwenConfig = { baseUrl: string; model: string; apiKey?: string };

const cache = new Map<string, AnalysisResult>();

export function qwenConfig(): QwenConfig | null {
  if (process.env.MESOAI_ENABLED !== '1') return null;
  const baseUrl = (process.env.MESOAI_BASE_URL || '').trim().replace(/\/+$/, '');
  const model = (process.env.MESOAI_MODEL || 'qwen2.5').trim();
  if (!baseUrl || !model || !/^https?:\/\//i.test(baseUrl)) return null;
  const apiKey = (process.env.MESOAI_API_KEY || '').trim();
  return { baseUrl, model, apiKey: apiKey || undefined };
}

export function isQwenEnabled(): boolean {
  return qwenConfig() !== null;
}

function systemPrompt(request: AnalysisRequest, detections: Detection[]): string {
  return [
    'You are MesoAI, a plain-language explainer inside MesoVortexWX.',
    'You receive structured weather detections only. Explain them; never issue, upgrade, or imply an official warning.',
    'Do not invent a detection, value, source, or location that is absent from the supplied structured input.',
    'Do not claim TVS, debris signatures, tornado ground contact, mesocyclone objects, or projected storm paths.',
    'Keep rotation, couplet, shear, and correlation-coefficient language explicitly provisional when the input marks it LOW or MODERATE.',
    'Cite source labels from the input and preserve every supplied caveat.',
    `Allowed detection IDs: ${detections.map((detection) => detection.id).join(', ') || 'none'}.`,
    `Analysis mode: ${request.mode}. Radar site: ${request.site.name}.`,
    'Return plain text only, at most 900 characters, with no headings or Markdown.',
  ].join('\n');
}

/**
 * Returns a validated Qwen explanation or the deterministic local analysis.
 * Never throws to the caller: model failure always fails closed.
 */
export async function renderAnalysis(
  request: AnalysisRequest,
  detections: Detection[]
): Promise<AnalysisResult> {
  const local = renderLocalAnalysis(request, detections);
  const config = qwenConfig();
  if (!config) return local;

  const cacheKey = stableHash({ renderer: 'qwen', model: config.model, request, detections });
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0,
        max_tokens: 500,
        messages: [
          { role: 'system', content: systemPrompt(request, detections) },
          {
            role: 'user',
            content: JSON.stringify({
              mode: request.mode,
              site: request.site,
              observations: request.observations,
              detections: detections.map((detection) => ({
                id: detection.id,
                kind: detection.kind,
                confidence: detection.confidence,
                values: detection.values,
                caveats: detection.caveats,
              })),
              product: request.product ?? null,
              warning: request.warning ? {
                event: request.warning.event,
                category: request.warning.category,
                headline: request.warning.headline,
                areaDesc: request.warning.areaDesc,
              } : null,
            }),
          },
        ],
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) return local;
    const payload = (await response.json()) as { choices?: Array<{ message?: { content?: unknown } }> };
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') return local;

    const explanation = truncate(content, 900);
    if (!validateAnalysisText(explanation, detections, request.mode)) return local;

    const result: AnalysisResult = {
      ...local,
      id: cacheKey,
      renderer: 'qwen',
      explanation,
    };
    cache.set(cacheKey, result);
    return result;
  } catch {
    return local;
  }
}
