const { withProjectBuildGradle } = require('@expo/config-plugins');

module.exports = function withExoPlayerResolution(config) {
  return withProjectBuildGradle(config, (config) => {
    if (!config.modResults.contents.includes('resolutionStrategy')) {
      config.modResults.contents += `
allprojects {
    configurations.all {
        resolutionStrategy {
            force "com.google.android.exoplayer:exoplayer:2.18.1"
            force "com.google.android.exoplayer:extension-okhttp:2.18.1"
        }
    }
}
`;
    }
    return config;
  });
};
