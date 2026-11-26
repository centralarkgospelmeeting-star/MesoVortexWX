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
assert.match(panel, /data-alert-panel="true"/, 'warning panel must expose an observable workstation surface');
assert.match(panel, /mesovortex_alert_panel_session_v1/, 'warning panel position must persist during the session');
assert.match(panel, /onHeaderPointerDown|onHeaderPointerMove/, 'warning panel must be draggable');
assert.match(panel, /data-resize-handle="true"/, 'warning panel must be resizable');
assert.match(panel, /Expand warning panel/, 'warning panel must support collapse/expand');
assert.match(panel, /Pin warning panel/, 'warning panel must support pin/unpin');
assert.match(page, /if \(alertPanelPinned\) return;/, 'pinned warning panel must not be dismissed by map clicks');
assert.match(panel, /text-\[13px\] font-black leading-tight text-white/, 'warning titles must stay readable at a glance');
assert.match(panel, /text-\[12px\] font-semibold text-slate-300[^\n]*alertExpiryLabel/, 'expiration must be emphasized');
assert.match(panel, /px-2\.5 py-2 text-left/, 'compact cards must use increased padding and spacing');
assert.match(panel, /py-1\.5 text-\[11px\] leading-snug/, 'detail rows must use larger text and spacing');
assert.match(panel, /import \{[^}]*sortAlerts[^}]*\} from '\.\.\/lib\/alerts\/model'/, 'context card must use canonical alert priority');
assert.doesNotMatch(panel, /function warningPriority/, 'duplicate context priority algorithm must be removed');
const alertsAt = panel.indexOf('data-section="alerts"');
const radarAt = panel.indexOf('data-section="radar"');
const reportsAt = panel.indexOf('data-section="reports"');
assert.ok(alertsAt > -1 && radarAt > alertsAt && reportsAt > radarAt, 'context card order must be warnings, nearest radar, then reports');
assert.match(panel, /Reports \(\{context\.reportsNearby\.length\}\)/, 'spotter and LSR reports must share one compact section');
for (const field of ['Event type', 'WFO', 'VTEC', 'Severity', 'Issue time', 'Expiration time', 'Remaining time', 'Places affected', 'Hazard', 'Impacts', 'Instructions', 'Full NWS warning text']) {
  assert.ok(panel.includes(field), `warning details must show: ${field}`);
}
const alertApi = fs.readFileSync('app/api/alerts/route.ts', 'utf8');
assert.match(alertApi, /resolveZonePlaces/, 'Places Affected must resolve real NWS zones');
assert.match(alertApi, /feature\.properties = \{ \.\.\.\(feature\.properties \|\| \{\}\), places \}/, 'zone names must be attached to alert features');
assert.match(fs.readFileSync('lib/alerts/model.ts', 'utf8'), /places: string\[\]/, 'canonical alert must carry Places Affected');
const warningClick = map.match(/map\.on\('click', WARNINGS_FILL_ID,[\s\S]*?\n      \}\);/)?.[0] || '';
assert.ok(warningClick.includes('onSelectWarningRef.current'), 'warning clicks must open the single alert workflow');
assert.doesNotMatch(warningClick, /new maplibregl\.Popup/, 'warning clicks must not open a duplicate raw popup');

// Professional warning banners: one-time slide-in, persistent, manually dismissed.
const css = fs.readFileSync('app/globals.css', 'utf8');
assert.match(page, /warning-banner-enter/, 'main warning banner must use the one-time slide-in');
assert.doesNotMatch(page, /warningFlash|animate-pulse|animate-bounce/, 'main warning banner must not flash or bounce');
assert.match(page, /role="status"/, 'banner must expose accessible status semantics');
assert.match(page, /aria-live="polite"/, 'new alerts must be announced without interrupting the user');
assert.match(page, /onClick=\{dismissBanner\}/, 'warning banner must support manual dismissal');
assert.match(hook, /setTimeout\(\(\) => setBanner\(null\), settings\.notificationDurationMs/, 'banner auto-minimizes after the configured duration');
assert.match(css, /@keyframes warning-slide-in/, 'one-time slide-in keyframes must exist');
assert.doesNotMatch(css, /warning-slide-in[\s\S]*?infinite/, 'slide-in must not repeat');

// One alert system: no duplicate siren/notification/banner surface.
assert.ok(!fs.existsSync('components/EmergencyAlertTone.tsx'), 'duplicate emergency alert system must be removed');
assert.doesNotMatch(fs.readFileSync('components/WarningDrawerRight.tsx', 'utf8'), /animate-pulse|animate-bounce/, 'warning drawer must not blink');
for (const file of fs.readdirSync('components').filter((name) => name.endsWith('.tsx'))) {
  const source = fs.readFileSync(`components/${file}`, 'utf8');
  assert.doesNotMatch(source, /new Notification\(|play1050HzSiren|1050 Hz|EMERGENCY WEATHER ALERT/i, `${file} must not run a separate alert/audio system`);
}
assert.doesNotMatch(hook, /createOscillator|new Audio\(/, 'alert hook must use only the single audio dispatcher');

// Silent profile must be truly silent, including custom sounds and test tones.
assert.match(audio, /if \(!profileAllowsTone\(settings\.soundProfile\)\) return/, 'dispatcher must short-circuit in silent mode before any sound');
assert.match(audio, /silent:\s*\{[\s\S]*?other:\s*\[\]/, 'silent profile must define no tones');
assert.match(fs.readFileSync('lib/alerts/settings.ts', 'utf8'), /return profile !== 'silent'/, 'silent profile must be recognized as muted');

console.log('PASS: alert correctness and single-audio-dispatcher contract');
