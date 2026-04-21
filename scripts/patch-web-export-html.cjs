/**
 * Expo Metro emits bundle scripts as <script src="/_expo/..." defer> without type="module".
 * Bundles contain import.meta which only works inside ES module scripts.
 * This script patches every .html file in dist/ to add type="module" to the bundle scripts.
 *
 * Run: node scripts/patch-web-export-html.cjs
 */
'use strict';

const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');

if (!fs.existsSync(distDir)) {
  console.error('[patch] dist/ does not exist — run expo export first');
  process.exit(1);
}

// Collect all .html files recursively
function collectHtml(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectHtml(full, results);
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      results.push(full);
    }
  }
  return results;
}

const htmlFiles = collectHtml(distDir);
let patchedCount = 0;

// Match bundle script tags that still use defer (with or without ="defer") — NOT already type="module"
const DEFER_RE =
  /<script src="(\/_expo\/static\/js\/web\/[^"]+\.js)"(?: defer(?:="defer")?)?><\/script>/g;

for (const file of htmlFiles) {
  let html = fs.readFileSync(file, 'utf8');
  const before = html;

  // Replace every /_expo bundle script with type="module" (remove defer — modules are already deferred)
  html = html.replace(DEFER_RE, (match, src) => {
    // Skip if this match already has type="module" somehow
    if (match.includes('type="module"')) return match;
    return `<script type="module" src="${src}"></script>`;
  });

  if (html !== before) {
    fs.writeFileSync(file, html, 'utf8');
    patchedCount++;
    console.log(`[patch] patched: ${path.relative(distDir, file)}`);
  } else {
    // Check if bundles are already correct
    if (html.includes('type="module" src="/_expo/')) {
      console.log(`[patch] already has type=module: ${path.relative(distDir, file)}`);
    } else {
      console.warn(`[patch] no matching bundle scripts in: ${path.relative(distDir, file)}`);
    }
  }
}

console.log(`[patch] done — ${patchedCount}/${htmlFiles.length} file(s) patched`);
