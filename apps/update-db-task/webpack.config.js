const { merge } = require('webpack-merge');
const { composePlugins, withNx } = require('@nx/webpack');

module.exports = composePlugins(
  withNx({ target: 'node' }),
  (config, { options, context }) =>
    merge(config, {
      optimization: {
        nodeEnv: process.env.NODE_ENV || 'development',
      },
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
    }),
);
