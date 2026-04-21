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

if (typeof window !== 'undefined' && typeof process === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).process = {
    env: { NODE_ENV: 'production' },
    browser: true,
    version: '',
    versions: {},
    nextTick: (fn: (...args: unknown[]) => void, ...args: unknown[]) => setTimeout(() => fn(...args), 0),
  };
}

export {};
