const { withAndroidManifest, withInfoPlist } = require('expo/config-plugins');

// Build-time backend checks:
// - A production build without EXPO_PUBLIC_API_URL could never reach the backend, so fail the build.
// - Release builds block plain-HTTP requests by default. When EXPO_PUBLIC_API_URL is an http:// backend
//   (such as a PC on the local network), allow cleartext traffic. https:// backends keep secure defaults.
module.exports = function withCleartextHttp(config) {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL || '';

  if (!apiUrl && process.env.EAS_BUILD_PROFILE === 'production') {
    throw new Error('EXPO_PUBLIC_API_URL must be set for production builds (add it to the "production" profile in eas.json).');
  }

  if (!apiUrl.startsWith('http://')) {
    return config;
  }

  config = withAndroidManifest(config, (mod) => {
    const application = mod.modResults.manifest.application?.[0];
    if (application) {
      application.$['android:usesCleartextTraffic'] = 'true';
    }
    return mod;
  });

  config = withInfoPlist(config, (mod) => {
    const ats = { ...mod.modResults.NSAppTransportSecurity, NSAllowsArbitraryLoads: true };
    // iOS ignores NSAllowsArbitraryLoads while this more specific key is present
    delete ats.NSAllowsLocalNetworking;
    mod.modResults.NSAppTransportSecurity = ats;
    return mod;
  });

  return config;
};
