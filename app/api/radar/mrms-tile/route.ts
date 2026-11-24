import { getRadarCapability } from '../../../../lib/radar/capability-matrix';
import { fetchMrmsGrid, type MrmsGrid } from '../../../../lib/radar/mrms-grib2';
import zlib from 'node:zlib';

export const dynamic = 'force-dynamic';

// Renders verified MRMS 2D GRIB2 products to 256x256 PNG tiles. Data honesty:
// no synthetic data, no fake archive; only live latest grid. Unknown/missing = transparent.
const TILE = 256;

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
  return [0,0,0,0];
}

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
    const c = zlib.crc32(Buffer.concat([t, Buffer.from(data)]));
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
  const capId = product === 'cc' || product === 'rhohv' ? 'cc' : product === 'zdr' ? 'zdr' : '';
  const cap = capId ? getRadarCapability(capId) : null;
  if (!cap) return unavailable(`DATA UNAVAILABLE - Unknown MRMS tile product "${product}".`);
  if (cap.availability === 'UNAVAILABLE' || cap.availability === 'RESTRICTED') return unavailable(cap.unavailableReason || 'DATA UNAVAILABLE', cap);
  if (![z,x,y].every(Number.isFinite)) return unavailable('DATA UNAVAILABLE - Missing tile coordinates.', cap);

  const gridProduct = capId === 'cc' ? 'MergedRhoHV' : 'MergedZdr';
  try {
    const grid = await fetchMrmsGrid(gridProduct as any);
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
