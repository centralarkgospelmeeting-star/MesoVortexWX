import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

function known(value: unknown): string {
  return value === undefined || value === null || value === '' ? 'UNAVAILABLE' : String(value);
}

function measured(value: unknown, unit = ''): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 'UNAVAILABLE (no verified value supplied)';
  }
  return unit ? `${value} ${unit}` : String(value);
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'AI Copilot is not configured. Add GEMINI_API_KEY to Vercel environment variables.' },
      { status: 503 }
    );
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request' }, { status: 400 });
  }

  const { site, product, tilt, sounding, alerts } = body ?? {};
  const indices = sounding?.indices ?? {};
  const alertList = Array.isArray(alerts) && alerts.length > 0
    ? alerts.map(known).join(' | ')
    : 'UNAVAILABLE (no alerts supplied)';
  const tiltLine = tilt === undefined || tilt === null || tilt === ''
    ? ' (tilt UNAVAILABLE)'
    : ` at ${tilt}° elevation beam`;

  const prompt = `
You are drafting an internal, UNOFFICIAL mesoscale discussion for human review. You are not issuing an official NWS/SPC product.
Use ONLY the data supplied below. Treat every value marked UNAVAILABLE as unknown: do not infer, estimate, assume, or fabricate it.
Never invent numerical weather values, probabilities, discussion numbers, valid times, locations, storm mode, or threat levels. If a required input is missing, write "UNAVAILABLE - no verified data supplied" for that item.

- RADAR SITE: ${known(site?.id)} (${known(site?.name)}) at Lat: ${known(site?.lat)}, Lon: ${known(site?.lon)}
- PRODUCT & TILT: ${known(product)}${tiltLine}
- THERMODYNAMIC INDICES (supplied values only; no defaults):
  * SBCAPE: ${measured(indices.sbcape, 'J/kg')}
  * 0-1km SRH: ${measured(indices.srh01, 'm²/s²')}
  * 0-6km Bulk Shear: ${measured(indices.shear06, 'kt')}
  * Significant Tornado Parameter (STP): ${measured(indices.stp)}
- ACTIVE WARNINGS / ALERTS: ${alertList}

Format your response as an SPC MCD draft, clearly marked as unofficial:
1. HEADER: UNOFFICIAL MCD DRAFT (no discussion number)
2. CONCERNING: Only sites/locations explicitly supplied; otherwise UNAVAILABLE.
3. VALID TIME: UNAVAILABLE unless a verified time range is supplied; never derive one from the current clock.
4. PROBABILITY OF WATCH ISSUANCE: UNAVAILABLE unless a verified probability is supplied; never guess a percentage.
5. SUMMARY: Only threats supported by supplied data; otherwise UNAVAILABLE.
6. DISCUSSION: Analyze only supplied data. Do not invent kinematics, hodograph curvature, storm mode, radar signatures, or warning decisions.
7. AREAS AFFECTED: Only locations explicitly supplied; otherwise UNAVAILABLE.

Keep your tone professional, concise, and explicit about missing data. Return the result in a JSON object with a single property named "mcd".
`;

  try {
    const aiResponse = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
      method: 'POST',
      headers: {
        'x-goog-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'models/gemini-2.5-flash',
        input: prompt,
        generation_config: { max_output_tokens: 1200 },
        response_mime_type: 'application/json',
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error('Gemini MCD Error:', errText);
      return NextResponse.json({ error: 'AI failed to generate discussion.' }, { status: 502 });
    }

    const data = await aiResponse.json();
    let mcdText = '';

    try {
      const parsed = JSON.parse(data.output_text || data.outputs?.[0]?.text || '{}');
      mcdText = parsed.mcd || JSON.stringify(parsed);
    } catch {
      mcdText = data.output_text || 'Discussion unavailable.';
    }

    return NextResponse.json({ mcd: mcdText });
  } catch (err) {
    console.error('MCD request error:', err);
    return NextResponse.json({ error: 'Could not contact AI Copilot.' }, { status: 502 });
  }
}
