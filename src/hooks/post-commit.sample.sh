#!/usr/bin/env bash
set -euo pipefail

if command -v whyline >/dev/null 2>&1; then
  echo ""
  echo "You can save AI coding memory for this commit:"
  echo "  whyline save --commit HEAD --summary-file memory.md"
  echo ""
fi
