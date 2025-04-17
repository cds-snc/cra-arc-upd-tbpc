const { composePlugins, withNx } = require('@nx/webpack');
const { merge } = require('webpack-merge');

// Nx plugins for webpack.
module.exports = composePlugins(withNx(), (config) => {
  // Note: This was added by an Nx migration. Webpack builds are required to have a corresponding Webpack config file.
  // See: https://nx.dev/recipes/webpack/webpack-config-setup

  return merge(config, {
    externals: [
      '@adobe/aio-lib-analytics',
      '@angular/core',
      '@azure/core-http-compat',
      '@azure/storage-blob',
      '@googleapis/searchconsole',
      '@mongodb-js/zstd',
      '@nestjs/cache-manager',
      '@nestjs/common',
      '@nestjs/config',
      '@nestjs/core',
      '@nestjs/mongoose',
      '@nestjs/platform-express',
      '@nestjs/schedule',
      '@swc/helpers',
      'airtable',
      'axios',
      'brotli-wasm',
      'cache-manager',
      'chalk',
      'cheerio',
      'dayjs',
      'dotenv',
      'duckdb',
      'html-minifier-terser',
      'mongoose',
      'nodejs-polars',
      'notifications-node-client',
      'rambdax',
      'reflect-metadata',
      'rxjs',
      'stopwords-en',
      'stopwords-fr',
      // 'text-readability',
      'tslib',
      'zone.js',
    ],
  });
});
