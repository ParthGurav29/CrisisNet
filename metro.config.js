const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
// IMPORTANT: do NOT alias `crypto` to `react-native-crypto`. Its transitive
// dep `react-native-randombytes` runs `init()` at module-load time which reads
// `NativeModules.RNRandomBytes.seed` and crashes the JS bundle on RN 0.85
// when the native module isn't linked. Pure-JS hashing via `crypto-js` is
// used in `src/utils/modelStorage.js` instead, and `react-native-get-random-values`
// (imported in `index.js`) handles `crypto.getRandomValues` if anything needs it.
const config = {
  resolver: {
    extraNodeModules: {
      stream: require.resolve('stream-browserify'),
      buffer: require.resolve('@craftzdog/react-native-buffer'),
      util: require.resolve('util'),
      events: require.resolve('events'),
      'safe-buffer': require.resolve('safe-buffer'),
      'string_decoder': require.resolve('string_decoder'),
      inherits: require.resolve('inherits'),
      'to-buffer': require.resolve('to-buffer'),
    },
    blockList: [
      // Defensive: block `react-native-randombytes` from being bundled. It
      // crashes the runtime on RN 0.85 because its top-level init() reads
      // a property of `NativeModules.RNRandomBytes` (which is null when the
      // legacy native module isn't linked). We don't use it anywhere; this
      // guard ensures it can't sneak back via a transitive dependency.
      /node_modules\/react-native-randombytes\/.*/,
    ],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
