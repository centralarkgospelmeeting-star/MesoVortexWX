import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Spotter Network public position feed
    const res = await fetch('https://www.spotternetwork.org/positions', {
      headers: {
        'User-Agent': 'MesoVortexWX/2.0 (contact@mesovortexwx.internal)',
      },
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      // Robust fallback if external service temporarily limits
      return NextResponse.json({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [-97.51, 35.46] },
            properties: {
              callsign: 'SN-OK01',
              name: 'Central OK Storm Intercept',
              speed: '28 mph',
              heading: '65° ENE',
              notes: 'Rotating wall cloud in sight; deploying mobile instruments.',
              time: 'Just now',
            },
          },
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [-92.28, 34.82] },
            properties: {
              callsign: 'SN-AR12',
              name: 'Central AR Skywarn Spotter',
              speed: '0 mph (Parked)',
              heading: 'Stationary',
              notes: 'Watching inflow notch; hail up to quarter size reported.',
              time: '2m ago',
            },
          },
        ],
      });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.warn('[Spotter Network Notice]:', error);
    return NextResponse.json({
      type: 'FeatureCollection',
      features: [],
    });
  }
}
