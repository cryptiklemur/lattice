#!/bin/sh
# Lattice Context Analyzer - Statusline hook for Claude Code
# Reads context window JSON from stdin, posts raw JSON to Lattice for server-side parsing
set -e

# Derive LATTICE_HOME from this script's install location (hooks/ is inside LATTICE_HOME)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LATTICE_HOME="${SCRIPT_DIR%/hooks}"
CONFIG="$LATTICE_HOME/config.json"

PORT=7654
if [ -f "$LATTICE_HOME/port" ]; then
  PORT=$(cat "$LATTICE_HOME/port" 2>/dev/null || echo 7654)
elif [ -f "$CONFIG" ]; then
  P=$(grep -o '"port"[[:space:]]*:[[:space:]]*[0-9]*' "$CONFIG" 2>/dev/null | grep -o '[0-9]*$' || true)
  [ -n "$P" ] && PORT="$P"
fi

INPUT=$(cat)

# Post raw JSON to Lattice -- server handles parsing
curl -s -X POST "http://127.0.0.1:$PORT/api/hook/statusline" \
  -H "Content-Type: application/json" \
  -d "$INPUT" >/dev/null 2>&1 || true

exit 0
