#!/usr/bin/env bash

set -euo pipefail

report_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
build_dir="${1:-/tmp/yoca-final-report-build}"

if ! command -v latexmk >/dev/null 2>&1; then
  echo "latexmk is not available in PATH" >&2
  exit 1
fi

mkdir -p "$build_dir"
while IFS= read -r source_dir; do
  relative_dir="${source_dir#"$report_dir"/}"
  mkdir -p "$build_dir/$relative_dir"
done < <(find "$report_dir" -type d -print)

cd "$build_dir"
TEXINPUTS=".:$report_dir//:" \
BIBINPUTS=".:$report_dir//:" \
latexmk \
  -pdf \
  -interaction=nonstopmode \
  -halt-on-error \
  -jobname=yoca-final-report \
  "$report_dir/main.tex"

echo "Built $build_dir/yoca-final-report.pdf"
