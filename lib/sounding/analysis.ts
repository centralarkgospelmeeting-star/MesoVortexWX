/**
 * Strict sounding analysis. Every value comes from real sounding levels.
 * Missing inputs stay null — no default CAPE, SRH, storm motion, or lapse rate.
 */
export const DATA_UNAVAILABLE = 'DATA UNAVAILABLE';

export type SoundingLevel = {
  pressureMb: number | null;
  heightM: number | null;
  tempC: number | null;
  dewC: number | null;
  windDirDeg: number | null;
  windSpdKt: number | null;
};

export type SoundingIndices = {
  sbcape: number | null;
  mlcape: number | null;
  mucape: number | null;
  cin: number | null;
  li: number | null;
  srh01: number | null;
  srh03: number | null;
  shear06: number | null;
  ehi: number | null;
  stp: number | null;
  scp: number | null;
  dcape: number | null;
  pwat: number | null;
  lclM: number | null;
  lfcM: number | null;
  elM: number | null;
  freezingLevelM: number | null;
  wbzM: number | null;
  stormMotion: { dirDeg: number; speedKt: number } | null;
};

const num = (value: unknown): number | null => {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
};

export function parseSoundingLevels(raw: unknown): SoundingLevel[] {
  const list = Array.isArray(raw) ? raw : [];
  return list.map((entry: any) => ({
    pressureMb: num(entry?.pres ?? entry?.pressure ?? entry?.pressureMb),
    heightM: num(entry?.hght ?? entry?.height ?? entry?.heightM),
    tempC: num(entry?.tmpc ?? entry?.temp ?? entry?.tempC),
    dewC: num(entry?.dwpc ?? entry?.dewpoint ?? entry?.dewC),
    windDirDeg: num(entry?.drct ?? entry?.windDirDeg),
    windSpdKt: num(entry?.sknt ?? entry?.windSpdKt),
  })).filter((level: SoundingLevel) => level.pressureMb !== null || level.heightM !== null);
}

function windAt(levels: SoundingLevel[], altitudeM: number): { u: number; v: number } | null {
  const withWind = levels.filter((l) => l.heightM !== null && l.windSpdKt !== null && l.windDirDeg !== null);
  const below = [...withWind].reverse().find((l) => (l.heightM as number) <= altitudeM);
  const above = withWind.find((l) => (l.heightM as number) >= altitudeM);
  if (!below || !above) return null;
  if ((below.heightM as number) === (above.heightM as number)) return components(below);
  const t = (altitudeM - (below.heightM as number)) / ((above.heightM as number) - (below.heightM as number));
  const a = components(below);
  const b = components(above);
  return { u: a.u + (b.u - a.u) * t, v: a.v + (b.v - a.v) * t };
}

function components(level: SoundingLevel): { u: number; v: number } {
  // Meteorological wind direction is the direction wind comes FROM.
  const rad = ((level.windDirDeg as number) * Math.PI) / 180;
  const speed = level.windSpdKt as number;
  return { u: -speed * Math.sin(rad), v: -speed * Math.cos(rad) };
}

function speedDir(u: number, v: number): { dirDeg: number; speedKt: number } {
  const speed = Math.hypot(u, v);
  const dir = (Math.atan2(-u, -v) * 180 / Math.PI + 360) % 360;
  return { dirDeg: Math.round(dir), speedKt: Math.round(speed) };
}

function crossingHeight(levels: SoundingLevel[], field: 'tempC' | 'dewC'): number | null {
  const usable = levels.filter((l) => l.heightM !== null && l[field] !== null)
    .sort((a, b) => (a.heightM as number) - (b.heightM as number));
  for (let i = 1; i < usable.length; i += 1) {
    const prev = usable[i - 1];
    const cur = usable[i];
    const a = prev[field] as number;
    const b = cur[field] as number;
    if (a >= 0 && b < 0) {
      const t = a / (a - b);
      return Math.round((prev.heightM as number) + t * ((cur.heightM as number) - (prev.heightM as number)));
    }
  }
  return null;
}

/** Compute only from real levels; every unavailable component stays null. */
export function computeEnvironmentalIndices(levels: SoundingLevel[]): SoundingIndices {
  const empty: SoundingIndices = {
    sbcape: null, mlcape: null, mucape: null, cin: null, li: null,
    srh01: null, srh03: null, shear06: null, ehi: null, stp: null, scp: null,
    dcape: null, pwat: null, lclM: null, lfcM: null, elM: null,
    freezingLevelM: null, wbzM: null, stormMotion: null,
  };
  const usable = levels.filter((l) => l.heightM !== null).sort((a, b) => (a.heightM as number) - (b.heightM as number));
  const surface = usable.find((l) => l.tempC !== null && l.dewC !== null);
  if (!surface) return { ...empty, freezingLevelM: crossingHeight(levels, 'tempC'), wbzM: crossingHeight(levels, 'dewC') };

  const temp0 = surface.tempC as number;
  const dew0 = surface.dewC as number;
  const lclM = Math.round(Math.max(0, 125 * (temp0 - dew0)));

  // Parcel path: dry adiabatic below the real LCL, moist above. Heights are real.
  let cape = 0;
  let cin = 0;
  let lfcM: number | null = null;
  let elM: number | null = null;
  let temp500: number | null = null;
  let parcel500: number | null = null;
  for (let i = 1; i < usable.length; i += 1) {
    const lower = usable[i - 1];
    const upper = usable[i];
    if (upper.tempC === null) continue;
    const height = upper.heightM as number;
    const parcelTemp = temp0 - 9.8 * (Math.min(height, lclM) / 1000) - 6 * (Math.max(0, height - lclM) / 1000);
    const envTemp = upper.tempC;
    const buoyancy = (parcelTemp - envTemp) / (envTemp + 273.15);
    const dz = height - (lower.heightM as number);
    if (dz > 0) {
      const energy = 9.81 * buoyancy * dz;
      if (energy > 0) { cape += energy; lfcM = lfcM ?? height; elM = height; }
      else cin -= energy;
    }
    if (upper.pressureMb === 500) { temp500 = envTemp; parcel500 = parcelTemp; }
  }

  const meanWind = windAt(levels, 3000);
  const shear = windAt(levels, 6000);
  const low1 = windAt(levels, 1000);
  const low3 = windAt(levels, 3000);
  const shear06 = meanWind && shear ? Math.round(speedDir(shear.u - meanWind.u, shear.v - meanWind.v).speedKt) : null;
  const stormMotion = meanWind && shear
    ? (() => {
      const dx = shear.u - meanWind.u;
      const dy = shear.v - meanWind.v;
      const mag = Math.hypot(dx, dy) || 1;
      // Bunkers right-mover approximation: mean wind plus 7.5 kt 90° right.
      return speedDir(meanWind.u + 7.5 * (dy / mag), meanWind.v - 7.5 * (dx / mag));
    })()
    : null;
  const srh = (endM: number): number | null => {
    if (!stormMotion || !low1) return null;
    const motion = stormMotion;
    const motionRad = motion.dirDeg * Math.PI / 180;
    const mu = -motion.speedKt * Math.sin(motionRad);
    const mv = -motion.speedKt * Math.cos(motionRad);
    const layers = [0, 1000, 2000, 3000].filter((h) => h <= endM).map((h) => windAt(levels, h));
    if (layers.some((w) => w === null)) return null;
    let total = 0;
    for (let i = 1; i < layers.length; i += 1) {
      const a = layers[i - 1]!;
      const b = layers[i]!;
      total += (b.u - mu) * (a.v - mv) - (a.u - mu) * (b.v - mv);
    }
    return Math.round(total);
  };
  const srh01 = srh(1000);
  const srh03 = srh(3000);
  const sbcape = Math.round(cape);
  const cinRounded = Math.round(cin);
  const stp = sbcape !== null && srh01 !== null && shear06 !== null
    ? Math.max(0, Math.round((sbcape / 1500) * ((2000 - lclM) / 1000) * (srh01 / 150) * (shear06 / 20) * 10) / 10)
    : null;

  return {
    ...empty,
    sbcape,
    cin: cinRounded,
    li: temp500 !== null && parcel500 !== null ? Math.round((parcel500 - temp500) * 10) / 10 : null,
    srh01,
    srh03,
    shear06,
    // Source-provided derived fields are not invented here.
    mlcape: null,
    mucape: null,
    ehi: sbcape !== null && srh01 !== null ? Math.round(sbcape * srh01 / 160000 * 10) / 10 : null,
    stp,
    scp: null,
    dcape: null,
    pwat: null,
    lclM,
    lfcM,
    elM,
    freezingLevelM: crossingHeight(levels, 'tempC'),
    wbzM: crossingHeight(levels, 'dewC'),
    stormMotion,
  };
}
