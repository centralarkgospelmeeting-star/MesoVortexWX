#!/usr/bin/env node
/** WeatherWise-style professional UI contracts: compact, readable, calm. */
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('app/page.tsx', 'utf8');
const css = fs.readFileSync('app/globals.css', 'utf8');
const activeComponents = [
  'app/page.tsx',
  'components/hsi/HsiPanel.tsx',
  'components/surface/SurfaceLayersPanel.tsx',
  'components/RadarMap.tsx',
  'components/AlertDetailsPanel.tsx',
  'components/MainNavbar.tsx',
  'components/UniversalLegend.tsx',
  'components/WarningDetailsPopup.tsx',
  'components/MainMenuDrawer.tsx',
  'components/WarningDrawerRight.tsx',
];

// Composite options must be a compact, scrollable popover — never a full-width
// block that covers the workstation.
assert.match(page, /data-composite-options="true" className="relative"/, 'composite options must be anchored to their control');
assert.match(page, /fixed right-2 top-16 z-50 max-h-\[55vh\] w-\[min\(16rem,calc\(100vw-2rem\)\)\] overflow-y-auto/, 'composite options must be bounded and viewport-clamped without overlapping the HSI panel');
assert.doesNotMatch(page, /w-full rounded-md border border-slate-700 bg-\[#0b1220\] p-2 text-\[10px\]/, 'full-width composite options must be removed');
assert.match(page, /target\.closest\('\[data-composite-options\]'\)/, 'composite options must close on outside click');
assert.match(page, /event\.key === 'Escape'/, 'composite options must close on Escape');

// Menus stay compact; no giant expanding chrome.
assert.match(page, /w-64 max-w-\[min\(16rem,85vw\)\]/, 'hamburger menu must stay compact');
assert.match(page, /max-h-screen/, 'hamburger menu must scroll within the viewport');

// Readability floor on the dense operational panels.
for (const file of ['components/hsi/HsiPanel.tsx', 'components/surface/SurfaceLayersPanel.tsx']) {
  const src = fs.readFileSync(file, 'utf8');
  assert.doesNotMatch(src, /text-\[8px\]|text-\[9px\]/, `${file} must not use sub-10px text`);
}

// No decorative looping animation in active UI. The one-time warning slide-in
// is the only alert entrance and remains required.
for (const file of activeComponents) {
  const src = fs.readFileSync(file, 'utf8');
  assert.doesNotMatch(src, /animate-(fade-in|slide-left|slide-right|bounce|pulse|spin)/, `${file} must not use decorative looping animations`);
}
assert.match(css, /@keyframes warning-slide-in/, 'one-time alert slide-in must remain');
assert.match(css, /warning-banner-enter/, 'slide-in class must remain available');
for (const name of ['marquee', 'ww-pulse', 'spotter-ping', 'fastscan-glow']) {
  assert.doesNotMatch(css, new RegExp(`@keyframes ${name}`), `unused animation ${name} must be removed`);
}

console.log('PASS: professional weather-first UI workflow contracts');
