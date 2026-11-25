#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const about = fs.readFileSync('app/about/page.tsx', 'utf8');
const aboutText = about.replace(/\s+/g, ' ');
const page = fs.readFileSync('app/page.tsx', 'utf8');
const drawer = fs.readFileSync('components/MainMenuDrawer.tsx', 'utf8');

// Story and image credit.
assert.ok(aboutText.includes('March 31, 2023 Little Rock Tornado'), 'about page must caption the radar image');
assert.ok(aboutText.includes('Radar imagery from the tornado that struck the Little Rock metropolitan area on March 31, 2023.'), 'caption must describe the tornado imagery');
assert.ok(aboutText.includes('Image provided by the creator of MesoVortexWX.'), 'caption must credit the image provider');
assert.ok(aboutText.includes('traces its origins to the March 31, 2023 tornado'), 'story must state the project origin');
assert.ok(aboutText.includes('sparked a lasting interest in weather, severe storms, radar technology, and meteorology'), 'story must describe how the interest began');
assert.ok(aboutText.includes('for the glory of God and for the benefit of all people'), 'story must include the project motivation');

// Mission and values.
for (const audience of ['Forecasters', 'Emergency managers', 'First responders', 'Pilots', 'Researchers', 'Weather enthusiasts', 'The general public']) {
  assert.ok(aboutText.includes(audience), `mission must include: ${audience}`);
}
for (const value of ['Data honesty', 'Transparency', 'Verification', 'Accessibility', 'Weather-first workflows']) {
  assert.ok(aboutText.includes(value), 'about page must state project values');
}
assert.ok(aboutText.includes('honest, trustworthy, and accessible weather information'), 'story must state the project goal');

// Asset and navigation.
assert.ok(fs.existsSync('public/hsi-radar-backdrop.webp'), 'credits image asset must exist');
assert.ok(aboutText.includes('/hsi-radar-backdrop.webp'), 'about page must display the radar image');
assert.ok(page.includes('data-menu-about="true"'), 'workstation menu must link to Credits & About');
assert.ok(drawer.includes('href="/about"'), 'main menu drawer must link to Credits & About');

// Verse belongs only to Credits/About; never in operational surfaces.
assert.ok(aboutText.includes('Psalm 135:7'), 'credits page must include the optional footer verse');
assert.doesNotMatch(page, /Psalm\s+135:7|He sends the lightning/i, 'operational page must not show the verse');
const components = fs.readdirSync('components').filter((f) => f.endsWith('.tsx'));
for (const file of components) {
  const source = fs.readFileSync(path.join('components', file), 'utf8');
  assert.doesNotMatch(source, /Psalm\s+135:7|He sends the lightning/i, `${file} must not show the verse in operational UI`);
}
assert.doesNotMatch(about, /splash|role="dialog"|<dialog/i, 'about page must avoid splash screens and modals');

console.log('PASS: Credits/About story, image credit, mission, and verse placement');
