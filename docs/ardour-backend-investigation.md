# Ardour backend — investigation findings

Empirical survey of Ardour's customization surfaces, run against **Ardour 9.7.0**
installed at `/opt/Ardour-9.7.0` (user config `~/.config/ardour9`) on 2026-08-19.
No design decisions are made here; this is the input a design pass needs.

Per [CLAUDE.md](../CLAUDE.md), claims about DAW behavior are empirical. Every
claim below is marked:

- **[verified]** — read out of the shipped files or observed on this machine
- **[inferred]** — follows from a verified fact but not directly observed
- **[open]** — needs a running Ardour to settle

Reference data captured alongside this document:

| file | what |
| --- | --- |
| `data/ardour-default-bindings-9.7.0.tsv` | all 442 stock bindings, with binding context |
| `data/ardour-actions-9.7.0-partial.tsv` | 759 action names (see *Action inventory* for why "partial") |
| `docs/ardour-displacement-report.md` | what this repo's layout would displace |

---

## 1. Keybindings are XML, and the modifiers are already portable

**[verified]** Ardour's bindings live in one XML file, `/opt/Ardour-9.7.0/etc/ardour.keys`:

```xml
<BindingSet name="ardour.keys.in">
 <Bindings name="Editor">
  <Press>
   <Binding key="Primary-Tertiary-z" action="Editing/alternate-alternate-redo" group="Shared Editing"/>
```

Modifiers are **abstract**, resolved per-platform by Ardour itself. The
correspondence with this repo's Mac-native vocabulary is exact, on both
platforms:

| this repo | REAPER flag | Ardour token | macOS | Linux |
| --- | --- | --- | --- | --- |
| `Cmd` | `+8` | `Primary` | Command | Ctrl |
| `Opt` | `+16` | `Secondary` | Option | Alt |
| `Control` | `+32` | `Level4` | Control | Super |
| `Shift` | `+4` | `Tertiary` | Shift | Shift |

**[verified]** `Tertiary` is Shift, not Secondary — `Primary-Tertiary-z` is
`Editing/alternate-alternate-redo`, i.e. Ctrl+Shift+Z = redo. Secondary is
Alt/Option (`Secondary-equal` = `Editor/expand-tracks`).

Consequence: **the whole `--target macos|linux` translation axis disappears on
the Ardour side.** `describe()`'s per-platform labelling and `superWarning()`'s
Control→Super hazard are REAPER-specific problems that Ardour solves upstream.
One generated bindings file serves both platforms.

### Keysyms, and two traps

**[verified]** Keys are GDK keysym names, not characters: `equal`, `minus`,
`bracketright`, `apostrophe`, `BackSpace`, `Page_Up`, `KP_0`–`KP_9`, `F1`–`F12`.

Trap 1 — **shifted punctuation uses the shifted keysym**, while letters stay
lowercase. Shift+`;` is `Tertiary-colon`, not `Tertiary-semicolon`. Observed in
stock bindings: `quotedbl` `colon` `bar` `underscore` `question` `less`
`greater` `braceleft` `braceright`. Letters do *not* follow this rule —
Shift+E is `Tertiary-e`.

Trap 2 — **Shift+Tab is `ISO_Left_Tab`**, and Ardour hedges by binding *both*
forms to the same logical gesture:

```
Tertiary-Tab               -> Notes/add-select-next
Tertiary-ISO_Left_Tab      -> Notes/alt-add-select-next
```

This matters directly: Constitution Principle 5 names Shift+Tab explicitly. A
generator must emit both spellings or the gesture will misfire depending on the
user's XKB configuration.

### Binding contexts replace REAPER's section problem

**[verified]** Bindings are scoped to one of 12 contexts, not a flat keymap:

```
Editor 132   Global 90   MIDI 56   Mixer 50   Step Editing 50   Editing 21
Monitor Section 14   Cues 12   Automation 8   Recorder 5   Processor Box 2   RegionFx Box 2
```

This is the structural counterpart to the ReaTooled `--section 16` workaround,
except it is a designed feature rather than a collision to detect. A binding
emitted into `Editor` does not disturb `MIDI` or `Step Editing`.

---

## 2. Actions are strings; the authoritative list needs a running Ardour

**[verified]** Actions are `Group/action-name` (`Editing/redo`,
`Editor/split-region`), not numeric IDs. Validation is name-based, so the
REAPER `data/reaper-actions-7.78.tsv` pattern carries over with the ID column
replaced by a name.

**[verified]** `ardour9 --help` documents the dump path:

```
-A, --actions      Print all possible menu action names
-b, --bindings     Display all current key bindings
-k, --keybindings <file>   Path to the key bindings file to load
```

`-k` is worth noting on its own: **a generated bindings file can be loaded for
testing without installing it.** REAPER has no equivalent — there, verifying a
keymap means importing it.

### Why the inventory is "partial"

**[verified]** `ardour9 -A` does not print until a session has loaded and the
audio engine has started. Headless it stalls on the Audio/MIDI Setup dialog. I
drove it under Xvfb — dummy backend selected, Start clicked via `xdotool` — and
Ardour proceeded to the editor and then exited *without* emitting the list.
Whatever the remaining condition is, it is **[open]**.

So the committed inventory is built offline from two shipped files:

- `ardour.keys` → 441 actions that carry a default binding (qualified `Group/name`)
- `ardour.menus` → 520 menu-reachable action names (bare, no group)

Union: **759 bare names**, of which 374 are menu-only (no default binding).
What this misses is any action that is neither in a menu nor bound by default.

**To get the authoritative list**, on a desktop session where Ardour's engine
starts normally:

```sh
ardour9 -A -N /tmp/probe > ardour-actions-9.7.0.txt
```

That should replace `data/ardour-actions-9.7.0-partial.tsv` before any
generator validates against it.

---

## 3. Ardour has natively what this repo built scripts for — partially

The REAPER backend compiles 27 of 110 bindings into generated ReaScripts or
macros because REAPER lacks the primitive. Ardour's action names show a
different picture.

**[verified] Native, no script needed:**

| this repo | Ardour action |
| --- | --- |
| `tab_transient = "next"` / `"prev"` (2 scripts) | `tab-to-transient-forwards` / `-backwards` |
| `separate` (2 scripts) | `Editor/split-region` |
| range edge → clip edge (4 of 13 `razor_extend`) | `move-range-{start,end}-to-{next,previous}-region-boundary` |

The `move-range-*` family is the significant one. Cumulative range-edge
extension — grow the correct edge, hold the anchor — is exactly what
`razor-extend-template.ts` exists to synthesize, and Ardour ships it as four
plain actions.

**[verified] No native equivalent found** — the range-move family covers
*region boundaries only*. There is no `move-range-*-to-next-transient`,
`-to-marker`, or bar-wise variant in the 759-name inventory. The repo's 13
`razor_extend` bindings span five nav axes:

| axis | REAPER ids | Ardour native range-move? |
| --- | --- | --- |
| clip edge | 41167 / 41168 | **yes** |
| transient | 40375 / 40376 | no |
| bar | 41042 / 41043 | no |
| marker | 40172 / 40173 | no |
| session start/end | 40042 / 40043 | no |

**[verified]** Ardour does have `Common/start-range` and `Common/finish-range`
(bound to `comma` / `period` by default), which set a range edge at the
playhead. Combined with a playhead-move action that would compose into
"extend to next X" — but **[verified]** an Ardour `<Binding>` maps one key to
exactly one action. Ardour has no custom-action/macro facility equivalent to
REAPER's `ACT` lines, so any two-step gesture requires Lua.

---

## 4. The Lua ceiling is the sharpest constraint

**[verified]** Ardour exposes exactly **9** bindable Lua action slots,
`LuaAction/script-1` … `script-9` (from `ardour.menus`; the Editor's *Lua
Scripts* menu lists nine entries and no more).

**[verified]** They are not loose files. Ardour stores instantiated action
scripts base64-encoded — source *and* compiled bytecode — inside
`~/.config/ardour9/ui_scripts` XML, rewritten when Ardour exits. Contrast
REAPER, where a generated `.lua` gets an `SCR` line and a stable command ID,
with no practical limit.

Two operational consequences **[inferred]**:

- Installing scripts means editing `ui_scripts`, which Ardour overwrites on
  exit — so **installs must happen with Ardour closed**, the same hazard class
  as `reaper-kb.ini`.
- The REAPER backend's "script bodies changed → already live, no re-import
  needed" shortcut does not hold. Ardour reads script bodies out of its own
  XML, not off disk, so any script change needs a reload.

### The budget does not currently fit

Gestures with no native Ardour action, from the current mapping:

| need | count |
| --- | --- |
| extend range to transient (fwd/back) | 2 |
| extend range to bar (fwd/back) | 2 |
| extend range to marker (fwd/back) | 2 |
| extend range to session start/end | 2 |
| extend range vertically (up/down) | 2 |
| **subtotal** | **10** |

That is already over 9 before `razor_slice`'s split-at-bounds behavior (5
bindings) is considered. **A faithful port does not fit the slot budget** — this
is the finding most likely to shape the design.

Possible escapes, all **[open]**:

- whether one Lua script can serve several gestures (Ardour scripts support a
  `params()` mechanism, but each *instance* appears to occupy a slot);
- whether Ardour's own range handling covers more than the action names suggest;
- reducing scope — take the native clip-edge extension, spend slots on the
  highest-value remaining axes, and document the rest as Principle 3 divergences.

---

## 5. Principle 1 — the question the action names cannot answer

Constitution Principle 1 requires operations to act **within the area's bounds,
with clip boundaries irrelevant**. Ardour's model looks structurally right:
its range selection is genuinely 2D (a time span across selected tracks), which
is the object the REAPER backend had to synthesize out of razor edits.

But whether `Editing/editor-cut`, `editor-delete`, `Region/normalize-region`
and the fade/trim family **scope to the range or widen to the region** is
**[open]** and cannot be settled from action names. It is the single most
important empirical question for the backend, because it decides whether Ardour
needs a `razor_slice` analogue at all.

The test is cheap once Ardour runs: place a range covering 2.0s–3.5s of a
10-second region on one track, run each candidate action, observe whether the
region survives with a 1.5s hole or is consumed whole.

---

## 6. What this repo's layout displaces

Full table in [ardour-displacement-report.md](ardour-displacement-report.md).
Of 105 bindings in `KEYBINDINGS.md`:

| | count |
| --- | --- |
| collide in a context we would emit into (`Editor`/`Editing`/`Global`) | 68 |
| collide only in contexts we would not touch (MIDI, Mixer, Step Editing…) | 4 |
| free in Ardour | 33 |

**[verified]** The highest-impact cluster is the single-letter *Commands
Keyboard Focus* block, which lands on Ardour's **mouse-mode** keys:

```
C -> Editing/set-mouse-mode-cut        D -> Editing/set-mouse-mode-draw
E -> Editing/set-mouse-mode-content    G -> Editing/set-mouse-mode-object
R -> Editing/set-mouse-mode-range      T -> Editing/set-mouse-mode-timefx
```

Principle 5's automatic win covers `Shift+<nav>` combos; these are bare letters
on mouse modes, so they are Principle 3 territory — a deliberate divergence
that needs recording, not an automatic trade. Ardour users lean on those keys
heavily.

Also notable **[verified]**: plain `Tab` is `Common/add-location-from-playhead`
(drop a marker) in Ardour, which this repo would take for Tab-to-Transient.

---

## Open questions, ranked

1. **Do Ardour's range operations honor range bounds?** (§5) Decides whether a
   `razor_slice` analogue is needed at all.
2. **Can the 10 non-native gestures fit 9 Lua slots?** (§4) Decides whether the
   port is faithful or scoped.
3. **Is there a native vertical range-extend?** `select-next-stripable` /
   `select-prev-stripable` move the track selection; an *extend* variant was not
   found in the partial inventory.
4. **What makes `ardour9 -A` emit?** (§2) Needed for a reproducible
   `dump-actions` step rather than a hand-run command.
5. **Where does a user bindings file live and how is it selected?** The symbol
   `Gtkmm2ext::Keyboard::user_keybindings_path` exists, suggesting
   `~/.config/ardour9/ardour.keys` is picked up automatically, but this is
   **[inferred]**, not verified. `-k <file>` is the verified path.
