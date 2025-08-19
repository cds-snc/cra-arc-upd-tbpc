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

echo "Exporting sample data from MongoDB to S3"
cd mongo-parquet
mkdir src/sample
uv run --directory=src mongo_parquet --export-from-mongo --upload-to-remote --storage=s3 --sample

if [ $? -ne 0 ]; then
  echo "Exporting sample data failed"
  exit 1
else
  echo "Sample data exported successfully"
fi

echo "Exporting full data from MongoDB to S3"
mkdir src/data
uv run --directory=src mongo_parquet --export-from-mongo --upload-to-remote --storage=s3

if [ $? -ne 0 ]; then
  echo "Exporting full data failed"
  exit 1
else
  echo "Full data exported successfully"
fi