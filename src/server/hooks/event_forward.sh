#!/bin/sh
# Lattice Context Analyzer - Generic event hook for Claude Code
# Used for: SessionStart, Stop, PreCompact, PostCompact, UserPromptSubmit
# Reads JSON from stdin, forwards to Lattice server
set -e

EVENT_TYPE="$1"
if [ -z "$EVENT_TYPE" ]; then
  exit 0
fi

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
SESSION_ID=$(printf '%s' "$INPUT" | grep -o '"session_id"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*:.*"\(.*\)"/\1/')
TIMESTAMP=$(date +%s000)

curl -s -X POST "http://127.0.0.1:$PORT/api/hook/event" \
  -H "Content-Type: application/json" \
  -d "{\"event_type\":\"$EVENT_TYPE\",\"session_id\":\"$SESSION_ID\",\"timestamp_ms\":$TIMESTAMP}" \
  >/dev/null 2>&1 || true

exit 0
