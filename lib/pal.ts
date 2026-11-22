export type PalColor = { value: number; r: number; g: number; b: number; a?: number };
export type PalTable = { name: string; colors: PalColor[] };

export function parsePal(text: string, name = 'Imported PAL'): PalTable {
  const colors: PalColor[] = [];
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith(';') || line.startsWith('#') || line.startsWith('//')) continue;
    // Common formats: "value r g b [a]" or "r g b value"
    const parts = line.split(/[\s,]+/).filter(Boolean).map(Number);
    if (parts.some((n) => !Number.isFinite(n))) continue;
    if (parts.length === 4) {
      const [a,b,c,d] = parts;
      // Heuristic: if first looks like dBZ value (-30..120) and others 0..255
      if (a >= -50 && a <= 150 && b>=0&&b<=255&&c>=0&&c<=255&&d>=0&&d<=255) {
        colors.push({ value: a, r: b, g: c, b: d, a: 255 });
      } else if (d >= -50 && d <= 150) {
        colors.push({ value: d, r: a, g: b, b: c, a: 255 });
      }
    } else if (parts.length >= 5) {
      const [value,r,g,b,a] = parts;
      colors.push({ value, r, g, b, a: a ?? 255 });
    }
  }
  colors.sort((a,b)=>a.value-b.value);
  return { name, colors };
}

export function exportPal(table: PalTable): string {
  const header = `; MesoVortexWX .pal export\n; name: ${table.name}\n; format: value r g b a\n`;
  const body = table.colors.map(c => `${c.value} ${c.r} ${c.g} ${c.b} ${c.a ?? 255}`).join('\n');
  return header + body + '\n';
}
