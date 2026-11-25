/** Small deterministic helpers shared by MesoAI modules. */

/** Stable, order-sensitive hash used for analysis IDs and Qwen cache keys. */
export function stableHash(value: unknown): string {
  const text = JSON.stringify(value, (_key, item) => (item === undefined ? null : item)) ?? 'null';
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 16777619);
    h2 = Math.imul(h2 + code, 2246822519);
  }
  return `${(h1 >>> 0).toString(16).padStart(8, '0')}${(h2 >>> 0).toString(16).padStart(8, '0')}`;
}

export function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function isoOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

export function unique(items: Array<string | null | undefined>): string[] {
  return Array.from(new Set(items.filter((item): item is string => Boolean(item))));
}

export function truncate(value: string, max: number): string {
  const clean = value.replace(/\s+/g, ' ').trim();
  return clean.length <= max ? clean : `${clean.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}
