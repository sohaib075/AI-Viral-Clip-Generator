const { withAndroidManifest, withInfoPlist } = require('expo/config-plugins');

// Release builds block plain-HTTP requests by default. When a build points EXPO_PUBLIC_API_URL at an
// http:// backend (such as a PC on the local network), allow cleartext traffic so the app can reach it.
// Builds that use an https:// backend keep the secure platform defaults.
module.exports = function withCleartextHttp(config) {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL || '';
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
    mod.modResults.NSAppTransportSecurity = {
      ...(mod.modResults.NSAppTransportSecurity || {}),
      NSAllowsArbitraryLoads: true,
    };
    return mod;
  });

  return config;
};
