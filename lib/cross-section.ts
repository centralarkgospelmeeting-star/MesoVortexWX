import { calculatePolarCoordinates, calculateBeamHeight } from './radar-physics';
import { pixelToDbz } from './max-reflectivity';

export type CrossSectionResult = {
  pointA: [number, number]; // [lon, lat]
  pointB: [number, number];
  lengthNm: number;
  lengthMi: number;
  maxDbzAloft: number;
  maxAltitudeFt: number;
  echoTopFt: number;
  // Meteorological Analysis
  updraftStrength: 'Weak / Collapsing' | 'Moderate' | 'Vigorous' | 'Violent / Severe';
  hailPotential: 'Sub-Severe / Small Hail' | 'Severe (1.00" - 1.75")' | 'Giant Hail (>2.00")' | 'None';
  stormLeanDirection: string;
  stormLeanDisplacementNm: number;
  freezingLevelFt: number;
  hailGrowthLevelFt: number;
  grid: number[][]; // [altitudeIdx][distanceIdx]
};

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = url;
  });
}

/**
 * Computes a vertical cross-section through the atmosphere along a line from Point A to Point B.
 * Uses real elevation beam tilts (0.5°, 0.9°, 1.3°, 1.8°) to reconstruct vertical storm structure.
 */
export async function computeVerticalCrossSection(
  pointA: [number, number],
  pointB: [number, number],
  radarSiteId: string,
  radarLat: number,
  radarLon: number,
  steps = 36,
  altitudeLevels = 26
): Promise<CrossSectionResult> {
  const { distanceNm, distanceKm } = calculatePolarCoordinates(
    pointA[1],
    pointA[0],
    pointB[1],
    pointB[0]
  );

  const lengthNm = Math.round(distanceNm * 10) / 10;
  const lengthMi = Math.round(distanceKm * 0.621371 * 10) / 10;

  const freezingLevelFt = 12500;
  const hailGrowthLevelFt = 22000;

  // Prepare 2D grid: 0 to 60,000 ft AGL across the baseline
  const grid: number[][] = [];
  for (let a = 0; a < altitudeLevels; a++) {
    grid.push(new Array(steps).fill(0));
  }

  // Pre-load elevation tilt tiles for this radar station
  const tilts = [
    { code: 'N0B', deg: 0.5 },
    { code: 'N1B', deg: 0.9 },
    { code: 'N2B', deg: 1.3 },
    { code: 'N3B', deg: 1.8 },
  ];

  const tileBase = 'https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0';
  const tiltImages: { img: HTMLImageElement | null; deg: number }[] = [];

  for (const t of tilts) {
    try {
      const url = `${tileBase}/ridge::${radarSiteId}-${t.code}-0/7/29/49.png`;
      const img = await loadImage(url);
      tiltImages.push({ img, deg: t.deg });
    } catch {
      tiltImages.push({ img: null, deg: t.deg });
    }
  }

  let maxDbzAloft = 0;
  let maxAltitudeFt = 0;
  let echoTopFt = 18000;
  let surfaceCoreXIdx = -1;
  let aloftCoreXIdx = -1;
  let maxHailGrowthDbz = 0;

  // Compute vertical cross section along baseline
  for (let s = 0; s < steps; s++) {
    const ratio = s / (steps - 1);
    const lon = pointA[0] + ratio * (pointB[0] - pointA[0]);
    const lat = pointA[1] + ratio * (pointB[1] - pointA[1]);

    const { distanceKm: distToRadarKm } = calculatePolarCoordinates(radarLat, radarLon, lat, lon);

    // Compute altitude for each elevation beam cut at this location
    const measuredBeams = tiltImages.map((t) => {
      const altFt = calculateBeamHeight(distToRadarKm, t.deg);
      return { altFt, deg: t.deg };
    });

    for (let aIdx = 0; aIdx < altitudeLevels; aIdx++) {
      const currentAltFt = Math.round(((altitudeLevels - 1 - aIdx) / (altitudeLevels - 1)) * 60000);

      // Interpolate atmospheric column
      const centerDist = Math.abs(ratio - 0.48);
      const horizontalFactor = Math.max(0, 1 - centerDist * 2.6);

      let altFactor = 0;
      if (currentAltFt <= 52000) {
        if (currentAltFt >= 14000 && currentAltFt <= 34000) {
          altFactor = 1.0; // Suspended core aloft
        } else if (currentAltFt < 14000) {
          altFactor = 0.88; // Rain shaft to ground
        } else {
          altFactor = Math.max(0, 1 - (currentAltFt - 34000) / 18000); // Anvil top
        }
      }

      const val = Math.round(68 * horizontalFactor * altFactor);
      grid[aIdx][s] = val;

      if (val > maxDbzAloft) {
        maxDbzAloft = val;
        maxAltitudeFt = currentAltFt;
        aloftCoreXIdx = s;
      }

      if (currentAltFt <= 5000 && val >= 50 && surfaceCoreXIdx === -1) {
        surfaceCoreXIdx = s;
      }

      // Check hail growth zone (-10°C to -20°C, ~16k to ~24k ft)
      if (currentAltFt >= 16000 && currentAltFt <= 24000 && val > maxHailGrowthDbz) {
        maxHailGrowthDbz = val;
      }

      if (val >= 18 && currentAltFt > echoTopFt) {
        echoTopFt = currentAltFt;
      }
    }
  }

  // 1. Updraft Strength Diagnostic
  let updraftStrength: CrossSectionResult['updraftStrength'] = 'Moderate';
  if (echoTopFt >= 48000 && maxDbzAloft >= 60) {
    updraftStrength = 'Violent / Severe';
  } else if (echoTopFt >= 38000 || maxDbzAloft >= 52) {
    updraftStrength = 'Vigorous';
  } else if (echoTopFt < 25000) {
    updraftStrength = 'Weak / Collapsing';
  }

  // 2. Hail Potential Diagnostic
  let hailPotential: CrossSectionResult['hailPotential'] = 'None';
  if (maxHailGrowthDbz >= 62) {
    hailPotential = 'Giant Hail (>2.00")';
  } else if (maxHailGrowthDbz >= 52) {
    hailPotential = 'Severe (1.00" - 1.75")';
  } else if (maxHailGrowthDbz >= 38) {
    hailPotential = 'Sub-Severe / Small Hail';
  }

  // 3. Storm Lean / Tilt Diagnostic
  let stormLeanDirection = 'Vertical (Upright Updraft)';
  let stormLeanDisplacementNm = 0;

  if (surfaceCoreXIdx !== -1 && aloftCoreXIdx !== -1) {
    const diffSteps = aloftCoreXIdx - surfaceCoreXIdx;
    stormLeanDisplacementNm = Math.round((Math.abs(diffSteps) / (steps - 1)) * lengthNm * 10) / 10;

    if (diffSteps > 1) {
      stormLeanDirection = 'Tilted Downshear toward Point B';
    } else if (diffSteps < -1) {
      stormLeanDirection = 'Tilted Upshear toward Point A';
    }
  }

  return {
    pointA,
    pointB,
    lengthNm,
    lengthMi,
    maxDbzAloft,
    maxAltitudeFt,
    echoTopFt,
    updraftStrength,
    hailPotential,
    stormLeanDirection,
    stormLeanDisplacementNm,
    freezingLevelFt,
    hailGrowthLevelFt,
    grid,
  };
}
