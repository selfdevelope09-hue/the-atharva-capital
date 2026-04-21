/**
 * Global polyfills — must be the FIRST import in app/_layout.tsx.
 *
 * Why this file exists:
 *   Metro converts bundles to type="module" scripts for web.
 *   Module scripts have their own scope, so classic-script globals
 *   (process, __METRO_GLOBAL_PREFIX__, global) are not automatically
 *   visible to every module.  We write them to globalThis here so
 *   they are accessible everywhere before any app code runs.
 */

// ── __METRO_GLOBAL_PREFIX__ ────────────────────────────────────────────────
// Metro's internal require() machinery depends on this being a non-undefined
// string.  The metro.config.js globalPrefix:'' setting bakes it in at build
// time, but this ensures it is also present at runtime (belt + suspenders).
if (typeof (globalThis as Record<string, unknown>).__METRO_GLOBAL_PREFIX__ === 'undefined') {
  (globalThis as Record<string, unknown>).__METRO_GLOBAL_PREFIX__ = '';
}

// ── global ────────────────────────────────────────────────────────────────
// Some CommonJS packages reference the Node.js `global` object directly.
// In a browser environment it doesn't exist — alias it to globalThis.
if (typeof (globalThis as Record<string, unknown>).global === 'undefined') {
  (globalThis as Record<string, unknown>).global = globalThis;
}

// ── process ───────────────────────────────────────────────────────────────
// Same scoping issue as above: Metro's runtime used to leak `var process` to
// window via classic-script semantics; after the type="module" conversion it
// stays module-scoped.  Expose on globalThis so every module sees it.
if (typeof process === 'undefined') {
  (globalThis as Record<string, unknown>).process = {
    env: { NODE_ENV: 'production' },
    browser: true,
    version: '',
    versions: {},
    nextTick: (fn: (...args: unknown[]) => void, ...args: unknown[]) =>
      setTimeout(() => fn(...args), 0),
  };
}

export {};
