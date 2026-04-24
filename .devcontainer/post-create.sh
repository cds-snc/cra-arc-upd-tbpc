#!/bin/bash
set -e

npm install && \
  ./scripts/shell/aws-sso-init.sh && \
  npm run mongo-parquet:sync && \
  npm run mongo-parquet:seed-mongo && \
  npm run mongo-parquet:recalc-views-sample