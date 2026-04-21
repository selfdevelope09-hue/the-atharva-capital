/**
 * Web polyfills — imported as the FIRST import in app/_layout.tsx.
 * Runs before any module that might depend on Node.js globals.
 *
 * Root cause: Metro's `type="module"` scripts each have their own scope.
 * The `__expo-metro-runtime` bundle sets `var process` as a classic-script
 * global, which leaks to window. After our import.meta patch converts
 * bundles to type="module", each script has isolated scope and `process`
 * becomes undefined in every other module.
 *
 * Fix: set window.process explicitly so all modules share it via window.
 */

if (typeof window !== 'undefined') {
  const w = window as Record<string, unknown>;

  // Metro's runtime bundle declares `var process` as a classic-script global;
  // after our import.meta patch converts bundles to type="module" that var stays
  // module-scoped and is invisible to other modules. Expose it via window.
  if (typeof process === 'undefined') {
    w.process = {
      env: { NODE_ENV: 'production' },
      browser: true,
      version: '',
      versions: {},
      nextTick: (fn: (...args: unknown[]) => void, ...args: unknown[]) =>
        setTimeout(() => fn(...args), 0),
    };
  }

  // Metro emits `__METRO_GLOBAL_PREFIX__` as a bundle-scoped var; same scoping
  // issue as process above. Define on window so every module can read it.
  if (typeof (w.__METRO_GLOBAL_PREFIX__) === 'undefined') {
    w.__METRO_GLOBAL_PREFIX__ = '';
  }
}

export {};
