/**
 * Mode-specific overlay profiles. Each workstation mode chooses which verified
 * layers appear; global toggles in Settings remain the outer gate. No layer is
 * enabled here that the underlying capability matrix marks UNAVAILABLE.
 */
export type OverlayMode = 'radar' | 'satellite' | 'model';

export interface OverlayProfile {
  warnings: boolean;
  spotters: boolean;
  reports: boolean;
  observations: boolean;
  boundaries: boolean;
  forecast: boolean;
  radar: boolean;
  satellite: boolean;
}

export const OVERLAY_MODES: readonly { id: OverlayMode; label: string }[] = [
  { id: 'radar', label: 'Radar' },
  { id: 'satellite', label: 'Satellite' },
  { id: 'model', label: 'Model' },
];

export const OVERLAY_FIELDS: readonly { key: keyof OverlayProfile; label: string }[] = [
  { key: 'warnings', label: 'Warnings' },
  { key: 'spotters', label: 'Spotters' },
  { key: 'reports', label: 'Reports' },
  { key: 'observations', label: 'Observations' },
  { key: 'boundaries', label: 'Boundaries' },
  { key: 'forecast', label: 'Forecast overlays' },
  { key: 'radar', label: 'Radar' },
  { key: 'satellite', label: 'Satellite' },
];

export const DEFAULT_OVERLAY_PROFILES: Record<OverlayMode, OverlayProfile> = {
  radar: { warnings: true, spotters: true, reports: true, observations: true, boundaries: true, forecast: false, radar: true, satellite: false },
  satellite: { warnings: true, spotters: false, reports: false, observations: true, boundaries: true, forecast: false, radar: false, satellite: true },
  model: { warnings: false, spotters: false, reports: false, observations: false, boundaries: true, forecast: true, radar: false, satellite: false },
};

export const OVERLAY_MODE_FIELDS: Record<OverlayMode, Array<keyof OverlayProfile>> = {
  radar: ['warnings', 'spotters', 'reports', 'observations', 'boundaries', 'radar'],
  satellite: ['warnings', 'observations', 'boundaries', 'satellite'],
  model: ['boundaries', 'forecast'],
};

export function normalizeOverlayProfiles(value: unknown): Record<OverlayMode, OverlayProfile> {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const result = {} as Record<OverlayMode, OverlayProfile>;
  for (const mode of OVERLAY_MODES) {
    const saved = source[mode.id] && typeof source[mode.id] === 'object' ? source[mode.id] as Partial<OverlayProfile> : {};
    result[mode.id] = { ...DEFAULT_OVERLAY_PROFILES[mode.id] };
    for (const field of OVERLAY_FIELDS) {
      if (typeof saved[field.key] === 'boolean') result[mode.id][field.key] = saved[field.key] as boolean;
    }
  }
  return result;
}
