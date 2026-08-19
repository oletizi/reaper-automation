# Constitution

The non-negotiable principles of this project. Everything else — the mapping
table, the generator, the scripts — is an implementation detail in service of
these. When a design decision conflicts with this document, this document wins.

## Why this project exists

Pro Tools and Universal Audio's LUNA treat a **2D edit area** — a span of time
across a set of tracks — as a first-class object you build with the keyboard and
then act on. Most other DAWs, REAPER included, do not. That absence is the
reason this repo exists. Conforming REAPER's keyboard shortcuts to LUNA's layout
is the visible goal; making the 2D edit area behave like a first-class concept
is the actual one.

## The shape this takes

The end state is **one command that configures every DAW we support the way the
operator wants it**, with no clicking through preference dialogs and no
per-machine fussing: key bindings, desktop key grabs, and application
preferences alike. Everything here is a step toward that, which is why the
capabilities live in a CLI with dry-run and verify semantics rather than in a
document telling someone what to click.

## Principle 1 — The edit area is the unit of work

**Operations act on the audio and MIDI data within, and only within, the bounds
of the 2D edit area. Clip boundaries are irrelevant to that.**

The area is defined by two independent axes, both keyboard-driven: a set of
tracks (vertical) and a time span (horizontal). Where existing clips happen to
start and stop plays no part in defining it and no part in scoping what an
operation touches.

Concretely, for an area covering 2.0s–3.5s of a 10-second clip:

- Delete removes that 1.5 seconds. It does not remove the clip.
- Cut lifts that 1.5 seconds to the clipboard. It does not lift the clip.
- Normalize normalizes that 1.5 seconds. It does not normalize the clip.

An area covering only part of a clip is the **normal case**, not an edge case.
An operation that widens its scope to the whole clip because the area touched
it is a bug, however convenient the underlying REAPER action makes it.

The keyboard vocabulary for building the area is stated in Principle 5.

### What this requires of an implementation

- An operation whose REAPER action is not area-aware must **split at the area
  bounds first**, then act on what lies inside. Splitting is a means of honoring
  the area, not a user-visible feature of the operation.
- Selecting whole items that intersect the area (`42957`, *Razor edit: Select
  media items within razor edit area*) is only correct for operations that are
  inherently whole-clip. It is **not** a general substitute for area scoping.
- Prefer a REAPER action that is natively razor-aware over a wrapper, since the
  native action already respects the bounds.

## Principle 2 — Fail visibly, never silently

A binding that cannot do its job must say so. The generator already refuses to
emit a dead key when a command ID doesn't exist or two bindings collide, and
`refresh` verifies installed bytes against the build rather than assuming.
Generated scripts hold to the same standard: a script that runs but accomplishes
nothing — an area that gets computed and then written nowhere, an operation that
finds no data to act on — is a defect, not acceptable behavior. When in doubt,
do the obvious thing rather than nothing.

## Principle 3 — Divergence from LUNA is deliberate and documented

Where a binding cannot match LUNA, it carries a `status` and a comment saying
why, rather than being silently approximated. The mapping table is the record of
those decisions; `mappings/luna.toml` explains every unmapped or aliased key.

## Principle 4 — Commit and push early; never hold work locally

**Work that is committed and pushed is safe. Work that is not, is not.** git plus
a GitHub remote is a journaled data store, and the asymmetry is total: a
committed, pushed change we dislike can always be rolled back, reverted, or
amended, while a change that was never committed cannot be retrieved by anyone
once it is lost. There is no symmetric risk to weigh — "wait until it's clean"
trades a recoverable outcome for an unrecoverable one.

So: commit at every point the work is coherent, and push the branch as soon as
it exists rather than at the end. Do not bank a series of commits locally
waiting for a milestone, and do not leave a working tree dirty across a pause.
A feature branch is the unit of "this might be wrong" — that is what makes
committing to it cheap, and what makes rolling it back cheap too.

Corollaries:

- Push a branch on its first commit, not its last. An unpushed branch is a
  single disk failure away from gone.
- Prefer several small commits that each say one thing over one large commit
  that says everything. Small commits are what make a rollback surgical.
- A commit is not a claim that the work is finished or correct; it is a
  savepoint. Reviewability comes from the branch and the PR, not from withholding
  commits.

## Principle 5 — Shift builds the area, and that outranks native defaults

**Shift is this project's reserved modifier for 2D selection.** `Shift` plus any
navigation key grows the edit area along that axis: `Shift+[` / `Shift+]` and the
Shift-variants of the clip-edge, transient and marker keys grow it horizontally;
`Shift+P` / `Shift+;` grow it vertically. A bare navigation key collapses the
area and moves the cursor. Shift means *select* here, always, with no exceptions
for a key the host DAW happens to want.

**This convention takes priority over any native default.** When a host DAW binds
something else to a `Shift+<nav>` combo, the combo goes to the selection gesture
and the native binding is displaced. That is not a regrettable side effect to be
minimized — it is the trade the project exists to make. `Shift+Tab` displacing
REAPER's *Toggle folder track* is the intended outcome, not an oversight.

**It also takes priority over consistency with the host in general.** The same
gesture must mean the same thing on macOS and on Linux, and — as backends for
other DAWs are added (Ardour, others) — in every DAW this project targets. The
2D selection vocabulary is the portable core; per-DAW action IDs and scripts are
implementation beneath it. A binding that is convenient in one backend but
breaks the shared vocabulary is wrong even where it is convenient.

**Third-party bindings rank below ours too.** The rule is not specific to a DAW's
own defaults: an extension or add-on that binds a combo we bind loses it.
ReaTooled is the live case — it keeps ~399 Main bindings in REAPER's section 16,
which takes precedence over an imported section-0 keymap, so our build emits into
section 16 when it detects ReaTooled and replaces the colliding bindings there.
A key we bind means what our mapping says it means, whatever else is installed.

Two things follow, and neither is a loophole:

- **Non-colliding bindings survive.** Importing a key map overrides only the
  combos the file names, so an extension keeps every shortcut we do not bind.
  Keeping the parts of ReaTooled you like is the default outcome, not a
  concession.
- **A collision is a decision to record, not an accident.** Where a displaced
  third-party binding is one worth keeping, the answer is to move *ours* to a
  free combo deliberately and say why (Principle 3) -- never to leave the
  collision undocumented and hope.

**Why it ranks this high.** A 2D edit area built entirely from the keyboard is
what makes a DAW nearly as fast to operate as a text editor. It is worth more
than almost any other keyboard accelerator, so when it competes with one, it
wins.

## Principle 6 — Configuration is captured, not reverse-engineered

**A setting's value comes from the application that owns it.** REAPER's
`reaper.ini` is thousands of undocumented keys wide and many are bitfields with
no published encoding; a plausible-looking guess writes a number into a file the
operator depends on, and a wrong guess corrupts a preference nobody was even
changing. So the workflow is snapshot → change it in the DAW's own UI → capture
the delta. What gets declared is a value the DAW itself produced.

This is also what makes the goal reachable across DAWs. Every DAW stores
preferences differently and none of them document it; capture is the only
acquisition method that does not require reverse-engineering each one.

Corollaries:

- **Never write a file the owning application has open.** REAPER rewrites
  `reaper.ini` wholesale on exit, so an edit made while it is running is
  discarded silently -- the same class of failure as writing GSettings through a
  backend the desktop does not read. Refuse, rather than appear to succeed.
- **Edit the line, not the file.** Parse-and-regenerate would drop everything we
  failed to model. Rewrite the exact key and leave every other byte alone.
- **Back up before writing, and verify by re-reading afterwards** (Principle 2).
