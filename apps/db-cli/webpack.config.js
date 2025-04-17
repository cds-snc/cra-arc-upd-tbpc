const { composePlugins, withNx } = require('@nx/webpack');
const { merge } = require('webpack-merge');

// Nx plugins for webpack.
module.exports = composePlugins(withNx(), (config) => {
  // Note: This was added by an Nx migration. Webpack builds are required to have a corresponding Webpack config file.
  // See: https://nx.dev/recipes/webpack/webpack-config-setup
  return merge(config, {
    module: {
      rules: [
        {
          test: /\.node$/,
          loader: 'node-loader',
        },
      ],
    },
    ignoreWarnings: [
      new RegExp(
        'Failed to parse source map|' +
          'the request of a dependency is an expression|' +
          "Module not found: Error: Can't resolve '(.\\/zstd|@mongodb-js)",
      ),
    ],
  });
});
