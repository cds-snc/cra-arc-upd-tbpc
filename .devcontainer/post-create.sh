#!/bin/bash
set -e

bun install --ignore-scripts --omit=peer --omit=optional && \
  chmod +x .devcontainer/get-duckdb-node-binding.sh && \
  .devcontainer/get-duckdb-node-binding.sh && \
  npm run mongo-parquet:sync && \
  npm run mongo-parquet:seed-mongo && \
  npm run mongo-parquet:recalc-views-sample