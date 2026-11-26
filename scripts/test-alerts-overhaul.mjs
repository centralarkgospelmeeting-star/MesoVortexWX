#!/usr/bin/env node
/** Phase 4 Alerts: operational workflow contracts. */
import assert from 'node:assert/strict';
import fs from 'node:fs';

const categories = fs.readFileSync('lib/alerts/categories.ts', 'utf8');
const settings = fs.readFileSync('lib/alerts/settings.ts', 'utf8');
const audio = fs.readFileSync('lib/alerts/audio.ts', 'utf8');
const panel = fs.readFileSync('components/AlertSettingsPanel.tsx', 'utf8');
const page = fs.readFileSync('app/page.tsx', 'utf8');
const map = fs.readFileSync('components/RadarMap.tsx', 'utf8');
const detail = fs.readFileSync('components/AlertDetailsPanel.tsx', 'utf8');
const hook = fs.readFileSync('lib/alerts/use-fast-alerts.ts', 'utf8');

// 2-3. Grouped, customizable categories.
for (const section of ['SEVERE', 'FLOODING / HYDRO', 'WINTER', 'WIND', 'HEAT / COLD', 'FIRE WEATHER', 'TROPICAL', 'MARINE', 'OTHER']) {
  assert.ok(categories.includes(section), `alert categories must include ${section}`);
}
for (const type of ['Tornado Warning', 'Tornado Watch', 'PDS Tornado Warning', 'Tornado Emergency', 'Flash Flood Warning', 'Flash Flood Emergency', 'Severe Thunderstorm Warning']) {
  assert.ok(categories.includes(type) || panel.includes(type), `must define ${type}`);
}
assert.match(settings, /categoryPrefs: Record<string, AlertTypePreference>/, 'per-category preferences');
assert.match(panel, /Show<\/label>| Notify| Voice/, 'per-category visibility/notify/voice controls');
assert.match(panel, /type="color"/, 'per-category color control');
assert.match(page, /categoryPrefs\[type\.id\]/, 'visibility honors per-category enable');

// 1. Brief, configurable notification; no flashing/reappearing.
assert.match(settings, /notificationDurationMs: 9000/, 'default notification duration');
assert.match(settings, /notificationAutoMinimize: true/, 'auto-minimize by default');
assert.match(hook, /setTimeout\(\(\) => setBanner\(null\), settings\.notificationDurationMs/, 'one-shot auto-minimize');
assert.match(page, /data-notification-preview="true"/, 'test notification preview');
assert.match(page, /warning-banner-enter/, 'one-time slide-in');
assert.doesNotMatch(page, /animate-(pulse|bounce)/, 'no flashing notification');

// 4 + 11. Default audio hierarchy and test buttons.
assert.match(audio, /speakAlertText/, 'voice announcement path');
assert.match(audio, /playTestAlert/, 'test alert audio path');
assert.match(audio, /if \(!profileAllowsTone\(settings\.soundProfile\)\) return/, 'silent remains truly silent');
assert.match(panel, /Test alert audio/, 'test audio section');
for (const button of ['Test Tornado Warning', 'Test Confirmed Tornado Warning', 'Test PDS Tornado Warning', 'Test Tornado Emergency', 'Test Severe Thunderstorm Warning', 'Test Flash Flood Warning', 'Test Flash Flood Emergency']) {
  assert.ok(categories.includes(button) || panel.includes(button), `test button required: ${button}`);
}
assert.match(panel, /Restore Default Alert Sounds/, 'restore defaults control');

// 5. Professional, disableable emergency boundary treatment.
assert.match(map, /emergencyEffects/, 'emergency effects prop');
assert.match(map, /isEmergencyEvent/, 'only real emergency products get treatment');
assert.match(map, /setInterval\(\(\) => \{ flip = !flip; apply\(\); \}, 1400\)/, 'slow dash movement, no flashing');
assert.match(page, /emergencyEffects: alertSettings\.emergencyEffects/, 'user setting applied');

// 6-8. Detail content, real places, honest impact framework.
for (const field of ['Event type', 'WFO', 'VTEC', 'Issue time', 'Expiration time', 'Remaining time', 'Hazard', 'Impacts', 'Instructions', 'Full NWS warning text', 'Places affected', 'Population in polygon', 'Hospitals']) {
  assert.ok(detail.includes(field), `warning detail must include ${field}`);
}
assert.match(fs.readFileSync('app/api/alerts/route.ts', 'utf8'), /resolveZonePlaces/, 'places from real zones');

console.log('PASS: Phase 4 Alerts professional workflow contracts');
