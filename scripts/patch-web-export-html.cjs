/**
 * Expo Metro web export emits classic <script defer> tags; bundles may contain import.meta,
 * which only works in ES module scripts. Mark _expo bundle scripts as type="module".
 */
const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
if (!fs.existsSync(indexPath)) {
  console.warn('[patch-web-export-html] dist/index.html missing, skip');
  process.exit(0);
}

let html = fs.readFileSync(indexPath, 'utf8');
const before = html;
html = html.replace(
  /<script src="(\/_expo\/static\/js\/web\/[^"]+\.js)" defer><\/script>/g,
  '<script type="module" src="$1"></script>',
);

if (html === before) {
  console.warn('[patch-web-export-html] no script tags matched (Expo HTML format may have changed)');
} else {
  fs.writeFileSync(indexPath, html);
  console.log('[patch-web-export-html] updated dist/index.html with type="module" for Expo JS bundles');
}
