#!/bin/bash
set -e

# Run the update-db-task
node ./update-db/main.js

# Check if the task ran successfully
if [ $? -ne 0 ]; then
  echo "Update DB task failed"
  exit 1
else
  echo "Update DB task completed successfully"
fi

cd mongo-parquet

mkdir src/data
mkdir src/.sync_temp
mkdir src/.views_temp

echo "Downloading most recent parquet files from S3"
uv run --directory=src mongo_parquet --download-from-remote --storage=s3

echo "Syncing parquet files with MongoDB"
uv run --directory=src mongo_parquet --sync-parquet --cleanup-temp-dir

if [ $? -ne 0 ]; then
  echo "Syncing parquet files failed"
else
  echo "Parquet files synced successfully"
  echo "Uploading updated parquet files to S3"
  uv run --directory=src mongo_parquet --upload-to-remote --storage=s3

  if [ $? -ne 0 ]; then
    echo "Uploading updated parquet files failed"
  else
    echo "Updated parquet files uploaded successfully"
  fi
fi

echo "Recalculating views"
uv run --directory=src mongo_parquet --recalculate-views --cleanup-temp-dir

if [ $? -ne 0 ]; then
  echo "Recalculating views failed"
else
  echo "Views recalculated successfully"
fi

echo "Exporting sample data from MongoDB to S3"
mkdir src/sample
uv run --directory=src mongo_parquet --export-from-mongo --upload-to-remote --storage=s3 --sample

if [ $? -ne 0 ]; then
  echo "Exporting sample data failed"
  exit 1
else
  echo "Sample data exported successfully"
fi