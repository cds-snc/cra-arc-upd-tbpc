#!/bin/bash

set -e

while getopts e: flag; do
  case "${flag}" in
  e) use_read_env=true ;;
  esac
done

if [[ "$use_read_env" == true ]]; then
  source scripts/shell/read_env.sh
  read_env
fi

export AWS_SSO_START_URL
export AWS_SSO_ADMIN_ROLE
export AWS_SSO_USER_ROLE

run_migration() {
  for ACCOUNT in "STAGING" "PRODUCTION"; do
    export AWS_SSO_ACCOUNT_ID_VAR="AWS_SSO_${ACCOUNT}_ACCOUNT_ID"
    export AWS_SSO_ACCOUNT_ID="${!AWS_SSO_ACCOUNT_ID_VAR}"

    echo "=== Processing $ACCOUNT account (ID: $AWS_SSO_ACCOUNT_ID) ==="

    # Run AWS SSO auth script
		if [[ "$ACCOUNT" == "PRODUCTION" ]]; then
			scripts/shell/aws-sso-init.sh -p
		else
			scripts/shell/aws-sso-init.sh
		fi

    DATA_BUCKET_NAME="cra-upd-dashboard-data-${ACCOUNT,,}"

    echo "Downloading full data from S3 bucket: $DATA_BUCKET_NAME"
    npm run mongo-parquet:download -- --remote-container "$DATA_BUCKET_NAME" --storage=s3

    echo "Downloading sample data from S3 bucket: $DATA_BUCKET_NAME"
    npm run mongo-parquet:download -- --remote-container "$DATA_BUCKET_NAME" --storage=s3 --sample

    uv run --directory=python/mongo-parquet/src migrate_parquet_schemas.py

    echo "Uploading full data to S3 bucket: $DATA_BUCKET_NAME"
    npm run mongo-parquet:upload -- --remote-container "$DATA_BUCKET_NAME" --storage=s3

    echo "Uploading sample data to S3 bucket: $DATA_BUCKET_NAME"
    npm run mongo-parquet:upload -- --remote-container "$DATA_BUCKET_NAME" --storage=s3 --sample

    echo "=== Completed processing $ACCOUNT account ==="
  done
}

run_migration

if [ $? -eq 0 ]; then
  echo "Parquet schema migration completed successfully for all accounts."
else
  echo "Parquet schema migration encountered errors."
  exit 1
fi
