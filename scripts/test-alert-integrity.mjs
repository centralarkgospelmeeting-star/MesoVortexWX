#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('app/page.tsx', 'utf8');
const hook = fs.readFileSync('lib/alerts/use-fast-alerts.ts', 'utf8');
const audio = fs.readFileSync('lib/alerts/audio.ts', 'utf8');
const panel = fs.readFileSync('components/AlertDetailsPanel.tsx', 'utf8');
const map = fs.readFileSync('components/RadarMap.tsx', 'utf8');

// One canonical settings schema owns audio policy; the page no longer runs a
// second custom-sound side effect.
assert.match(page, /useFastAlerts\(\{[\s\S]*?settings: alertSettings/, 'useFastAlerts must receive canonical alert settings');
assert.match(page, /useFastAlerts\(\{[\s\S]*?bannerVisible:/, 'audio must know whether the banner surface is visible');
assert.doesNotMatch(page, /playedSoundBannerIdRef/, 'duplicate banner sound ref must be removed');
assert.doesNotMatch(page, /alertSoundForEvent/, 'custom-sound dispatch must not be duplicated in the page');
assert.doesNotMatch(page, /profileAllowsTone/, 'sound-profile policy must not be duplicated in the page');

// Alert selection clears stale geographic context, and map context clears the
// previously selected alert.
assert.ok((page.match(/setLocationContext\(null\)/g) || []).length >= 4, 'all alert-selection paths must clear locationContext');
assert.match(page, /if \(id\) \{ setLocationContext\(null\); setSelectedAlertId\(id\); setAlertsOpen\(true\); \}/, 'deep-link selection must clear locationContext');
assert.match(page, /onSelectAlert=\{\(a\) => \{ setLocationContext\(null\); setSelectedAlertId\(a\.id\); setAlertsOpen\(true\); \}\}/, 'alert-list selection must clear locationContext');
assert.match(page, /onClick=\{\(\) => \{ setLocationContext\(null\); setSelectedAlertId\(styledBanner\.id\); setAlertsOpen\(true\); \}\}/, 'banner selection must clear locationContext');
assert.match(page, /onMapContextClick:[\s\S]*?setSelectedAlertId\(null\)/, 'map context clicks must clear selectedAlertId');

// A single dispatcher owns new-alert audio, test tones, custom sounds and the
// silent profile.
assert.match(hook, /playAlertAudio/, 'hook must use the single audio dispatcher');
assert.doesNotMatch(hook, /playAlertTone/, 'hook must not bypass the dispatcher');
assert.match(audio, /export function playAlertAudio/, 'audio dispatcher must exist');
assert.match(audio, /if \(!profileAllowsTone\(settings\.soundProfile\)\) return/, 'dispatcher must honor silent profile');
assert.match(audio, /if \(!profileAllowsTone\(profile\)\) return/, 'built-in tones must honor silent profile');
assert.match(audio, /customSounds|alertSoundForEvent/, 'dispatcher must honor existing custom sounds');

// A restored arming preference must be re-unlocked by the next real gesture;
// otherwise the UI says "armed" while autoplay policy still blocks audio.
assert.match(hook, /audioUnlockRequiredRef\.current = storedAudioEnabled/, 'stored arming must require a fresh gesture');
assert.match(hook, /addEventListener\('pointerdown', unlockStoredAudio/, 'pointer gestures must re-unlock stored audio');
assert.match(hook, /addEventListener\('keydown', unlockStoredAudio/, 'keyboard gestures must re-unlock stored audio');

// WeatherWise-style compact context workflow: warnings, nearest radar, reports.
assert.match(page, /\/api\/spotter\?mode=reports/, 'context reports must come from the verified spotter route');
assert.doesNotMatch(page, /\/api\/spotters\/reports/, 'removed report endpoint must not return');
assert.match(page, /buildLocationContext\(locationContext\.lat, locationContext\.lon, visibleMapAlerts/, 'context must use the same filtered alerts as the map');
assert.match(page, /onSelectNearestRadar=\{\(site\) => \{[\s\S]*?setFocusTarget\(\{ lat: site\.lat, lon: site\.lon/, 'nearest radar selection must center the map');
assert.match(panel, /w-\[292px\]/, 'context card must stay compact');
assert.match(panel, /import \{[^}]*sortAlerts[^}]*\} from '\.\.\/lib\/alerts\/model'/, 'context card must use canonical alert priority');
assert.doesNotMatch(panel, /function warningPriority/, 'duplicate context priority algorithm must be removed');
const alertsAt = panel.indexOf('data-section="alerts"');
const radarAt = panel.indexOf('data-section="radar"');
const reportsAt = panel.indexOf('data-section="reports"');
assert.ok(alertsAt > -1 && radarAt > alertsAt && reportsAt > radarAt, 'context card order must be warnings, nearest radar, then reports');
assert.match(panel, /Reports \(\{context\.reportsNearby\.length\}\)/, 'spotter and LSR reports must share one compact section');
const warningClick = map.match(/map\.on\('click', WARNINGS_FILL_ID,[\s\S]*?\n      \}\);/)?.[0] || '';
assert.ok(warningClick.includes('onSelectWarningRef.current'), 'warning clicks must open the single alert workflow');
assert.doesNotMatch(warningClick, /new maplibregl\.Popup/, 'warning clicks must not open a duplicate raw popup');

console.log('PASS: alert correctness and single-audio-dispatcher contract');
