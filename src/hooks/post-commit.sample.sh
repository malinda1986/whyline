#!/usr/bin/env bash
set -euo pipefail

if command -v coding-memory >/dev/null 2>&1; then
  echo ""
  echo "You can save AI coding memory for this commit:"
  echo "  coding-memory save --commit HEAD --summary-file memory.md"
  echo ""
fi
