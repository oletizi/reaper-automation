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
