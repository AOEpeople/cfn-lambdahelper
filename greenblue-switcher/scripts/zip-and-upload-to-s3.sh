#!/usr/bin/env bash

# Exit immediately if a command exits with a non-zero status.
set -e

if [ -z "$1" ] ; then echo "Please provide path to s3 bucket and key (e.g. s3://mybucket/lambda/foo.zip)"; exit 1; fi
if [ ! -f "package.json" ] ; then echo "File package.json not found. Are you in the correct directory?"; exit 1; fi

TMP=$(mktemp -d)
echo "Created temp dir: ${TMP}"
cp *.js *.json ${TMP}/
cd "${TMP}"
npm install --production
zip -r tmp.zip .
aws s3 cp tmp.zip "$1"
rm -rf "${TMP}"