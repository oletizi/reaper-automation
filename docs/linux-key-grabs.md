# Linux: when a key never reaches REAPER

A record of one investigation, kept because most of it was wrong and the wrong
turns are the useful part. Symptom: on GNOME/Wayland, `Opt+Tab` and
`Opt+Shift+Tab` (Alt+Tab and Shift+Alt+Tab on Linux) never reached REAPER, so
LUNA's reverse tab-to-transient did nothing. Date: 2026-08-19.

## What it turned out to be

`gsettings set` was writing to a backend that was not dconf, and **GNOME reads
dconf**. The write reported success. `gsettings get` read the new value back
correctly. GNOME Shell never saw any of it. Every `ra wm --apply` was a silent
no-op, so nothing was ever freed — which is why a full logout changed nothing.

The one command that settles it, writing a sentinel no default could produce:

```sh
gsettings set org.gnome.desktop.wm.keybindings switch-applications "['<Super>F13']"
gsettings get  org.gnome.desktop.wm.keybindings switch-applications   # ['<Super>F13']
dconf    read /org/gnome/desktop/wm/keybindings/switch-applications    # (empty!)
```

Two views disagreeing is the whole diagnosis. `dconf read` is the one that
matches what the compositor acts on.

The fix, now in `ra wm`: write with `dconf write`, read back with `dconf read`,
and refuse to report success on a mismatch. Reads prefer dconf and fall back to
the gsettings schema default only where the key is genuinely unset.

## The wrong turns, and what would have caught them sooner

**"It's an X11 session."** `DISPLAY=:0` was set and `mutter-x11-frames` was
running, so the session looked like X11 and the advice was "press Alt+F2, type
`r` to restart GNOME Shell in place." Both signals appear under **XWayland**
too. The session was Wayland, where no in-place restart exists at all, so the
advice was not merely unhelpful — it was impossible to follow.

Ask logind, which knows:

```sh
loginctl list-sessions --no-legend
loginctl show-session <id> -p Type -p Active -p Seat   # Type=wayland
```

`ra wm` now does this and prints only the remedy that exists.

**"The grab is stale; restart the compositor."** Plausible, and it cost a
logout to disprove. It survived as long as it did because the config *looked*
correct — `gsettings get` was reporting exactly what we wanted to see. A theory
that rests on a reading from the same tool that made the change is not
independent evidence.

**"Something else must be grabbing it."** An exhaustive sweep of every schema
found nothing binding `<Alt>Tab`, which felt like a dead end. It was actually
the strongest clue available: config clean + behavior unchanged means the config
being read is not the config in force.

## The general lesson

**Verify a change through the channel its consumer reads, not the one you wrote
it with.** This repo already applies that rule elsewhere and it was earned the
same way: `refresh` re-reads the installed bytes and compares them against the
build rather than trusting that the copy succeeded, and `doctor` reports the
source → build → installed → last-fired chain instead of assuming they agree.
A write-side success report is not evidence of anything.

Corollary for this codebase: a silent no-op is the worst failure mode a verb can
have, because it tells the operator the problem is solved and sends them looking
somewhere else. See CONSTITUTION.md, Principle 2.

## Diagnostic order for "this key never reaches REAPER"

1. **Is REAPER bound at all?** `grep -E '^KEY .* <keycode> ' ~/.config/REAPER/reaper-kb.ini`.
   Absent means the keymap was never imported — `refresh` prints `BINDINGS:
   changed` when a re-import is needed.
2. **Did the script run?** `tail ~/.config/REAPER/luna-debug.log`. A line means
   the key reached REAPER and the problem is in the script; no line ever, for
   that script, means the key never arrived.
3. **Is the desktop swallowing it?** `ra wm` reports every combo the desktop
   grabs that we also bind.
4. **Did freeing it actually take?** `dconf read <path>` — not `gsettings get`.
5. **Does the compositor need restarting?** X11: Alt+F2, `r`. Wayland: log out.
   Only after step 4 confirms the value really changed.
