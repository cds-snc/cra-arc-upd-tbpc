#!/bin/bash

# This script is used to get around the issue of the duckdb node binding not being built when using --ignore-scripts

# We will create a temporary npm project and install duckdb there, then
# copy the node binding to the current project and clean up the temporary project

# First check if the binding actually happens to be built
if [ -f node_modules/duckdb/lib/binding/duckdb.node ]; then
    echo "DuckDB node binding already built, skipping..."
    exit 0
fi

echo "Building DuckDB node binding..."

mkdir temp-npm-project
cd temp-npm-project

npm init -y
npm install duckdb

echo "Copying DuckDB node binding..."
cp node_modules/duckdb/lib/binding/duckdb.node ../node_modules/duckdb/lib/binding/


echo "Cleaning up temporary project..."
cd ..
rm -rf temp-npm-project
