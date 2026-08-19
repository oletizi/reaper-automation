# reaper-automation -- task runner.
#
# Every real verb delegates to the repo's own CLI (`ra`, i.e. `tsx src/index.ts`).
# Host detection, ReaTooled section detection, artifact naming and staleness
# checks all live in the TypeScript and are deliberately NOT duplicated here --
# this file exists to bootstrap the toolchain and to make the verbs discoverable.

set shell := ["bash", "-euo", "pipefail", "-c"]

# List the verbs.
default:
    @just --list --unsorted

# The one button: bring this machine to the configured state.
# `just setup` previews everything; `just setup apply` performs it.
setup *args: _deps
    #!/usr/bin/env bash
    set -euo pipefail
    APPLY=""
    for a in {{ args }}; do
      case "$a" in apply|--apply) APPLY=1 ;;
        *) echo "setup: unknown argument '$a' (expected: apply)" >&2; exit 2 ;;
      esac
    done

    if [ -n "$APPLY" ] && pgrep -x reaper >/dev/null 2>&1; then
      echo "setup: REAPER is running." >&2
      echo "  It rewrites reaper.ini on exit, so preference changes would be discarded." >&2
      echo "  Quit REAPER and run this again." >&2
      exit 1
    fi

    echo "==> 1/3  preferences"
    if [ -n "$APPLY" ]; then pnpm ra prefs --apply; else pnpm ra prefs; fi

    echo
    echo "==> 2/3  desktop key grabs"
    if [ -n "$APPLY" ]; then pnpm ra wm --apply; else pnpm ra wm; fi

    echo
    echo "==> 3/3  keymap"
    if [ -n "$APPLY" ]; then
      pnpm ra refresh
      echo
      echo "One manual step remains, and no tool can do it: REAPER only reads"
      echo "reaper-kb.ini at startup, so if the run above said BINDINGS: changed,"
      echo "import once via Actions > Show action list > Key map > Import >"
      echo "LUNA (Pro Tools)."
    else
      # No dry run exists for refresh; doctor reports the same drift read-only.
      pnpm ra doctor || true
      echo
      echo "(preview only -- nothing changed; run \`just setup apply\` to perform it)"
    fi

# Install dependencies (idempotent; safe to re-run).
bootstrap: _pnpm
    pnpm install

# Build the keymap + scripts into build/. Extra flags pass through, e.g. --section 16.
build *flags: _deps
    pnpm ra build {{ flags }}

# Stage the built artifacts into REAPER's resource dir. Does not import anything.
install *flags: _deps
    pnpm ra install {{ flags }}

# Day-to-day verb: build, install, verify, and say whether a re-import is needed.
refresh *flags: _deps
    pnpm ra refresh {{ flags }}

# Report the source -> build -> installed -> last-fired version chain.
doctor *flags: _deps
    pnpm ra doctor {{ flags }}

# Apply declared DAW preferences (dry run without --apply).
prefs *flags: _deps
    pnpm ra prefs {{ flags }}

# Free the combos the Linux desktop grabs before REAPER sees them (dry run).
wm *flags: _deps
    pnpm ra wm {{ flags }}

# Regenerate KEYBINDINGS.md from the mapping table.
docs *flags: _deps
    pnpm ra docs {{ flags }}

# Search REAPER's action list, e.g. `just find zoom horizontal`.
find +terms: _deps
    pnpm ra find-action {{ terms }}

# Cross-reference our bindings against the live reaper-kb.ini.
report *flags: _deps
    pnpm ra report {{ flags }}

# Run the test suite.
test *flags: _deps
    pnpm test {{ flags }}

# Typecheck without emitting.
typecheck: _deps
    pnpm typecheck

# Fail if KEYBINDINGS.md has drifted from mappings/luna.toml.
docs-check: _deps
    pnpm ra docs --check

# Everything CI would run.
check: test typecheck docs-check

# Remove the generated staging dir (gitignored; `just build` regenerates it).
clean:
    rm -rf build

# Remove installed dependencies too.
clean-deps: clean
    rm -rf node_modules

# --- guards -----------------------------------------------------------------

# Fail loud if pnpm isn't on PATH, rather than half-running.
[private]
_pnpm:
    #!/usr/bin/env bash
    set -euo pipefail
    if ! command -v pnpm >/dev/null 2>&1; then
      echo "just: pnpm is not on PATH." >&2
      echo "  install it with one of:" >&2
      echo "    brew install pnpm" >&2
      echo "    npm install -g pnpm" >&2
      echo "    corepack enable && corepack prepare pnpm@latest --activate" >&2
      exit 1
    fi

# Self-heal a missing node_modules so no verb fails with a bare module error.
[private]
_deps: _pnpm
    #!/usr/bin/env bash
    set -euo pipefail
    if [ ! -d node_modules ]; then
      echo "==> node_modules missing; running pnpm install" >&2
      pnpm install
    fi
