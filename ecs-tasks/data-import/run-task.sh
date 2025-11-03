#!/bin/bash
set -e

echo "Starting data import task..."
uv run --no-sync --directory=src mongo_parquet --import-to-mongo --from-remote --storage=s3

if [ $? -ne 0 ]; then
  echo "An error occurred during the data import."
  exit 1
fi

echo "Data import completed successfully."

echo "Recalculating views..."
uv run --no-sync --directory=src mongo_parquet --recalculate-views --storage=s3

if [ $? -ne 0 ]; then
  echo "An error occurred during views recalculation."
else
  echo "Views recalculated successfully."
fi
