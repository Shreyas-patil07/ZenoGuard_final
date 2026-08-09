#!/usr/bin/env bash
set -e

apt-get update
apt-get install -y --no-install-recommends tesseract-ocr
pip install --no-cache-dir -r requirements.txt
