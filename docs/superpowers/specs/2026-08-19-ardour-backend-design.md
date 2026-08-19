# Ardour backend — design record

Design record for roadmap item `design:feature/ardour-backend`.

Governed by [CONSTITUTION.md](../../../CONSTITUTION.md). Empirical grounding is
[docs/ardour-backend-investigation.md](../../ardour-backend-investigation.md)
(commit `917313b`), against Ardour 9.7.0.

House rules in force (`stack-control-design-v1`): **capture over YAGNI** — this
record captures everything known or knowably implied. Nothing here is scoped
down to a first increment; scoping is a separate, explicit, operator-driven pass
after capture.

---

## Problem domain

### What we are trying to do

Make the LUNA/Pro Tools **2D edit area** a first-class object in Ardour, on the
same terms the REAPER backend already achieves it — Constitution Principle 1
(operations act within the area's bounds; clip boundaries are irrelevant) and
Principle 5 (`Shift`+nav builds the area, outranking host defaults, identically
across OSes *and across DAWs*).

Principle 5 already names this work: *"as backends for other DAWs are added
(Ardour, others) … the 2D selection vocabulary is the portable core; per-DAW
action IDs and scripts are implementation beneath it."* So the shape of the
answer is constrained: the key layout is the invariant, and Ardour realization
sits underneath it.

### Why the current architecture cannot absorb it as-is

The codebase is single-DAW in five distinct places, and they fail differently:

| layer | REAPER-specific today | what Ardour needs |
| --- | --- | --- |
| `mappings/luna.toml` | binding kinds carry **numeric REAPER command IDs** (`action = 40044`) | string action names (`Transport/ToggleRoll`) |
| `src/keyspec.ts` | Win32 virtual keycodes + a numeric modifier bitmask | GDK keysym names + abstract modifier tokens |
| `src/actions.ts` | TSV of 10,578 numeric IDs, `byId()` lookup | name-keyed inventory, `byName()` lookup |
| `src/build-keymap.ts` | emits `KEY`/`ACT`/`SCR` lines | emits `<BindingSet>/<Bindings>/<Press>/<Binding>` XML |
| `src/*-template.ts` | ReaScript Lua against REAPER's API | Ardour Lua against Ardour's API, and only 9 of them |

Roughly 60% of the tree is already DAW-neutral and should not move: the CLI
skeleton, TOML validation, install staging, git stamping, and the
build/install/refresh/doctor verb *shapes*.

### The constraints Ardour actually imposes

From the investigation, all verified against 9.7.0:

1. **Modifiers are platform-abstract** (`Primary`/`Secondary`/`Tertiary`/`Level4`)
   and correspond 1:1 to this repo's Mac-native vocabulary on both platforms.
   One generated file serves macOS and Linux.
2. **Bindings are scoped to 12 contexts**, not a flat keymap. This replaces the
   ReaTooled `--section` problem with a designed mechanism — and it changes what
   "collision" means.
3. **Actions are strings**, validated by name.
4. **Only 9 bindable Lua slots exist** (`LuaAction/script-1`…`script-9`), stored
   base64 inside `~/.config/ardour9/ui_scripts` XML, rewritten when Ardour exits.
5. **There is no macro facility.** One key binds to exactly one action; REAPER's
   `ACT` custom actions have no counterpart. Any two-step gesture requires Lua.
6. **Several REAPER-scripted features are native**: `tab-to-transient-forwards`/
   `-backwards`, and `move-range-{start,end}-to-{next,previous}-region-boundary`.
7. **Keysym traps**: shifted punctuation uses the shifted keysym
   (`Tertiary-colon`, not `Tertiary-semicolon`) while letters stay lowercase;
   Shift+Tab is `ISO_Left_Tab` and Ardour binds *both* spellings.

### The budget problem, stated precisely

Gestures in the current mapping with **no** native Ardour action:

| gesture family | count |
| --- | --- |
| extend range to transient (fwd/back) | 2 |
| extend range to bar (fwd/back) | 2 |
| extend range to marker (fwd/back) | 2 |
| extend range to session start/end | 2 |
| extend range vertically (up/down) | 2 |
| **subtotal** | **10** |

Ten needed, nine available — and that is *before* counting a `razor_slice`
analogue (5 bindings), the `separate` fallback, and a Reload-button equivalent,
each of which would also want a slot. **A faithful port does not fit.** This is
the dominant constraint on the whole design.

### Cross-cutting concerns this touches

Captured, not deferred:

- **`KEYBINDINGS.md` generation** currently renders REAPER's macOS/Linux modifier
  columns. It gains a DAW dimension, and `ra docs --check` drift-gating must
  cover both backends.
- **`doctor`'s version chain** (source → build → installed → last-fired) has no
  straightforward Ardour analogue: scripts live inside `ui_scripts` XML rather
  than on disk, so "installed stamp" needs a different probe, and "last-fired"
  needs our Lua to write a debug log.
- **`refresh`'s central promise** — "script bodies changed → already live, no
  re-import needed" — does **not** hold. Ardour reads script bodies from its own
  XML, not from disk, so any script change requires a reload.
- **Install safety**: Ardour rewrites `ui_scripts` on exit, so installing while
  Ardour runs silently loses the install. Principle 2 demands this fail visibly,
  not silently — a running-Ardour guard is required, not optional.
- **Slot ownership and pruning**: REAPER's install prunes stale generated scripts.
  On Ardour we must clear the slots we own without clobbering the operator's own
  Lua scripts. The user's `ui_scripts` already contains two hand-installed
  scripts (*Mixer Screenshot*, *List Plugins*), so this hazard is live today.
- **`report`** cross-references `reaper-kb.ini`; it is REAPER-only unless an
  Ardour analogue is defined.
- **`find-action`** needs a name-search mode for Ardour.
- **`reatooled.ts`** section detection is REAPER-only and must not be invoked.
- **Ardour version and platform paths**: the config dir is version-suffixed
  (`~/.config/ardour9`, `~/.config/ardour8`). The macOS location is
  `~/Library/Preferences/Ardour9` — *unverified*.
- **The Super-key hazard persists.** `Level4` resolves to Mod4/Super on Linux, so
  LUNA's `Control+<key>` combos remain interceptable by GNOME exactly as they are
  under REAPER. What Ardour removes is the *translation bookkeeping*, not the
  hazard — `superWarning()`'s warning is still warranted and must be carried over.
  (This corrects an over-claim in the investigation document, fixed there.)
- **Context assignment** is a new, unavoidable design input: every binding must
  name the context it lands in, and nothing in the LUNA source says which.
- **Press vs Release**: Ardour's schema has both; the stock file uses only
  `<Press>`. Release bindings are out of the current vocabulary but the emitter
  should not foreclose them.

---

## Solution space

### Axis A — where per-DAW realization lives  *(decided)*

- **Chosen — inline per-DAW sub-tables.** One `mappings/luna.toml`; each
  `[[binding]]` keeps `luna` + `key` at top level and gains `[binding.reaper]` /
  `[binding.ardour]`. One row per gesture, both backends visible side by side.
- *Rejected — layout + target files* (`luna.toml` + `targets/{reaper,ardour}.toml`
  keyed by a semantic verb id). Cleanest separation in the abstract, but it
  requires naming a verb vocabulary **now**, and the investigation showed the two
  DAWs' mechanisms do not line up 1:1 (REAPER's `razor_extend` is one kind;
  Ardour splits it into a native action for clip edges and Lua for everything
  else). A vocabulary invented before the second implementation exists would be
  a guess. Revisit once Ardour is real — it is a refactor, not a rewrite.
- *Rejected — one table per DAW.* Ships fastest and duplicates the key layout,
  which is precisely the artifact the constitution says must not drift.

### Axis B — CLI backend selection  *(decided)*

- **Chosen — a `--daw <reaper|ardour>` flag** on the existing verbs, defaulting
  to REAPER for compatibility. Keeps one verb surface, preserves `just refresh`
  muscle memory, and pushes divergence into the backend module rather than the
  CLI grammar.
- *Rejected — namespaced verbs* (`ra ardour build`). Honest about divergent
  semantics but doubles the surface and splits the justfile.
- *Rejected — config-file default.* Least typing, but a build command would no
  longer say what it builds.

### Axis C — the Commands Focus / mouse-mode collision  *(decided)*

- **Chosen — displace outright**, and record it per Principle 3. LUNA's
  single-letter block is core to the project's premise; Ardour's mouse modes stay
  reachable from the toolbar.
- *Rejected — displace and relocate* the six mouse modes onto free combos. Kinder
  to Ardour idiom, but invents bindings LUNA does not define, and the relocation
  target would itself need a convention.
- *Rejected — preserve mouse modes* and leave six LUNA keys unmapped. Breaks the
  Commands Focus block that the project exists to deliver.

### Axis D — install target  *(decided)*

- **Chosen — stage + install.** Always write `build/luna-ardour.keys` (verifiable
  with `ardour9 -k <file>` without touching config); `ra install --daw ardour`
  copies it to the user bindings path. Mirrors the existing split where `install`
  stages and never activates.
- *Rejected — staged file only.* Safest, but gives up the one-command workflow.
- *Rejected — install to config only.* Gives up the `-k` test path, which is the
  cheapest verification this backend offers.

### Axis E — the 9-slot Lua ceiling  *(NOT decided — depends on open question 1)*

Captured alternatives, none chosen:

- **E1 — native-only.** Emit only bindings with native Ardour actions; mark the
  10 gaps `status = "unmapped"` with recorded reasons. Ships soonest and is
  honest, but abandons Principle 5's Shift+nav vocabulary on 8 of 10 axes, which
  is close to abandoning the project's premise on this backend.
- **E2 — spend all 9 slots** on the highest-value gestures; document the
  remainder as Principle 3 divergences. Requires a ranking nobody has made yet,
  and leaves zero slots for a Reload button or the operator's own scripts.
- **E3 — parameterized scripts.** Ardour action scripts support a `params()`
  mechanism; if one *script* can back several gestures the ceiling may be on
  distinct scripts rather than gestures. Each *instance* appears to occupy a
  slot, which would defeat this — unverified.
- **E4 — re-derive the gestures from Ardour primitives.** Ardour ships
  `Common/start-range` and `Common/finish-range` (set a range edge at the
  playhead). "Extend to next X" may be expressible as playhead-move + finish-range
  — but that is two actions, and Ardour has no macro facility, so it still lands
  in Lua unless Ardour's edit-point model makes the two-step unnecessary.
- **E5 — a different extension mechanism entirely.** Ardour has OSC, MIDI
  surfaces, and Lua *action hooks* (signal-driven, in `ui_scripts` alongside
  action scripts). A surface-based approach escapes the 9-slot cap but abandons
  the "one bindings file" model and adds a runtime dependency.

The choice among these is not free: it is gated on whether Ardour's range
operations honor range bounds (open question 1), because that determines how many
gestures need Lua at all.

### Axis F — key translation

- **Chosen — a dedicated Ardour keyspec emitter**, not a port of `keyspec.ts`.
  The existing parser (`parse()` → `{flags, keycode}`) stays as the front end
  since it already understands the LUNA spec syntax; a new renderer maps its
  output to `Primary-Secondary-Tertiary-Level4` + keysym, applying the
  shifted-punctuation table and dual `Tab`/`ISO_Left_Tab` emission.
- *Rejected — extending `describe()`* with an Ardour target. `describe()` produces
  human labels for comments; conflating it with a wire-format emitter would make
  both harder to test.

### Axis G — action validation source

- **Chosen — validate against a committed action inventory**, exactly as the
  REAPER backend validates against `data/reaper-actions-7.78.tsv`.
- **Unresolved sub-question**: today's inventory is the *partial* offline union
  (759 names). Validating against it would reject valid actions that are neither
  menued nor default-bound. Either the authoritative `ardour9 -A` dump replaces it
  before validation is enforced, or unknown-name handling degrades to a warning
  until it does. The former is preferred; Principle 2 disfavors silent
  acceptance, and a warning that everyone learns to ignore is a silent failure
  with extra steps.

### Axis H — context assignment

- **Chosen — an explicit `context` field** per Ardour binding, defaulting to
  `Editor`, with `Global` for transport-wide gestures. Explicit beats inferred:
  the collision checker needs it, and a wrong guess produces a binding that
  silently does nothing in the window the user is actually in.
- *Rejected — always `Global`.* Simplest, but `Global` bindings leak into the
  Mixer/Recorder windows where LUNA's editing vocabulary is meaningless.
- *Rejected — infer context from the action's group prefix.* Tempting
  (`Transport/*` → `Global`) but wrong in the stock file, which places
  `Region/*` actions inside the `Editor` context. Group ≠ context.

---

## Decisions

Operator-approved in session, 2026-08-19:

1. **Mapping table**: one `mappings/luna.toml`, per-DAW realization in
   `[binding.reaper]` / `[binding.ardour]` sub-tables. The `luna` name and `key`
   stay top-level and remain the portable invariant.
2. **CLI**: `--daw <reaper|ardour>` on existing verbs, defaulting to `reaper`.
3. **Mouse modes**: LUNA's Commands Focus block displaces Ardour's six mouse-mode
   keys; recorded as a Principle 3 divergence.
4. **Install**: build stages `build/luna-ardour.keys`; `install` copies it to the
   Ardour user bindings path. `install` never activates anything else.

Derived from verified facts, not operator judgment:

5. **Modifier correspondence** is fixed and total:
   `Cmd→Primary`, `Opt→Secondary`, `Control→Level4`, `Shift→Tertiary`.
6. **No `--target` for Ardour.** One emitted file serves macOS and Linux, because
   Ardour resolves the abstract modifiers per platform. The `superWarning()`
   hazard for `Control`/`Level4` on Linux still applies and is carried over.
7. **Shift+Tab emits both** `Tertiary-Tab` and `Tertiary-ISO_Left_Tab`, matching
   Ardour's own defensive pattern.
8. **Collision detection becomes context-scoped.** Two bindings sharing a combo in
   different contexts are legal; sharing one within a context is an error, and
   the build must still refuse to emit rather than pick a winner (Principle 2).
9. **Installs refuse while Ardour is running**, because `ui_scripts` is rewritten
   on exit and a silent loss violates Principle 2.

---

## Open questions

Ranked by how much downstream design they gate.

1. **Do Ardour's range operations honor range bounds, or widen to the region?**
   (Constitution Principle 1.) Decides whether a `razor_slice` analogue is needed
   at all, and feeds directly into the Axis E choice.
   *Test*: range covering 2.0s–3.5s of a 10s region on one track; run
   `Editing/editor-cut`, `editor-delete`, `Region/normalize-region`, and the
   fade/trim family; observe whether the region survives with a 1.5s hole.
2. **Can the 10 non-native gestures be served within 9 Lua slots?** (Axis E.)
   *Test*: instantiate one parameterized action script twice and see whether it
   consumes one slot or two.
3. **Is there a native vertical range-extend?** `select-next-stripable` /
   `select-prev-stripable` move the track selection; an *extend* variant was not
   found in the partial inventory and may simply be missing from it.
4. **What makes `ardour9 -A` emit?** Needed for a reproducible `dump-actions`
   step instead of a hand-run command. Currently it reaches the editor under Xvfb
   and exits without printing.
5. **Where does the user bindings file live, and is it auto-loaded?**
   `Gtkmm2ext::Keyboard::user_keybindings_path` exists, implying
   `~/.config/ardour9/ardour.keys` is picked up automatically — inferred, not
   verified. `-k <file>` is the verified path. Blocks decision 4's install target.
6. **Does `ui_scripts` accept source-only entries**, or is the compiled bytecode
   blob mandatory? Determines whether installing generated Lua is a text write or
   requires driving Ardour to compile.
7. **What is the macOS Ardour config path?** Assumed
   `~/Library/Preferences/Ardour9`; unverified, and `reaper-paths.ts`'s analogue
   must not guess.
8. **How should slot ownership be recorded** so `install` can prune our scripts
   without touching the operator's? The user's `ui_scripts` already holds two
   hand-installed scripts.
9. **Does `doctor` remain meaningful on Ardour**, given no on-disk installed
   artifact to stamp and no debug log unless our Lua writes one?

---

## Provenance

- **Roadmap item**: `design:feature/ardour-backend` (status `in-flight`), created
  2026-08-19; `design:` pointer set to this file before any content was written.
- **Compass**: `stackctl workflow compass design:feature/ardour-backend --intent
  design` → `on-course` (planned → designing), exit 0.
- **House rules**: `stack-control-design-v1` (capture-over-YAGNI, ≥2
  solution-space alternatives, required sections, operator approval, Spec Kit
  handoff, installation-anchored record).
- **Backend**: the default design backend (`superpowers:brainstorming`) is not
  installed in this environment; the exploration was driven in-session against
  the skill's capability contract (structured exploration, ≥2 alternatives per
  axis, in-session, operator approval gate).
- **Empirical basis**: [docs/ardour-backend-investigation.md](../../ardour-backend-investigation.md)
  at commit `917313b`, plus its reference data
  (`data/ardour-default-bindings-9.7.0.tsv`, `data/ardour-actions-9.7.0-partial.tsv`).
- **Software surveyed**: Ardour 9.7.0 at `/opt/Ardour-9.7.0`; stock bindings
  `/opt/Ardour-9.7.0/etc/ardour.keys`; menus `/opt/Ardour-9.7.0/etc/ardour.menus`;
  user config `~/.config/ardour9` (read only, never modified).
- **Governing documents**: [CONSTITUTION.md](../../../CONSTITUTION.md)
  Principles 1–5; [CLAUDE.md](../../../CLAUDE.md).
- **Operator decisions**: four choices recorded interactively on 2026-08-19
  (Axes A–D above).
- **Correction folded in**: the investigation document originally claimed Ardour
  eliminates the `superWarning()` Control→Super hazard. It eliminates the
  translation only; the Linux Mod4/Super interception hazard persists. Corrected
  in both documents.
