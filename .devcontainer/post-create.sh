bun install --ignore-scripts \
    && chmod +x .devcontainer/get-duckdb-node-binding.sh \
    && .devcontainer/get-duckdb-node-binding.sh \
    && chmod +x .devcontainer/aws-sso-init.sh \
    && .devcontainer/aws-sso-init.sh \
    && npm run mongo-parquet:sync \
    && npm run mongo-parquet:seed-mongo