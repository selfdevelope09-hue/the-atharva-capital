/**
 * Two-pass HTML patcher for Expo static web exports:
 *
 *  Pass 1 — import.meta fix
 *    Expo Metro emits bundle scripts as <script src="/_expo/..." defer> without type="module".
 *    Bundles contain import.meta which only works inside ES module scripts.
 *
 *  Pass 2 — process polyfill
 *    After converting bundles to type="module" each script runs in its own scope.
 *    The __expo-metro-runtime bundle used to declare `var process` as a classic script,
 *    leaking it to window. As a module script that var stays local.
 *    Fix: inject an inline classic <script> (which runs BEFORE all module scripts)
 *    that sets window.process explicitly.
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

// Minified window.process polyfill (classic script — runs before ALL module scripts)
const PROCESS_POLYFILL_SCRIPT =
  '<script>' +
  '(function(){' +
  'if(typeof window!=="undefined"&&typeof window.process==="undefined"){' +
  'window.process={' +
  'env:{NODE_ENV:"production"},' +
  'browser:true,' +
  'version:"",' +
  'versions:{},' +
  'nextTick:function(fn){return setTimeout(fn,0);}' +
  '};' +
  '}' +
  '})();' +
  '</script>';

// Match bundle <script src="/_expo/..." defer> tags that are NOT already type="module"
const DEFER_RE = /<script src="(\/_expo\/static\/js\/web\/[^"]+\.js)"(?: defer(?:="defer")?)?><\/script>/g;

const htmlFiles = collectHtml(distDir);
let patchedCount = 0;

for (const file of htmlFiles) {
  let html = fs.readFileSync(file, 'utf8');
  const before = html;

  // Pass 1: convert bundle scripts to type="module"
  html = html.replace(DEFER_RE, (match, src) => {
    if (match.includes('type="module"')) return match;
    return `<script type="module" src="${src}"></script>`;
  });

  // Pass 2: inject window.process polyfill before the first _expo module script
  // (classic scripts run before deferred / module scripts — polyfill is ready first)
  if (!html.includes('window.process=')) {
    html = html.replace(
      /<script type="module" src="\/_expo\/static\/js\/web\//,
      PROCESS_POLYFILL_SCRIPT + '<script type="module" src="/_expo/static/js/web/',
    );
  }

  if (html !== before) {
    fs.writeFileSync(file, html, 'utf8');
    patchedCount++;
    console.log(`[patch] patched: ${path.relative(distDir, file)}`);
  } else {
    if (html.includes('window.process=')) {
      console.log(`[patch] already patched: ${path.relative(distDir, file)}`);
    } else {
      console.warn(`[patch] no matching bundle scripts in: ${path.relative(distDir, file)}`);
    }
  }
}

console.log(`[patch] done — ${patchedCount}/${htmlFiles.length} file(s) patched`);
