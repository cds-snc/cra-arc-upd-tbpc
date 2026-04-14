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

cd mongo-parquet/src

mkdir data
mkdir .sync_temp
mkdir .views_temp

echo "Downloading most recent parquet files from S3"
python -m mongo_parquet --download-from-remote --storage=s3

echo "Syncing and uploading parquet files with MongoDB"
python -m mongo_parquet --sync-parquet --upload-to-remote --storage=s3 --cleanup-temp-dir

if [ $? -ne 0 ]; then
  echo "Syncing and/or uploading parquet files failed"
else
  echo "Parquet files synced and uploaded successfully"
fi

echo "Recalculating views"
python -m mongo_parquet --recalculate-views --storage=s3 --cleanup-temp-dir

if [ $? -ne 0 ]; then
  echo "Recalculating views failed"
else
  echo "Views recalculated successfully"
fi

echo "Exporting sample data from MongoDB to S3"
mkdir sample

python -m mongo_parquet --create-sample-from-local

if [ $? -ne 0 ]; then
	echo "Creating sample data failed"
	exit 1
else
	echo "Sample data created successfully"
fi

python -m mongo_parquet --upload-to-remote --storage=s3 --sample

if [ $? -ne 0 ]; then
  echo "Uploading sample data failed"
  exit 1
else
  echo "Sample data uploaded successfully"
fi
