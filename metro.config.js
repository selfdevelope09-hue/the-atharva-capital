const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);
config.resolver.platforms = ['ios', 'android', 'native', 'web'];
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  process: require.resolve('process/browser'),
};

// Intercept @react-native-community/slider on web and replace with our safe wrapper.
// This eliminates the "H is not a function" crash caused by codegenNativeComponent
// returning undefined on web (the underlying native module doesn't exist in browsers).
const defaultResolver = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    platform === 'web' &&
    moduleName === '@react-native-community/slider'
  ) {
    return {
      filePath: path.resolve(__dirname, 'src/components/shared/SliderInput.tsx'),
      type: 'sourceFile',
    };
  }
  if (defaultResolver) {
    return defaultResolver(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
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
