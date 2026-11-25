import { NextResponse } from 'next/server';
import { saveOutcome } from '@/lib/mesoai/feedback-store';
import type { AnalysisMode, OutcomeLabel } from '@/lib/mesoai/types';
import { stableHash } from '@/lib/mesoai/util';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const OUTCOMES: OutcomeLabel[] = ['severe_verified', 'severe_not_verified', 'no_observation', 'unknown'];
const MODES: AnalysisMode[] = ['storm', 'product', 'warning', 'model'];

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Request must contain valid JSON.' }, { status: 400 });
  }

  const outcome = body.outcome as OutcomeLabel;
  const mode = body.mode as AnalysisMode;
  if (!OUTCOMES.includes(outcome) || !MODES.includes(mode)) {
    return NextResponse.json({ error: 'Invalid outcome label or analysis mode.' }, { status: 400 });
  }

  const record = {
    id: '',
    analysisId: String(body.analysisId || '').slice(0, 120),
    mode,
    outcome,
    note: String(body.note || '').slice(0, 800),
    createdAt: new Date().toISOString(),
  };
  record.id = stableHash(record);

  try {
    await saveOutcome(record);
  } catch {
    return NextResponse.json({ error: 'Outcome could not be stored locally.' }, { status: 503 });
  }

  return NextResponse.json({ ok: true, id: record.id }, { headers: { 'Cache-Control': 'no-store' } });
}
