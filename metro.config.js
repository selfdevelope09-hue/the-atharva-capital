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
  // Bakes an empty string into every __METRO_GLOBAL_PREFIX__ access site so the
  // variable never needs to exist at runtime (fixes the ReferenceError on web).
  globalPrefix: '',
  minifierConfig: {
    keep_classnames: true,
    keep_fnames: true,
    mangle: {
      keep_classnames: true,
      keep_fnames: true,
    },
  },
};

module.exports = withNativeWind(config, { input: './global.css' });
