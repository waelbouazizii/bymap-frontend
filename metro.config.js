// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Silence the "exports" subpath warning from react-native-webrtc's
// nested event-target-shim dependency by disabling strict package exports.
config.resolver.unstable_enablePackageExports = false;

// ── Web-platform shims for native-only community packages ─────────────────────
// These packages have no web support and would cause Metro build errors on web.
// Each shim exports the same API shape with no-op / browser-fallback implementations.
const WEB_SHIMS = {
  'react-native-view-shot': path.resolve(__dirname, 'src/web-shims/view-shot.js'),
  'expo-secure-store':      path.resolve(__dirname, 'src/web-shims/secure-store.js'),
};

const { resolveRequest: originalResolveRequest } = config.resolver;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && WEB_SHIMS[moduleName]) {
    return { type: 'sourceFile', filePath: WEB_SHIMS[moduleName] };
  }
  return originalResolveRequest
    ? originalResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
