#!/usr/bin/env bash
# Headless transient-navigation diagnostic.
#
# Generates a click WAV (guaranteed transients), launches REAPER with a
# throwaway config, runs transient_probe.lua against it, and prints the result.
# Works on macOS and Linux. No GUI clicking required.
#
# Usage:
#   tools/diag/run.sh                 # fresh throwaway config (default sensitivity)
#   tools/diag/run.sh --cfg <ini>     # copy an existing reaper.ini first (test real settings)
#   tools/diag/run.sh --wav <file>    # probe a specific audio file instead of the click WAV
#
# Env:
#   REAPER_BIN   override the REAPER executable path
#   TIMEOUT      seconds before giving up (default 90)
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

cfg_src=""
wav=""
while [ $# -gt 0 ]; do
  case "$1" in
    --cfg) cfg_src="$2"; shift 2 ;;
    --wav) wav="$2"; shift 2 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

# Locate REAPER.
reaper="${REAPER_BIN:-}"
if [ -z "$reaper" ]; then
  for cand in \
    "/Applications/REAPER.app/Contents/MacOS/REAPER" \
    "$(command -v reaper 2>/dev/null || true)" \
    "/opt/REAPER/reaper" \
    "$HOME/opt/REAPER/reaper"; do
    if [ -n "$cand" ] && [ -x "$cand" ]; then reaper="$cand"; break; fi
  done
fi
if [ -z "$reaper" ] || [ ! -x "$reaper" ]; then
  echo "REAPER executable not found; set REAPER_BIN=/path/to/reaper" >&2
  exit 1
fi

# The audio: a specified file, or a freshly generated click WAV.
if [ -z "$wav" ]; then
  wav="$work/clicks.wav"
  node "$here/gen_clicks_wav.mjs" "$wav"
fi

# Config: throwaway, optionally seeded from an existing reaper.ini.
ini="$work/reaper.ini"
if [ -n "$cfg_src" ]; then
  cp "$cfg_src" "$ini"
  echo "seeded config from $cfg_src"
fi

out="$work/probe_out.txt"

# timeout may be `timeout` (GNU) or `gtimeout` (macOS coreutils); tolerate neither.
tmo="${TIMEOUT:-90}"
runner=(env "DIAG_OUT=$out")
if command -v timeout >/dev/null 2>&1; then runner=(timeout "$tmo" "${runner[@]}");
elif command -v gtimeout >/dev/null 2>&1; then runner=(gtimeout "$tmo" "${runner[@]}"); fi

echo "reaper: $reaper"
echo "wav:    $wav"
set +e
"${runner[@]}" "$reaper" -cfgfile "$ini" -nosplash -new "$wav" "$here/transient_probe.lua" >/dev/null 2>&1
code=$?
set -e
if [ "$code" -eq 124 ]; then
  echo "TIMED OUT after ${tmo}s -- REAPER did not quit (a modal dialog / blocking startup, often from a seeded config)."
fi

echo "=== probe output (exit $code) ==="
if [ -f "$out" ]; then cat "$out"; else echo "(no output file written)"; fi
