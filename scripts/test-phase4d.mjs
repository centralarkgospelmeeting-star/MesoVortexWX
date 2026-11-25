#!/usr/bin/env node
/** Phase 4D workstation workflow contracts. */
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('app/page.tsx', 'utf8');
const panel = fs.readFileSync('components/AlertDetailsPanel.tsx', 'utf8');
const api = fs.readFileSync('app/api/alerts/route.ts', 'utf8');
const model = fs.readFileSync('lib/alerts/model.ts', 'utf8');
const profiles = fs.readFileSync('lib/overlay-profiles.ts', 'utf8');
const basemap = fs.readFileSync('lib/map/basemap-styles.ts', 'utf8');
const radarMap = fs.readFileSync('components/RadarMap.tsx', 'utf8');

// 1-3. Warning workflow, complete product, real Places Affected.
assert.match(panel, /data-alert-panel="true"/, 'draggable warning panel surface');
assert.match(panel, /mesovortex_alert_panel_session_v1/, 'session position persistence');
assert.match(panel, /onHeaderPointerDown/, 'draggable header');
assert.match(panel, /data-resize-handle="true"/, 'resizable panel');
assert.match(panel, /Expand warning panel/, 'collapse/expand support');
assert.match(panel, /Pin warning panel/, 'pin/unpin support');
assert.match(page, /if \(alertPanelPinned\) return;/, 'pinned panel survives map clicks');
for (const field of ['WFO', 'VTEC', 'Issue time', 'Expiration time', 'Remaining time', 'Places affected', 'Hazard', 'Impacts', 'Instructions', 'Full NWS warning text']) {
  assert.ok(panel.includes(field), `warning content must include ${field}`);
}
assert.match(api, /resolveZonePlaces/, 'Places Affected resolves real NWS zones');
assert.match(model, /places: string\[\]/, 'canonical alert carries Places Affected');

// 4-5. HSI already replaced WIS; national/regional/state/local/custom scales.
assert.match(fs.readFileSync('lib/hazard-severity.ts', 'utf8'), /HSI_SCALES/, 'HSI scale registry');
assert.match(page, /HsiPanel/, 'HSI panel mounted');
assert.match(fs.readFileSync('components/hsi/HsiPanel.tsx', 'utf8'), /hsi-radar-backdrop/, 'distinct MesoVortexWX HSI visual system');

// 6. Mode-specific overlay profiles gate global switches.
assert.match(profiles, /export type OverlayMode = 'radar' \| 'satellite' \| 'forecast' \| 'broadcast'/, 'four named workspaces');
assert.match(profiles, /DEFAULT_WORKSPACE_PANELS/, 'workspaces remember panel visibility');
assert.match(profiles, /normalizeWorkspacePanels/, 'workspace panel state is normalized on load');
assert.match(profiles, /DEFAULT_OVERLAY_PROFILES/, 'documented per-mode defaults');
assert.match(page, /const mapWarnings = showWarnings && overlay\.warnings/, 'warnings gated by profile');
assert.match(page, /const mapObservations/, 'observations gated by profile');
assert.match(page, /const mapCounties = showCounties && overlay\.boundaries/, 'boundaries gated by profile');
assert.match(page, /Overlay profiles by mode/, 'settings exposes overlay profiles');

// 7. Unified Observations toggle with advanced controls in settings.
assert.match(page, /surfaceLayers\.observations/, 'master OBSERVATIONS state');
assert.match(page, /Network-specific controls \(advanced\)/, 'advanced network controls');

// 8. Simple map options: Dark, Satellite, Light; advanced config in Settings.
assert.match(radarMap, /'light'/, 'light basemap type available');
assert.match(basemap, /buildLightMapStyle/, 'light basemap style implemented');
assert.match(page, /\['custom-weather', 'Dark'\], \['satellite-streets', 'Satellite'\], \['light', 'Light'\]/, 'simple map option selector');

// 9. Calm UI: no decorative animations in active workflow surfaces.
assert.doesNotMatch(panel, /animate-(pulse|bounce|fade-in)/, 'warning panel must stay calm');
assert.match(fs.readFileSync('app/globals.css', 'utf8'), /@keyframes warning-slide-in/, 'one-time slide-in retained');

// 10. Performance: feed refetch is debounced and profile gating is pure/local.
assert.match(page, /window\.setTimeout\(load, 300\)/, 'surface feed debounces camera movement');

console.log('PASS: Phase 4D workstation workflow contracts');
