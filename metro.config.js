// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Silence the "exports" subpath warning from react-native-webrtc's
// nested event-target-shim dependency by disabling strict package exports.
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
