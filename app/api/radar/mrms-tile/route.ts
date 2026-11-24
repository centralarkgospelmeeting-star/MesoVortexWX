import { getRadarCapability } from '../../../../lib/radar/capability-matrix';
import { fetchMrmsGrid, type MrmsGrid, type MrmsGridProduct } from '../../../../lib/radar/mrms-grib2';
import zlib from 'node:zlib';

export const dynamic = 'force-dynamic';

// Renders verified MRMS 2D GRIB2 products to 256x256 PNG tiles. Data honesty:
// no synthetic data, no fake archive; only live latest grid. Unknown/missing = transparent.
const TILE = 256;

// Keep PNG encoding compatible with the project's Node 20 types/runtime.
// zlib.crc32 is only available in newer Node releases.
const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < table.length; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = CRC32_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function unavailable(reason: string, cap?: any) {
  return new Response(JSON.stringify({ data: null, available: false, reason, error: reason, playbackSupport: cap?.playbackSupport ?? 'NONE', archiveSupport: cap?.archiveSupport ?? 'UNKNOWN', verificationLevel: cap?.verification?.level ?? 'UNVERIFIED' }), {
    status: 404, headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json' },
  });
}

function tileToLon(x: number, z: number) { return x / Math.pow(2, z) * 360 - 180; }
function tileToLat(y: number, z: number) {
  const n = Math.PI - 2 * Math.PI * y / Math.pow(2, z);
  return 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

function colorFor(product: string, v: number): [number,number,number,number] {
  if (!Number.isFinite(v)) return [0,0,0,0];
  if (product === 'MergedRhoHV') {
    // Correlation Coefficient 0-1.0
    if (v >= 0.99) return [255,255,255,220];
    if (v >= 0.97) return [255,0,255,210];
    if (v >= 0.95) return [160,0,160,210];
    if (v >= 0.90) return [255,0,0,200];
    if (v >= 0.85) return [255,128,0,200];
    if (v >= 0.80) return [255,255,0,190];
    if (v >= 0.70) return [0,200,0,180];
    if (v >= 0.60) return [0,128,255,170];
    if (v >= 0.50) return [0,0,200,160];
    // Below 0.50 is typically no-echo/noise in MRMS CC; keep transparent to avoid a grey film.
    return [0,0,0,0];
  }
  if (product === 'MergedZdr') {
    // Differential Reflectivity -2..6 dB (typical)
    if (v >= 5) return [255,0,255,210];
    if (v >= 4) return [255,0,0,210];
    if (v >= 3) return [255,128,0,200];
    if (v >= 2) return [255,255,0,200];
    if (v >= 1.5) return [0,255,0,190];
    if (v >= 1.0) return [0,200,0,180];
    if (v >= 0.5) return [0,150,150,170];
    if (v >= 0.0) return [0,100,255,160];
    if (v >= -1) return [100,100,255,150];
    return [150,150,150,140];
  }
  if (product === 'MergedAzShear_0-2kmAGL' || product === 'RotationTrack30min') {
    const magnitude = Math.abs(v);
    // NSSL's MRMS table expresses these values in 0.001/s units.
    if (magnitude < 2) return [0,0,0,0];
    if (magnitude < 4) return v < 0 ? [0,150,255,155] : [0,220,80,155];
    if (magnitude < 6) return v < 0 ? [0,90,230,180] : [0,180,0,180];
    if (magnitude < 10) return v < 0 ? [170,0,220,195] : [255,220,0,195];
    return v < 0 ? [220,0,180,210] : [255,70,0,210];
  }
  if (product === 'EchoTop_18') {
    if (v < 2) return [0,0,0,0];
    if (v < 4) return [60,120,255,155];
    if (v < 6) return [0,210,220,170];
    if (v < 8) return [0,210,70,180];
    if (v < 10) return [240,230,0,190];
    if (v < 12) return [255,130,0,200];
    if (v < 15) return [230,20,20,205];
    return [190,0,200,210];
  }
  if (product === 'VIL' || product === 'MultiSensor_QPE_01H_Pass1' || product === 'MESH') {
    if (v <= 0) return [0,0,0,0];
    if (product === 'MESH') {
      if (v < 12.7) return [40,150,255,160];
      if (v < 25.4) return [0,210,90,175];
      if (v < 50.8) return [255,230,0,190];
      if (v < 76.2) return [255,120,0,200];
      return [220,0,20,210];
    }
    if (v < 5) return [40,150,255,150];
    if (v < 15) return [0,210,220,165];
    if (v < 30) return [0,210,70,180];
    if (v < 50) return [245,230,0,190];
    if (v < 75) return [255,125,0,200];
    return [220,0,20,210];
  }
  if (product === 'VIL_Density') {
    if (v < 0.5) return [0,0,0,0];
    if (v < 1.5) return [0,160,255,160];
    if (v < 2.5) return [0,220,80,175];
    if (v < 3.5) return [255,230,0,190];
    if (v < 4.5) return [255,120,0,200];
    return [220,0,20,210];
  }
  if (product === 'SHI') {
    if (v < 10) return [0,0,0,0];
    if (v < 20) return [0,160,255,155];
    if (v < 40) return [0,210,80,175];
    if (v < 80) return [255,230,0,190];
    if (v < 130) return [255,120,0,200];
    return [220,0,20,210];
  }
  if (product === 'PrecipRate') {
    if (v <= 0) return [0,0,0,0];
    if (v < 1) return [50,130,255,150];
    if (v < 2.5) return [0,210,220,165];
    if (v < 5) return [0,210,70,180];
    if (v < 10) return [245,230,0,190];
    if (v < 25) return [255,125,0,200];
    return [220,0,20,210];
  }
  if (product === 'PrecipFlag') {
    if (v === 1) return [230,30,30,200]; // warm stratiform rain
    if (v === 3) return [255,230,0,205]; // snow
    if (v === 6) return [0,210,70,205]; // convective rain
    if (v === 7) return [0,220,230,210]; // rain mixed with hail
    if (v === 10) return [30,90,230,200]; // cold stratiform rain
    if (v === 91) return [150,80,210,200]; // tropical/stratiform rain
    if (v === 96) return [255,120,0,210]; // tropical/convective rain
    return [0,0,0,0]; // no precip or no coverage
  }
  return [0,0,0,0];
}

const MRMS_CAPABILITIES: Record<string, { id: string; grid: MrmsGridProduct }> = {
  cc: { id: 'cc', grid: 'MergedRhoHV' }, rhohv: { id: 'cc', grid: 'MergedRhoHV' },
  zdr: { id: 'zdr', grid: 'MergedZdr' },
  azshear: { id: 'azshear', grid: 'MergedAzShear_0-2kmAGL' }, az: { id: 'azshear', grid: 'MergedAzShear_0-2kmAGL' },
  rotation_tracks: { id: 'rotation_tracks', grid: 'RotationTrack30min' }, trk: { id: 'rotation_tracks', grid: 'RotationTrack30min' },
  tops: { id: 'tops', grid: 'EchoTop_18' }, et: { id: 'tops', grid: 'EchoTop_18' },
  vil: { id: 'vil', grid: 'VIL' }, vild: { id: 'vil_density', grid: 'VIL_Density' }, vil_density: { id: 'vil_density', grid: 'VIL_Density' },
  mesh: { id: 'mesh', grid: 'MESH' }, hail_detection: { id: 'hail_detection', grid: 'SHI' }, hail: { id: 'hail_detection', grid: 'SHI' },
  qpe: { id: 'qpe', grid: 'MultiSensor_QPE_01H_Pass1' }, precip_rate: { id: 'precip_rate', grid: 'PrecipRate' }, rate: { id: 'precip_rate', grid: 'PrecipRate' },
  rain_mix_snow: { id: 'rain_mix_snow', grid: 'PrecipFlag' }, rms: { id: 'rain_mix_snow', grid: 'PrecipFlag' },
};

function sample(grid: MrmsGrid, lat: number, lon: number): number {
  // MRMS 2D latlon grid: la1 north, lo1 west, di/dj deg, row 0 is north
  if (lon < -180) lon += 360;
  let gLon = lon;
  if (grid.lo1 > 180 || grid.lo2 > 180) gLon = lon < 0 ? lon + 360 : lon;
  const col = (gLon - grid.lo1) / grid.di;
  const row = (grid.la1 - lat) / grid.dj;
  const c0 = Math.floor(col), r0 = Math.floor(row);
  if (r0 < 0 || r0 >= grid.nj || c0 < 0 || c0 >= grid.ni) return NaN;
  return grid.values[r0 * grid.ni + c0];
}

function encodePngRgba(w: number, h: number, rgba: Uint8Array): Buffer {
  function chunk(type: string, data: Uint8Array) {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
    const t = Buffer.from(type, 'ascii');
    const crc = Buffer.alloc(4);
    const c = crc32(Buffer.concat([t, Buffer.from(data)]));
    crc.writeUInt32BE(c >>> 0, 0);
    return Buffer.concat([len, t, Buffer.from(data), crc]);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w,0); ihdr.writeUInt32BE(h,4); ihdr[8]=8; ihdr[9]=6; ihdr[10]=0; ihdr[11]=0; ihdr[12]=0;
  const raw = Buffer.alloc(h * (1 + w * 4));
  for (let y=0; y<h; y++) {
    raw[y*(1+w*4)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y*w*4, w*4).copy(raw, y*(1+w*4)+1);
  }
  const idat = zlib.deflateSync(raw, { level: 3 });
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', new Uint8Array())]);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const product = String(searchParams.get('product') || '').toLowerCase();
  const z = Number(searchParams.get('z')); const x = Number(searchParams.get('x')); const y = Number(searchParams.get('y'));
  const mapping = MRMS_CAPABILITIES[product];
  const capId = mapping?.id || '';
  const cap = capId ? getRadarCapability(capId) : null;
  if (!cap) return unavailable(`DATA UNAVAILABLE - Unknown MRMS tile product "${product}".`);
  if (cap.availability === 'UNAVAILABLE' || cap.availability === 'RESTRICTED') return unavailable(cap.unavailableReason || 'DATA UNAVAILABLE', cap);
  if (![z,x,y].every(Number.isFinite)) return unavailable('DATA UNAVAILABLE - Missing tile coordinates.', cap);

  const gridProduct = mapping.grid;
  try {
    const grid = await fetchMrmsGrid(gridProduct);
    const maxAgeMs = gridProduct === 'MultiSensor_QPE_01H_Pass1' ? 3 * 60 * 60_000 : 15 * 60_000;
    const observedAt = Date.parse(grid.time);
    if (!Number.isFinite(observedAt) || Date.now() - observedAt > maxAgeMs) {
      return unavailable(`DATA UNAVAILABLE - NOAA MRMS ${gridProduct} latest grid is stale; refusing to display old data.`, cap);
    }
    const rgba = new Uint8Array(TILE*TILE*4);
    for (let py=0; py<TILE; py++) {
      const lat = tileToLat(y + py/TILE, z);
      for (let px=0; px<TILE; px++) {
        const lon = tileToLon(x + px/TILE, z);
        const v = sample(grid, lat, lon);
        const [r,g,b,a] = colorFor(gridProduct, v);
        const off = (py*TILE+px)*4;
        rgba[off]=r; rgba[off+1]=g; rgba[off+2]=b; rgba[off+3]=a;
      }
    }
    const png = encodePngRgba(TILE,TILE,rgba);
    return new Response(png, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=120, stale-while-revalidate=300',
        'X-MesoVortex-Product': capId,
        'X-MesoVortex-Source': `MRMS-${gridProduct}`,
        'X-MesoVortex-Time': grid.time,
      },
    });
  } catch (e: any) {
    return unavailable(`DATA UNAVAILABLE - MRMS ${gridProduct} tile failed: ${String(e?.message || e)}`, cap);
  }
}
