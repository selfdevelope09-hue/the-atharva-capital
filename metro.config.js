const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);
config.resolver.platforms = ['ios', 'android', 'native', 'web'];
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  process: require.resolve('process/browser'),
};
config.transformer = {
  ...config.transformer,
  unstable_allowRequireContext: true,
  // Prevents "ReferenceError: __METRO_GLOBAL_PREFIX__ is not defined" on web.
  // Metro emits this as a runtime var in the bundle; when we convert bundles to
  // type="module" the var stays module-scoped and becomes undefined everywhere else.
  // Setting globalPrefix to '' bakes an empty string into every access site instead.
  globalPrefix: '',
};

module.exports = withNativeWind(config, { input: './global.css' });
