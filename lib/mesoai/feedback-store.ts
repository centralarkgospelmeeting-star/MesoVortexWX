/**
 * Append-only local learning store.
 *
 * Saves analyses, outcomes, and feedback for later human review. This module
 * never edits code, prompts, thresholds, weights, or model files in the
 * running application.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { AnalysisResult, FeedbackRecord, OutcomeRecord } from './types';

const STORE_DIR = path.join(process.cwd(), 'data', 'mesoai');

async function appendLine(file: string, record: unknown): Promise<void> {
  await fs.mkdir(STORE_DIR, { recursive: true });
  await fs.appendFile(path.join(STORE_DIR, file), `${JSON.stringify(record)}\n`, 'utf8');
}

export async function saveAnalysis(result: AnalysisResult): Promise<void> {
  await appendLine('analyses.jsonl', { ...result, savedAt: new Date().toISOString() });
}

export async function saveFeedback(record: FeedbackRecord): Promise<void> {
  await appendLine('feedback.jsonl', record);
}

export async function saveOutcome(record: OutcomeRecord): Promise<void> {
  await appendLine('outcomes.jsonl', record);
}
