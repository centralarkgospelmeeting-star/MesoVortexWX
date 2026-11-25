#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const catalog = fs.readFileSync('lib/radar/product-catalog.ts', 'utf8');
const matrix = fs.readFileSync('lib/radar/capability-matrix.ts', 'utf8');
const card = fs.readFileSync('components/WeatherWiseRadarCard.tsx', 'utf8');
const panel = fs.readFileSync('components/FloatingProductPanel.tsx', 'utf8');
const banner = fs.readFileSync('components/ProductInfoBanner.tsx', 'utf8');
const page = fs.readFileSync('app/page.tsx', 'utf8');

// The catalog has an explicit domain before any meteorological family.
assert.match(catalog, /domain: ProductDomain/, 'catalog entries must declare their domain');
assert.match(catalog, /id: 'RADAR'[\s\S]*?Generated from an individual radar site/, 'radar domain must be described as single-site');
assert.match(catalog, /id: 'COMPOSITE'[\s\S]*?Created from multiple radars/, 'composite domain must be described as multi-radar');
assert.match(catalog, /getCatalogProductViews/, 'catalog availability must read the capability matrix');

// Single-site products must stay in RADAR; national/MRMS products must stay in COMPOSITE.
const radarBlock = catalog.match(/Radar Products — single-site sources only\.([\s\S]*?)\/\/ Composite Products/)?.[1] || '';
const compositeBlock = catalog.match(/Composite Products — national mosaic \/ MRMS \/ multi-radar sources only\.([\s\S]*?)\];/)?.[1] || '';
assert.ok(radarBlock, 'radar catalog block not found');
assert.ok(compositeBlock, 'composite catalog block not found');
for (const id of ['azshear', 'rotation_tracks', 'mesh', 'hail_detection', 'tops', 'vil', 'qpe', 'comp_ref']) {
  assert.doesNotMatch(radarBlock, new RegExp(`key: '${id}'`), `${id} is a composite product and must not appear under Radar Products`);
}
for (const id of ['ref', 'vel', 'srvel', 'cc', 'zdr', 'kdp', 'hhc', 'min_cc', 'volume_scan', 'tilt_selection']) {
  assert.doesNotMatch(compositeBlock, new RegExp(`key: '${id}'`), `${id} is a single-site product and must not appear under Composite Products`);
}

// Professional family groupings are present without inventing products.
for (const category of ['Reflectivity', 'Velocity', 'Polarimetric Products', 'Classification Products', 'Severe Analysis', 'Tilt Products', 'Analysis Products', 'Unverified / Not Claimed']) {
  assert.ok(radarBlock.includes(`category: '${category}'`), `radar catalog must include ${category}`);
}
for (const category of ['National Mosaic', 'Rotation Products', 'Hail Products', 'Echo Tops', 'VIL Products', 'QPE Products']) {
  assert.ok(compositeBlock.includes(`category: '${category}'`), `composite catalog must include ${category}`);
}

// The authoritative NROT entry stays unavailable; the live NROT-style analysis
// product and measured Level II cross section are separate, explicitly PARTIAL entries.
assert.match(matrix, /id: 'nrot'[\s\S]*?availability: 'UNAVAILABLE'/, 'official NROT must not be claimed');
assert.match(radarBlock, /key: 'norm_vel'[\s\S]*?label: 'Normalized Rotation \(unverified NROT\)'/, 'unverified NROT must be labeled as such');
for (const id of ['storm_analysis', 'cross_section']) {
  assert.match(matrix, new RegExp(`id: '${id}'[\\s\\S]*?availability: 'PARTIAL'`), `${id} must reflect its live Level II verification`);
  assert.doesNotMatch(radarBlock, new RegExp(`key: '${id}'[^\\n]*category: 'Unverified / Not Claimed'`), `${id} must not be filed as unverified`);
}
assert.match(radarBlock, /key: 'storm_analysis'[^\n]*category: 'Severe Analysis'/, 'live NROT-style analysis must be grouped with severe analysis');
assert.match(radarBlock, /key: 'cross_section'[^\n]*category: 'Analysis Products'/, 'live cross section must be grouped as an analysis product');

// Requested super-resolution products are discoverable but explicitly unavailable.
for (const id of ['super_res_ref', 'super_res_vel']) {
  assert.match(matrix, new RegExp(`id: '${id}'[\\s\\S]*?availability: 'UNAVAILABLE'`), `${id} must not be claimed as available`);
  assert.match(matrix, new RegExp(`id: '${id}'[\\s\\S]*?superResolutionSupport: 'UNKNOWN'`), `${id} must keep super-resolution support UNKNOWN`);
}

// Both product surfaces consume the shared catalog; neither duplicates categories locally.
for (const [file, source] of [['WeatherWiseRadarCard', card], ['FloatingProductPanel', panel]]) {
  assert.match(source, /from '\.\.\/lib\/radar\/product-catalog'/, `${file} must import the shared catalog`);
  assert.match(source, /renderDomainCatalog|renderDomainList/, `${file} must render catalog domains`);
  assert.doesNotMatch(source, /const RADAR_CATEGORIES(?![^]*product-catalog)/, `${file} must not redefine product categories`);
}

// Composite controls must not label radar products as composite products.
assert.doesNotMatch(card, /id: 'ref', label: 'Regional\/National Reflectivity'/, 'card must not offer REF as a composite product');
assert.doesNotMatch(card, /id: 'max_ref', label: 'Max Reflectivity Swath'/, 'card must not offer MAX as a composite product');
assert.match(card, /renderDomainCatalog\('COMPOSITE', COMPOSITE_PRODUCTS/, 'card composite drawer must use the composite catalog');
assert.match(panel, /renderDomainList\('COMPOSITE', COMPOSITE_PRODUCTS/, 'panel composite tab must use the composite catalog');
assert.match(page, /compositeProduct=\{product\}/, 'compact control must reflect the selected composite product');
assert.match(page, /product=\{bannerProduct\}/, 'banner must reflect the selected composite product');
assert.match(page, /modeTab === 'Composite'\) setProduct\('comp_ref'\)/, 'entering composite mode must start from the verified national product');
assert.match(page, /modeTab === 'Radar'\) setProduct\('ref'\)/, 'returning to radar mode must start from the verified single-site product');

// The banner states the domain so an operator can identify the source class immediately.
assert.match(banner, /'Domain', value: domain/, 'banner provenance must include the product domain');
assert.match(banner, /MULTI-RADAR \/ MRMS/, 'banner must identify national/MRMS products');
assert.match(banner, /SINGLE RADAR/, 'banner must identify single-site products');

console.log('PASS: radar/composite product catalog separation contract');
