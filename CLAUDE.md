# Working in this repo

Read [CONSTITUTION.md](CONSTITUTION.md) first. It states what this project is
for and the principles that govern design decisions here; it wins over
convenience, over the shape of the underlying REAPER action, and over anything
in this file.

The short version: this repo exists to make Pro Tools' **2D edit area** — a time
span across a set of tracks — behave like a first-class concept in REAPER. An
operation acts on the data within the area's bounds; **clip boundaries are
irrelevant to that**, and an area covering part of a clip is the normal case.

## Shift is the selection modifier (Constitution, Principle 5)

`Shift` + any navigation key grows the 2D area; a bare navigation key collapses
it. This vocabulary outranks the host DAW's native defaults — displacing a native
binding to keep a `Shift+<nav>` combo is the intended trade, not a regression.
It must also stay identical across macOS/Linux and across any DAW backend added
later, so never break it for a host-specific convenience.

Third-party bindings rank below ours as well. On a machine with ReaTooled the
build auto-detects its section 16 and emits there, replacing the colliding
bindings; everything ReaTooled binds that we do not is untouched. Installing or
removing ReaTooled changes the target section, so run `just refresh` and
re-import afterwards.

## Commit and push early (Constitution, Principle 4)

- **Push a feature branch on its first commit, not its last.** Committed and
  pushed work can always be rolled back; uncommitted work that is lost is gone.
- Commit at every coherent point. Small commits that each say one thing.
- Never leave a dirty working tree across a pause in the work.

## The workflow

```sh
just               # list the verbs
just bootstrap     # first time (or if node_modules is missing)
just refresh       # build + install + verify, and say if a re-import is needed
just doctor        # is what's running what I built?
just check         # tests + typecheck + KEYBINDINGS.md drift check
just wm            # what the Linux desktop grabs before REAPER sees it
```

On a new Linux machine, run `just wm --apply` once: GNOME grabs `Alt+Tab` and
`Shift+Alt+Tab` before any application sees them, which shadows LUNA's reverse
tab-to-transient. Freeing them is Principle 5 applied to the desktop — and it
costs nothing, since GNOME already binds `Super+Tab` to the same action.
`just wm --revert --apply` puts GNOME's defaults back. If the desktop still
swallows a freed combo, work through the checklist in
[docs/linux-key-grabs.md](docs/linux-key-grabs.md) -- and verify config changes
with `dconf read`, never `gsettings get`, which can report a write that GNOME
never saw. And remember a GSettings default can differ per desktop profile: read
defaults as
`GSETTINGS_BACKEND=memory XDG_CURRENT_DESKTOP=<profile> gsettings get ...`,
since an agent shell usually has no `XDG_CURRENT_DESKTOP` and will resolve a
different value than GNOME does.

`mappings/luna.toml` is the thing you edit; everything else in `build/` is
generated. `KEYBINDINGS.md` is generated too (`just docs`) — never hand-edit it.

## Before adding or changing a binding

1. Check what it would displace: [docs/reaper-default-shortcuts.md](docs/reaper-default-shortcuts.md).
   That file is third-party and partial, so treat absence as unknown, not free —
   REAPER's own action list is authoritative. Note that displacing a default is
   *expected* for a `Shift+<nav>` combo (Principle 5); the check is to make it a
   decision, not to avoid the collision.
2. Check LUNA's own layout in `data/luna-shortcuts-macos-raw.tsv`. A combo LUNA
   uses elsewhere is not free even if we don't bind it yet.
3. Pick the right mechanism. `razor_slice` splits at the area edges first and is
   the default for an operation that should honor the area; `razor` acts on whole
   clips and is correct only for inherently whole-clip operations (Heal,
   Consolidate, the cursor-relative fades and trims). Delete and Cut need
   neither — they honor the area natively.
4. A divergence from LUNA carries a `comment` saying why (Principle 3).

## Verifying REAPER behavior

Claims about what a REAPER action does to the razor area are **empirical**, not
inferred. `docs/superpowers/specs/2026-08-16-razor-area-substrate-design.md`
records what has actually been verified on 7.78. Generated scripts log to
`<resource-dir>/luna-debug.log`, which is the record for "I pressed the key and
nothing happened" — it shows which script fired, at which version, what state it
saw, and what it did.
