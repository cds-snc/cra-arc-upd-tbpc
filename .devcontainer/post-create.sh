#!/bin/bash
set -e

bun install --ignore-scripts --omit=peer --omit=optional && \
  ./scripts/shell/aws-sso-init.sh && \
  npm run mongo-parquet:sync && \
  npm run mongo-parquet:seed-mongo && \
  npm run mongo-parquet:recalc-views-sample