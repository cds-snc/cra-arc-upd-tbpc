#!/bin/bash

set -e

# take optional -b argument to specify branch to checkout
while getopts b: flag; do
  case "${flag}" in
  b) branch=${OPTARG} ;;
  esac
done

sudo wget -O /etc/ssl/global-bundle.pem https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem

curl https://get.volta.sh | bash

source ~/.bashrc

volta install node@24
source ~/.bashrc

git clone https://github.com/cds-snc/cra-arc-upd-tbpc.git

cd cra-arc-upd-tbpc

git fetch origin

if [ -n "$branch" ]; then
  git checkout $branch
fi

npm install
