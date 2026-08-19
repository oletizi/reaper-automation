# REAPER default keyboard shortcuts

Reference copy of REAPER's stock key bindings, so a proposed binding can be
checked against what it would displace without guessing.

## Provenance and caveats

- **Source:** *Reaper Keyboard Shortcuts: Complete Cheat Sheet (2026)*,
  audeobox.com, dated 2026-02-15. Retrieved 2026-08-19.
  <https://www.audeobox.com/learn/reaper/reaper-keyboard-shortcuts-cheat-sheet/>
- **Third-party, not Cockos documentation.** A hand-written cheat sheet of what
  its author considered essential: REAPER ships over 3,000 actions and this
  lists about 80 bindings. **Absence from these tables is not evidence that a
  combo is free.**
- Several rows are context-qualified ("with track selected", "with no time
  sel"), because REAPER shortcuts are context-sensitive. A combo can mean
  different things depending on what has focus.
- Authoritative check, on the machine that matters: REAPER -> Actions -> Show
  action list, filter, read the shortcut column. That reflects your install
  including extensions such as ReaTooled; this file cannot.
- Extracted mechanically from the saved HTML; each row keeps the source's own
  wording. The article's "Battle Combo" section is omitted -- prose workflow
  sequences, not key bindings.

## Transport and Navigation

| Action | Windows | macOS | We rebind it |
| --- | --- | --- | --- |
| Play / Stop | `Space` | `Space` | **Toggle Playback** |
| Pause | `Enter` | `Return` | **Return To Zero** |
| Record | `Ctrl+R` | `Cmd+R` |  |
| Stop and move cursor to start | `W` | `W` | **Scroll To Right Selection (Commands Focus)** |
| Move cursor to project start | `Home` | `Home` |  |
| Move cursor to project end | `End` | `End` |  |
| Move cursor left by grid | `Left` | `Left` |  |
| Move cursor right by grid | `Right` | `Right` |  |
| Move cursor to next beat | `. (period)` | `. (period)` | **Nudge Right** |
| Move cursor to previous beat | `, (comma)` | `, (comma)` | **Nudge Left** |
| Toggle repeat / loop | `R` | `R` | **Zoom Out (Commands Focus)** |
| Toggle metronome | `Ctrl+Shift+M` | `Cmd+Shift+M` |  |
| Zoom in horizontally | `+ or Ctrl+=` | `+ or Cmd+=` |  |
| Zoom out horizontally | `-` | `-` |  |
| Zoom to fit project | `Ctrl+Shift+E` | `Cmd+Shift+E` |  |
| Zoom to time selection | `Ctrl+Shift+Z` | `Cmd+Shift+Z` | **Redo** |
| Scroll view left | `Alt+Left` | `Option+Left` |  |
| Scroll view right | `Alt+Right` | `Option+Right` |  |

## Editing Shortcuts

| Action | Windows | macOS | We rebind it |
| --- | --- | --- | --- |
| Split Item at cursor | `S` | `S` | **Trim From Clip End** |
| Undo | `Ctrl+Z` | `Cmd+Z` | **Undo** |
| Redo | `Ctrl+Shift+Z` | `Cmd+Shift+Z` | **Redo** |
| Cut selected Items | `Ctrl+X` | `Cmd+X` | **Cut** |
| Copy selected Items | `Ctrl+C` | `Cmd+C` | **Copy** |
| Paste | `Ctrl+V` | `Cmd+V` | **Paste** |
| Duplicate Items | `Ctrl+D` | `Cmd+D` | **Duplicate selection** |
| Delete selected Items | `Delete` | `Delete` |  |
| Glue selected Items | `Ctrl+Shift+G` | `Cmd+Shift+G` |  |
| Group selected Items | `G` | `G` | **Fade To Clip Stop (Fade Out)** |
| Ungroup selected Items | `U` | `U` |  |
| Toggle snap to grid | `Alt+S` | `Option+S` |  |
| Dynamic split | `D` | `D` | **Fade To Clip Start (Fade In)** |
| Heal split (rejoin) | `H` | `H` |  |
| Select all Items | `Ctrl+A` | `Cmd+A` | **Select All** |
| Open Item Properties | `F2` | `F2` |  |
| Cycle through Takes | `T` | `T` | **Zoom In (Commands Focus)** |
| Nudge Item left | `N, then configure` | `N, then configure` | **Normalize Selection** |

## Track Management

| Action | Windows | macOS | We rebind it |
| --- | --- | --- | --- |
| Insert new track | `Ctrl+T` | `Cmd+T` | **Trim Clip to Selection** |
| Delete selected tracks | `Ctrl+Delete` | `Cmd+Delete` |  |
| Toggle track mute | `M (with track selected)` | `M (with track selected)` | **Nudge Left Next Amount** |
| Toggle track solo | `S (with track selected, no Items)` | `S (with track selected, no Items)` | **Trim From Clip End** |
| Toggle record arm | `Ctrl+Shift+R` | `Cmd+Shift+R` |  |
| Rename selected track | `F2 (with track header selected)` | `F2 (with track header selected)` |  |
| Move track up | `Alt+Shift+Up` | `Option+Shift+Up` |  |
| Move track down | `Alt+Shift+Down` | `Option+Shift+Down` |  |
| Select previous track | `Up` | `Up` | **Set Selection End** |
| Select next track | `Down` | `Down` | **Set Selection Start** |
| Toggle folder track | `Shift+Tab` | `Shift+Tab` | **Extend Selection To Next Transient** |
| Freeze track | `Ctrl+F5` | `Cmd+F5` |  |

## MIDI Editor Shortcuts

| Action | Windows | macOS | We rebind it |
| --- | --- | --- | --- |
| Select all notes | `Ctrl+A` | `Cmd+A` | **Select All** |
| Quantize notes | `Q` | `Q` | **Scroll To Left Selection (Commands Focus)** |
| Humanize notes | `Actions List (search "humanize")` | `Actions List (search "humanize")` |  |
| Transpose up 1 semitone | `Shift+Up` | `Shift+Up` |  |
| Transpose down 1 semitone | `Shift+Down` | `Shift+Down` |  |
| Transpose up 1 octave | `Ctrl+Shift+Up` | `Cmd+Shift+Up` |  |
| Transpose down 1 octave | `Ctrl+Shift+Down` | `Cmd+Shift+Down` |  |
| Split note at cursor | `S` | `S` | **Trim From Clip End** |
| Join selected notes | `J` | `J` |  |
| Delete selected notes | `Delete` | `Delete` |  |
| Move notes left by grid | `Left` | `Left` |  |
| Move notes right by grid | `Right` | `Right` |  |
| Toggle snap to grid | `Alt+S` | `Option+S` |  |
| Zoom to fit all notes | `Ctrl+Shift+Home` | `Cmd+Shift+Home` |  |

## FX and Routing

| Action | Windows | macOS | We rebind it |
| --- | --- | --- | --- |
| Open FX Chain for track | `F (with track selected)` | `F (with track selected)` |  |
| Open FX Browser | `Ctrl+Shift+F` | `Cmd+Shift+F` | **Toggle Full Screen** |
| Open Take FX | `Shift+E` | `Shift+E` |  |
| Open track routing | `Alt+R` | `Option+R` |  |
| Bypass all FX on track | `B (with track selected)` | `B (with track selected)` | **Separate Selection (Commands Focus)** |
| Open Actions List | `?` | `?` |  |
| Open Preferences | `Ctrl+P` | `Cmd+,` |  |

## Selection and Markers

| Action | Windows | macOS | We rebind it |
| --- | --- | --- | --- |
| Set time selection start | `[` | `[` | **Move Selection to Previous Bar** |
| Set time selection end | `]` | `]` | **Move Selection to Next Bar** |
| Remove time selection | `Escape` | `Escape` |  |
| Insert marker at cursor | `M` | `M` | **Nudge Left Next Amount** |
| Insert region from selection | `Shift+R` | `Shift+R` | **Toggle Record Arm** |
| Go to next marker | `] (with no time sel)` | `] (with no time sel)` | **Move Selection to Next Bar** |
| Go to previous marker | `[ (with no time sel)` | `[ (with no time sel)` | **Move Selection to Previous Bar** |
| Jump to marker by number | `1-0 (numpad)` | `1-0 (numpad)` |  |

## Where our keymap displaces a default

Point-in-time snapshot of the last column above against `mappings/luna.toml`,
taken 2026-08-19. Displacing a default is usually the point of this project --
but it should be a decision rather than a surprise. For a `Shift+<nav>` combo it
is settled policy rather than a judgement call: the 2D selection vocabulary
outranks native defaults (CONSTITUTION.md, Principle 5), so `Shift+Tab` taking
the slot REAPER gives *Toggle folder track* is the intended trade. Importing a key map
overrides only the combos it names; every other REAPER default stays put, and
Key map -> Reset to factory defaults backs it all out.

| Combo | REAPER default | We bind it to |
| --- | --- | --- |
| `, (comma)` | Move cursor to previous beat | Nudge Left |
| `. (period)` | Move cursor to next beat | Nudge Right |
| `[` | Set time selection start | Move Selection to Previous Bar |
| `[ (with no time sel)` | Go to previous marker | Move Selection to Previous Bar |
| `]` | Set time selection end | Move Selection to Next Bar |
| `] (with no time sel)` | Go to next marker | Move Selection to Next Bar |
| `B (with track selected)` | Bypass all FX on track | Separate Selection (Commands Focus) |
| `Cmd+A` | Select all Items | Select All |
| `Cmd+A` | Select all notes | Select All |
| `Cmd+C` | Copy selected Items | Copy |
| `Cmd+D` | Duplicate Items | Duplicate selection |
| `Cmd+Shift+F` | Open FX Browser | Toggle Full Screen |
| `Cmd+Shift+Z` | Redo | Redo |
| `Cmd+Shift+Z` | Zoom to time selection | Redo |
| `Cmd+T` | Insert new track | Trim Clip to Selection |
| `Cmd+V` | Paste | Paste |
| `Cmd+X` | Cut selected Items | Cut |
| `Cmd+Z` | Undo | Undo |
| `D` | Dynamic split | Fade To Clip Start (Fade In) |
| `Down` | Select next track | Set Selection Start |
| `G` | Group selected Items | Fade To Clip Stop (Fade Out) |
| `M` | Insert marker at cursor | Nudge Left Next Amount |
| `M (with track selected)` | Toggle track mute | Nudge Left Next Amount |
| `N, then configure` | Nudge Item left | Normalize Selection |
| `Q` | Quantize notes | Scroll To Left Selection (Commands Focus) |
| `R` | Toggle repeat / loop | Zoom Out (Commands Focus) |
| `Return` | Pause | Return To Zero |
| `S` | Split Item at cursor | Trim From Clip End |
| `S` | Split note at cursor | Trim From Clip End |
| `S (with track selected, no Items)` | Toggle track solo | Trim From Clip End |
| `Shift+R` | Insert region from selection | Toggle Record Arm |
| `Shift+Tab` | Toggle folder track | Extend Selection To Next Transient |
| `Space` | Play / Stop | Toggle Playback |
| `T` | Cycle through Takes | Zoom In (Commands Focus) |
| `Up` | Select previous track | Set Selection End |
| `W` | Stop and move cursor to start | Scroll To Right Selection (Commands Focus) |

