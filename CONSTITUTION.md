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

