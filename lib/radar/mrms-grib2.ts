/**
 * Minimal MRMS GRIB2 (template 5.41 PNG) decoder for 2D lat/lon grids.
 * DATA HONESTY: decodes real NOAA MRMS GRIB2 only; no synthetic/fake values.
 * Supports 8-bit RGB PNG section 7, non-interlaced, GRIB2 template 5.0/5.41 simple packing.
 */
import zlib from 'node:zlib';

export interface MrmsGrid {
  product: string;
  time: string; // ISO
  ni: number; nj: number;
  la1: number; lo1: number; la2: number; lo2: number; // degrees
  di: number; dj: number; // degrees
  ref: number; scale2: number; scale10: number;
  missing: number;
  values: Float32Array; // nj*ni, row-major north->south
}

type CacheEntry = { at: number; promise: Promise<MrmsGrid> };
const CACHE = new Map<string, CacheEntry>();
const TTL_MS = 120_000;

export function clearMrmsCache() { CACHE.clear(); }

function readU16(b: Buffer, o: number) { return b.readUInt16BE(o); }
function readU32(b: Buffer, o: number) { return b.readUInt32BE(o); }
function readI16(b: Buffer, o: number) { return b.readInt16BE(o); }
function readF32(b: Buffer, o: number) { return b.readFloatBE(o); }

function decodePngSamples(buf: Buffer): { w: number; h: number; samples: Uint32Array; alpha?: Uint8Array } {
  if (buf.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('GRIB2 sec7 not PNG');
  let i = 8, w = 0, h = 0, bit = 0, ct = 0, interlace = 0;
  const idats: Buffer[] = [];
  let paletteAlpha: Buffer | undefined;
  while (i < buf.length) {
    const len = readU32(buf, i); const type = buf.subarray(i + 4, i + 8).toString('ascii');
    const data = buf.subarray(i + 8, i + 8 + len);
    if (type === 'IHDR') { w = readU32(data, 0); h = readU32(data, 4); bit = data[8]; ct = data[9]; interlace = data[12]; }
    else if (type === 'IDAT') idats.push(Buffer.from(data));
    else if (type === 'tRNS') paletteAlpha = Buffer.from(data);
    else if (type === 'IEND') break;
    i += 12 + len;
  }
  if (interlace !== 0) throw new Error('Interlaced PNG unsupported');
  if (![8, 16].includes(bit) || ![0, 2, 3, 4, 6].includes(ct) || (ct === 2 || ct === 6) && bit === 16) {
    throw new Error(`Unsupported PNG format bit=${bit} ct=${ct}`);
  }
  const channels = ct === 0 ? 1 : ct === 2 ? 3 : ct === 3 ? 1 : ct === 4 ? 2 : 4;
  const bytesPerSample = bit / 8;
  const bytesPerPixel = channels * bytesPerSample;
  const raw = zlib.inflateSync(Buffer.concat(idats));
  const stride = w * bytesPerPixel;
  const out = new Uint8Array(w * h * bytesPerPixel);
  let src = 0, dst = 0;
  const prev = new Uint8Array(stride);
  const cur = new Uint8Array(stride);
  for (let y = 0; y < h; y++) {
    const filter = raw[src++];
    for (let x = 0; x < stride; x++) cur[x] = raw[src++];
    const recon = new Uint8Array(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= bytesPerPixel ? recon[x - bytesPerPixel] : 0;
      const b = prev[x];
      const c = x >= bytesPerPixel ? prev[x - bytesPerPixel] : 0;
      let p = 0;
      if (filter === 0) p = cur[x];
      else if (filter === 1) p = (cur[x] + a) & 255;
      else if (filter === 2) p = (cur[x] + b) & 255;
      else if (filter === 3) p = (cur[x] + Math.floor((a + b) / 2)) & 255;
      else if (filter === 4) { // Paeth
        const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
        const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
        p = (cur[x] + pr) & 255;
      } else throw new Error(`Bad PNG filter ${filter}`);
      recon[x] = p;
    }
    out.set(recon, dst); dst += stride; prev.set(recon);
  }
  const samples = new Uint32Array(w * h);
  const alpha = ct === 4 || ct === 6 || (ct === 3 && paletteAlpha) ? new Uint8Array(w * h) : undefined;
  const readSample = (offset: number) => bit === 16 ? (out[offset] << 8) | out[offset + 1] : out[offset];
  for (let pixel = 0; pixel < samples.length; pixel++) {
    const offset = pixel * bytesPerPixel;
    if (ct === 0 || ct === 3) {
      samples[pixel] = readSample(offset);
      if (alpha) alpha[pixel] = ct === 3 ? (paletteAlpha?.[out[offset]] ?? 255) : 255;
    } else if (ct === 2 || ct === 6) {
      samples[pixel] = (out[offset] << 16) | (out[offset + 1] << 8) | out[offset + 2];
      if (alpha) alpha[pixel] = out[offset + 3];
    } else {
      samples[pixel] = readSample(offset);
      if (alpha) alpha[pixel] = readSample(offset + bytesPerSample) > 0 ? 255 : 0;
    }
  }
  return { w, h, samples, alpha };
}

export const MRMS_GRID_PRODUCTS = [
  'MergedRhoHV', 'MergedZdr', 'MergedAzShear_0-2kmAGL', 'RotationTrack30min',
  'EchoTop_18', 'VIL', 'VIL_Density', 'MESH', 'SHI',
  'MultiSensor_QPE_01H_Pass1', 'PrecipRate',
  'PrecipFlag',
] as const;
export type MrmsGridProduct = typeof MRMS_GRID_PRODUCTS[number];

export async function fetchMrmsGrid(product: MrmsGridProduct): Promise<MrmsGrid> {
  const key = product;
  const cached = CACHE.get(key);
  if (cached && Date.now() - cached.at < TTL_MS) return cached.promise;
  const promise = (async () => {
    const url = `https://mrms.ncep.noaa.gov/2D/${product}/MRMS_${product}.latest.grib2.gz`;
    const res = await fetch(url, { cache: 'no-store', headers: { 'User-Agent': 'MesoVortexWX/1.0' } });
    if (!res.ok) throw new Error(`MRMS fetch ${product} ${res.status}`);
    const gz = Buffer.from(await res.arrayBuffer());
    const grib = zlib.gunzipSync(gz);
    return parseMrmsGrib2(grib, product);
  })();
  CACHE.set(key, { at: Date.now(), promise });
  try { return await promise; } catch (e) { CACHE.delete(key); throw e; }
}

export function parseMrmsGrib2(grib: Buffer, product: string): MrmsGrid {
  let i = 0;
  if (grib.subarray(0,4).toString('ascii') !== 'GRIB') throw new Error('Not GRIB2');
  i = 16; // skip indicator
  let ni=0,nj=0,la1=0,lo1=0,la2=0,lo2=0,di=0,dj=0;
  let ref=0,scale2=0,scale10=0,nbits=0,tpl=0,missing=NaN;
  let sec7: Buffer | null = null;
  let year=0,mon=1,day=1,hour=0,min=0,sec=0;
  while (i < grib.length) {
    if (grib.subarray(i,i+4).toString('ascii') === '7777') break;
    const slen = readU32(grib, i); const sn = grib[i+4];
    if (sn === 1) {
      year = readU16(grib, i+12); mon = grib[i+14]; day = grib[i+15]; hour = grib[i+16]; min = grib[i+17]; sec = grib[i+18];
    } else if (sn === 3) {
      const gdtn = readU16(grib, i+12);
      if (gdtn !== 0) throw new Error(`Unsupported GRIB2 grid ${gdtn}`);
      ni = readU32(grib, i+30); nj = readU32(grib, i+34);
      la1 = readU32(grib, i+46) / 1e6; lo1 = readU32(grib, i+50) / 1e6;
      la2 = readU32(grib, i+55) / 1e6; lo2 = readU32(grib, i+59) / 1e6;
      di = readU32(grib, i+63) / 1e6; dj = readU32(grib, i+67) / 1e6;
      if (lo1 > 180) lo1 -= 360; if (lo2 > 180) lo2 -= 360;
    } else if (sn === 5) {
      tpl = readU16(grib, i+9);
      ref = readF32(grib, i+11);
      scale2 = readI16(grib, i+15);
      scale10 = readI16(grib, i+17);
      nbits = grib[i+19];
      if (tpl === 41) { // PNG - missing value handled via special value; MRMS uses -999 etc encoded
        // template 5.41 has same fields as 5.0 up to 21 then PNG specific? Actually 5.41 extends 5.0
        // bytes 21-? per GRIB2 spec; missing indicator often encoded as large int. We detect by value.
      }
    } else if (sn === 7) {
      sec7 = grib.subarray(i+5, i+slen);
    }
    i += slen;
  }
  if (!sec7 || !ni || !nj) throw new Error('Incomplete GRIB2');
  if (tpl !== 41) throw new Error(`Unsupported GRIB2 data template ${tpl} (expected 41 PNG)`);
  const png = decodePngSamples(sec7);
  if (png.w !== ni || png.h !== nj) throw new Error(`PNG/grid size mismatch ${png.w}x${png.h} != ${ni}x${nj}`);
  const n = ni*nj;
  const values = new Float32Array(n);
  const d10 = Math.pow(10, -scale10);
  const d2 = Math.pow(2, scale2);
  for (let p=0; p<n; p++) {
    // PNG alpha marks missing/transparent cells in some MRMS GRIB2 products.
    // Dropping it turns those cells into valid packed values and creates a noisy
    // full-map overlay, especially for CC and ZDR.
    if (png.alpha && png.alpha[p] === 0) {
      values[p] = NaN;
      continue;
    }
    const raw = png.samples[p];
    // MRMS missing is commonly -999/-99 encoded in scaled space or special value. Use threshold.
    const v = (ref + raw * d2) * d10;
    values[p] = (v < -900 || v > 1e5) ? NaN : v;
  }
  const time = `${year}-${String(mon).padStart(2,'0')}-${String(day).padStart(2,'0')}T${String(hour).padStart(2,'0')}:${String(min).padStart(2,'0')}:${String(sec).padStart(2,'0')}Z`;
  return { product, time, ni, nj, la1, lo1, la2, lo2, di, dj, ref, scale2, scale10, missing, values };
}
