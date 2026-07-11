#!/usr/bin/env bash

set -euo pipefail

report_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
diagram_dir="$report_dir/Chapter3/diagrams"
puppeteer_config="$report_dir/puppeteer-config.json"
output_dir="${1:-$diagram_dir}"

if ! command -v mmdc >/dev/null 2>&1; then
  echo "mmdc is not available in PATH" >&2
  exit 1
fi

mkdir -p "$output_dir"

for source in "$diagram_dir"/*.mmd; do
  output="$output_dir/$(basename "${source%.mmd}.pdf")"
  echo "Rendering $(basename "$source")"
  mmdc \
    --puppeteerConfigFile "$puppeteer_config" \
    --input "$source" \
    --output "$output" \
    --theme neutral \
    --backgroundColor white \
    --pdfFit
done
