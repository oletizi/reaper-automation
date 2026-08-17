# Transient-navigation diagnostic

Headless harness to answer one question without any GUI clicking: **does
REAPER's native transient navigation (`40375`/`40376`) actually find transients
on a given machine/config/audio, or does it only stop at clip edges?**

It drives REAPER the same way `tools/dump_actions.lua` does — launch with
`-nosplash -new <media> <script>`, run a ReaScript, quit.

## Run

```sh
tools/diag/run.sh                 # fresh throwaway config + a synthesized click WAV
tools/diag/run.sh --cfg ~/Library/Application\ Support/REAPER/reaper.ini   # test YOUR settings
tools/diag/run.sh --wav /path/to/one/of/your/clips.wav                     # probe real audio
```

`REAPER_BIN=/path/to/reaper` overrides the executable; `TIMEOUT=<sec>` bounds the
run. Works on macOS and Linux.

## Reading it

Each `sweep` presses "next transient" repeatedly from the item start and logs
each landing as `EDGE` (item start/end) or `inside` (a detected internal
transient):

- **Landings go `inside`** → detection works; the action is fine.
- **Every landing is `EDGE`** → REAPER detected no transients (a
  sensitivity/threshold or audio-material issue), independent of our keymap
  script.

## Findings (REAPER 7.78, macOS arm64, 2026-08-17)

- On a **synthesized click WAV** with a **fresh default config**, `40375` walked
  to every click (`0.5 → 1.0 → 1.5 → 2.0 → 2.5`, all `inside`) — **even without
  calculating guides** and regardless of sensitivity. So the action mechanism
  and detection are sound out of the box; calculating guides (`42028`) is not
  required for `40375` to find transients.
- Seeding the probe with the **maintainer's real `reaper.ini`** made headless
  REAPER **hang (timeout)** — a blocking startup/modal under that config, not a
  macOS limitation. Isolating the offending setting/extension is the open thread.
- Implication for the keymap's Tab-to-Transient: when it lands only on clip
  edges in a real project, the audio/sensitivity is producing no transients —
  not the script calling the wrong action.
