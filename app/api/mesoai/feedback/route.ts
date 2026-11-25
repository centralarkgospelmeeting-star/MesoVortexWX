import { NextResponse } from 'next/server';
import { saveFeedback } from '@/lib/mesoai/feedback-store';
import type { AnalysisMode, FeedbackRating } from '@/lib/mesoai/types';
import { stableHash } from '@/lib/mesoai/util';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const RATINGS: FeedbackRating[] = ['helpful', 'not_helpful', 'inaccurate'];
const MODES: AnalysisMode[] = ['storm', 'product', 'warning', 'model'];

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Request must contain valid JSON.' }, { status: 400 });
  }

  const rating = body.rating as FeedbackRating;
  const mode = body.mode as AnalysisMode;
  if (!RATINGS.includes(rating) || !MODES.includes(mode)) {
    return NextResponse.json({ error: 'Invalid feedback rating or analysis mode.' }, { status: 400 });
  }

  const record = {
    id: '',
    analysisId: String(body.analysisId || '').slice(0, 120),
    mode,
    rating,
    note: String(body.note || '').slice(0, 800),
    createdAt: new Date().toISOString(),
  };
  record.id = stableHash(record);

  try {
    await saveFeedback(record);
  } catch {
    return NextResponse.json({ error: 'Feedback could not be stored locally.' }, { status: 503 });
  }

  return NextResponse.json({ ok: true, id: record.id }, { headers: { 'Cache-Control': 'no-store' } });
}
