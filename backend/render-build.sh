#!/usr/bin/env bash
set -e

apt-get update
apt-get install -y --no-install-recommends tesseract-ocr

export YOLO_CONFIG_DIR=/tmp/Ultralytics
export OMP_NUM_THREADS=1
export MKL_NUM_THREADS=1

pip install --no-cache-dir -r requirements.txt
