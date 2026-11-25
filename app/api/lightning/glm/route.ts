import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { normalizeGlmResponse } from '../../../../lib/lightning/glm-metrics';

export const dynamic = 'force-dynamic';

const PY = '/tmp/opencode/glm-venv/bin/python';
const SCRIPT = path.join(process.cwd(), 'scripts', 'glm_fetch.py');

function run(minutes: number): Promise<any> {
  return new Promise((resolve) => {
    if (!fs.existsSync(PY) || !fs.existsSync(SCRIPT)) {
      resolve({ available: false, source: 'NOAA GOES-R GLM', reason: 'DATA UNAVAILABLE - GLM parser/runtime not available', features: { type: 'FeatureCollection', features: [] } });
      return;
    }
    const child = spawn(PY, [SCRIPT, String(minutes)], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = ''; let err = '';
    const timer = setTimeout(() => { try { child.kill('SIGKILL'); } catch {} }, 45000);
    child.stdout.on('data', (d) => { out += d.toString(); if (out.length > 5_000_000) { try { child.kill('SIGKILL'); } catch {} } });
    child.stderr.on('data', (d) => { err += d.toString(); });
    child.on('close', () => {
      clearTimeout(timer);
      try {
        const parsed = JSON.parse(out);
        resolve(parsed);
      } catch {
        resolve({ available: false, source: 'NOAA GOES-R GLM', reason: `DATA UNAVAILABLE - GLM parse failed${err ? ': ' + err.slice(0,200) : ''}`, features: { type: 'FeatureCollection', features: [] } });
      }
    });
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const requested = Number(searchParams.get('minutes') ?? 5);
  const minutes = Number.isFinite(requested) ? Math.max(1, Math.min(15, requested)) : 5;
  const data = await run(minutes);
  return NextResponse.json(normalizeGlmResponse(data, minutes), { status: 200, headers: { 'Cache-Control': 'no-store' } });
}
