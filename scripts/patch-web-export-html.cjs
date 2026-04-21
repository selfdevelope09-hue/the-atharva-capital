/**
 * Three-pass HTML patcher for Expo static web exports:
 *
 *  Pass 1 — import.meta fix
 *    Expo Metro emits bundle scripts as <script src="/_expo/..." defer> without type="module".
 *    Bundles contain import.meta which only works inside ES module scripts.
 *
 *  Pass 2 — globals polyfill  (process + __METRO_GLOBAL_PREFIX__)
 *    After converting bundles to type="module" each script runs in its own scope.
 *    Vars that Metro declared as classic-script globals (process, __METRO_GLOBAL_PREFIX__)
 *    become module-scoped and invisible to other modules.
 *    Fix: inject an inline classic <script> BEFORE the first module script.
 *    Classic scripts run first and write to window, which all modules can read.
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

// Minified globals polyfill — classic script, runs BEFORE all type="module" scripts.
// Covers: window.process  +  window.__METRO_GLOBAL_PREFIX__
const PROCESS_POLYFILL_SCRIPT =
  '<script>' +
  '(function(){' +
  // process polyfill
  'if(typeof window!=="undefined"&&typeof window.process==="undefined"){' +
  'window.process={' +
  'env:{NODE_ENV:"production"},' +
  'browser:true,' +
  'version:"",' +
  'versions:{},' +
  'nextTick:function(fn){return setTimeout(fn,0);}' +
  '};' +
  '}' +
  // __METRO_GLOBAL_PREFIX__ polyfill
  'if(typeof window.__METRO_GLOBAL_PREFIX__==="undefined"){' +
  'window.__METRO_GLOBAL_PREFIX__="";' +
  '}' +
  // also define on globalThis so Metro's internal require() finds it
  'if(typeof globalThis.__METRO_GLOBAL_PREFIX__==="undefined"){' +
  'globalThis.__METRO_GLOBAL_PREFIX__="";' +
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

  // Pass 2: inject globals polyfill before the first _expo module script.
  // Guard on __METRO_GLOBAL_PREFIX__ so re-running the script is idempotent.
  if (!html.includes('__METRO_GLOBAL_PREFIX__')) {
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
    if (html.includes('__METRO_GLOBAL_PREFIX__')) {
      console.log(`[patch] already patched: ${path.relative(distDir, file)}`);
    } else {
      console.warn(`[patch] no matching bundle scripts in: ${path.relative(distDir, file)}`);
    }
  }
}

console.log(`[patch] done — ${patchedCount}/${htmlFiles.length} file(s) patched`);
