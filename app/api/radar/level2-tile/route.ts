import zlib from 'node:zlib';
import { fetchLevel2Frame, level2RgbaTile, type PolarMoment } from '../../../../lib/radar/level2-polar';
import { RADAR_SITES } from '../../../../lib/radar-config';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let bit = 0; bit < 8; bit++) crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const name = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4); checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}

function encodePng(size: number, rgba: Uint8Array): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4);
  header[8] = 8; header[9] = 6;
  const scanlines = Buffer.alloc(size * (1 + size * 4));
  for (let row = 0; row < size; row++) {
    const outputOffset = row * (1 + size * 4);
    Buffer.from(rgba.buffer, rgba.byteOffset + row * size * 4, size * 4).copy(scanlines, outputOffset + 1);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', zlib.deflateSync(scanlines, { level: 3 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function problem(message: string, status = 404) {
  return Response.json({ data: null, available: false, error: message, reason: message }, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-MesoVortex-Data': 'unavailable' },
  });
}

function integerParam(value: string | null): number | undefined {
  if (!value || !/^\d+$/.test(value)) return undefined;
  const result = Number(value);
  return Number.isSafeInteger(result) ? result : undefined;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const siteId = (params.get('site') || '').toUpperCase();
  const requestedProduct = (params.get('product') || '').toLowerCase();
  const product = (requestedProduct === 'gate_to_gate_shear' ? 'gate' : requestedProduct) as PolarMoment;
  const tilt = Number(params.get('tilt') || '0.5');
  const z = integerParam(params.get('z'));
  const x = integerParam(params.get('x'));
  const y = integerParam(params.get('y'));
  const site = RADAR_SITES.find((item) => item.network === 'NEXRAD' && (item.id === siteId || item.radarId === siteId || item.radarId === siteId.replace(/^K/, '')));

  if (!site) return problem(`Unknown NEXRAD radar site "${siteId}".`);
  if (!['cc', 'min_cc', 'zdr', 'kdp', 'sw', 'gate'].includes(product)) return problem(`Unsupported Level II radar moment "${product}".`);
  if (!Number.isFinite(tilt) || tilt < 0 || tilt > 20) return problem('Invalid elevation angle.');
  if (z === undefined || x === undefined || y === undefined || z > 16 || x >= 2 ** z || y >= 2 ** z) {
    return problem('Invalid XYZ tile coordinates.');
  }

  try {
    const frame = await fetchLevel2Frame(site.id);
    const png = encodePng(256, level2RgbaTile(frame, product, tilt, z, x, y));
    return new Response(png, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=30, stale-while-revalidate=30',
        'X-MesoVortex-Source': 'NOAA-NEXRAD-Level-II',
        'X-MesoVortex-Product': product.toUpperCase(),
        'X-MesoVortex-Site': site.id,
        'X-MesoVortex-Time': frame.time,
        'X-MesoVortex-Tilt': String(tilt),
        'X-MesoVortex-KDP-Method': product === 'kdp' ? '7-gate-linear-fit-of-unwrapped-PHI/2; RHO>=0.80' : 'not-applicable',
        'X-MesoVortex-GATE-Method': product === 'gate' ? 'absolute adjacent-range-gate velocity difference, m/s converted to knots' : 'not-applicable',
        'X-MesoVortex-MCC-Method': product === 'min_cc' ? 'minimum valid RHOHV across available elevation cuts; 4/3-earth beam-range correction; app-derived' : 'not-applicable',
      },
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown tile error';
    return problem(`Level II ${product.toUpperCase()} tile unavailable for ${site.id}: ${detail}`, 502);
  }
}
