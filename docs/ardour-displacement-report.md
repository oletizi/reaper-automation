# Ardour binding displacement report

Generated 2026-08-19 against Ardour 9.7.0 stock bindings
(`/opt/Ardour-9.7.0/etc/ardour.keys`, 442 bindings across 12 contexts)
and this repo's `KEYBINDINGS.md`. Regenerate with the script recorded in
`docs/ardour-backend-investigation.md`.

```
repo bindings:                                  105
  collide in Editor/Editing/Global (real)       68
  collide only in other contexts (harmless)     4
  free in Ardour                                33

=== REAL DISPLACEMENTS (contexts we emit into) ===
  Backspace            BackSpace                      Clear                            -> [Editing] Editing/alternate-editor-delete
  Down                 Down                           Set Selection Start              -> [Editor] Editor/step-tracks-down
  Num1                 KP_1                           Move Selection to Previous Bar ( -> [Global] Transport/numpad-1
  Num2                 KP_2                           Move Selection to Next Bar (nump -> [Global] Transport/numpad-2
  Num3                 KP_3                           Toggle Record (numpad)           -> [Global] Transport/numpad-3
  Num4                 KP_4                           Loop Playback (numpad)           -> [Global] Transport/numpad-4
  Num7                 KP_7                           Toggle Metronome (numpad)        -> [Global] Transport/numpad-7
  Num8                 KP_8                           Toggle Count In (numpad)         -> [Global] Transport/numpad-8
  Ctrl+Shift+Backspace Primary-Tertiary-BackSpace     Delete Selected Tracks           -> [Editor] Editor/alternate-delete-section
  Ctrl+Shift+A         Primary-Tertiary-a             Select All Tracks                -> [Editor] Region/align-regions-start-relative
  Ctrl+Shift+F         Primary-Tertiary-f             Toggle Full Screen               -> [Global] Common/ToggleMaximalMixer
  Ctrl+Shift+L         Primary-Tertiary-l             Loop Select                      -> [Editor] Editor/find-and-display-stripable
  Ctrl+Shift+N         Primary-Tertiary-n             New Tracks                       -> [Global] Main/AddTrackBus
  Ctrl+Shift+Z         Primary-Tertiary-z             Redo                             -> [Editing] Editing/alternate-alternate-redo
  Ctrl+A               Primary-a                      Select All                       -> [Editor] Editor/select-all-objects
  Ctrl+C               Primary-c                      Copy                             -> [Editing] Editing/editor-copy
  Ctrl+D               Primary-d                      Duplicate selection              -> [Editor] Editor/duplicate
  Ctrl+E               Primary-e                      Separate Selection               -> [Global] Main/QuickExport
  Ctrl+F               Primary-f                      Create Fades                     -> [Editor] EditorEditing/toggle-follow-playhead
  Ctrl+G               Primary-g                      New Track Group                  -> [Editor] Editor/group-selected-regions
  Ctrl+I               Primary-i                      Import                           -> [Global] Common/addExistingAudioFiles
  Ctrl+K               Primary-k                      Toggle Pre/Post Roll             -> [Editor] Region/trim-to-next-region
  Ctrl+M               Primary-m                      Mute Selection                   -> [Global] Monitor Section/monitor-cut-all
  Ctrl+Space           Primary-space                  Toggle Record                    -> [Global] Transport/ToggleRollForgetCapture
  Ctrl+T               Primary-t                      Trim Clip to Selection           -> [Global] Common/select-all-visible-lanes
  Ctrl+V               Primary-v                      Paste                            -> [Editing] Editing/editor-paste
  Ctrl+X               Primary-x                      Cut                              -> [Editing] Editing/editor-cut
  Ctrl+Z               Primary-z                      Undo                             -> [Editing] Editing/undo
  Return               Return                         Return To Zero                   -> [Global] Transport/alternate-GotoStart
  Alt+D                Secondary-d                    Duplicate                        -> [Editor] Editor/multi-duplicate
  Alt+L                Secondary-l                    Move Selection To Previous Trans -> [Global] Window/toggle-locations
  Tab                  Tab                            Tab to Transient (next)          -> [Global] Common/add-location-from-playhead
  Shift+Left           Tertiary-Left                  Scroll To Left Selection         -> [Global] Transport/Rewind
  Shift+Right          Tertiary-Right                 Scroll To Right Selection        -> [Global] Transport/Forward
  Shift+A              Tertiary-a                     Auto Scroll                      -> [Editor] Region/align-regions-sync
  Shift+[              Tertiary-braceleft             Extend Selection To Previous Bar -> [Editor] Editor/layer-display-overlaid
  Shift+]              Tertiary-braceright            Extend Selection To Next Bar     -> [Editor] Editor/layer-display-stacked
  Shift+;              Tertiary-colon                 Extend Selection Down            -> [Editor] Editor/copy-playlists-for-selected-tracks
  Shift+L              Tertiary-l                     Extend Selection To Previous Cli -> [Editor] Editor/show-editor-list
  Shift+P              Tertiary-p                     Extend Selection Up              -> [Editor] Editor/show-editor-props
  Shift+'              Tertiary-quotedbl              Extend Selection To Next Clip Ed -> [Editor] Editor/new-playlists-for-selected-tracks
  Shift+R              Tertiary-r                     Toggle Record Arm                -> [Global] Transport/Record
  Shift+S              Tertiary-s                     Toggle Solo                      -> [Editor] Editor/ToggleSummary
  Up                   Up                             Set Selection End                -> [Editor] Editor/step-tracks-up
  A                    a                              Trim From Clip Start             -> [Global] Transport/solo-selection
  '                    apostrophe                     Move Selection To Next Clip Edge -> [Editor] Editor/edit-cursor-to-previous-region-sync
  [                    bracketleft                    Move Selection to Previous Bar   -> [Editor] Editor/set-punch-from-edit-range
  ]                    bracketright                   Move Selection to Next Bar       -> [Editor] Editor/set-loop-from-edit-range
  C                    c                              Copy (Commands Focus)            -> [Editing] Editing/set-mouse-mode-cut
  ,                    comma                          Nudge Left                       -> [Global] Common/start-range
  D                    d                              Fade To Clip Start (Fade In)     -> [Editing] Editing/set-mouse-mode-draw
  E                    e                              Frame Selection                  -> [Editing] Editing/set-mouse-mode-content
  G                    g                              Fade To Clip Stop (Fade Out)     -> [Editing] Editing/set-mouse-mode-object
  K                    k                              Toggle Metronome                 -> [Editor] Region/trim-back
  L                    l                              Move Selection To Previous Clip  -> [Global] Transport/Loop
  M                    m                              Nudge Left Next Amount           -> [Editor] Region/add-region-cue-marker
  P                    p                              Move Selection Up                -> [Editor] Editor/set-playhead
  .                    period                         Nudge Right                      -> [Global] Common/finish-range
  Q                    q                              Scroll To Left Selection (Comman -> [Global] Common/jump-backward-to-mark
  R                    r                              Zoom Out (Commands Focus)        -> [Editing] Editing/set-mouse-mode-range
  S                    s                              Trim From Clip End               -> [Editor] Editor/split-region
  ;                    semicolon                      Move Selection Down              -> [Editor] Editor/edit-cursor-to-next-region-sync
  /                    slash                          Nudge Right Next Amount          -> [Editor] Editor/editor-fade-range
  Space                space                          Toggle Playback                  -> [Global] Transport/ToggleRoll
  T                    t                              Zoom In (Commands Focus)         -> [Editing] Editing/set-mouse-mode-timefx
  V                    v                              Paste (Commands Focus)           -> [Editor] Region/set-region-sync-position
  W                    w                              Scroll To Right Selection (Comma -> [Global] Common/jump-forward-to-mark
  X                    x                              Cut (Commands Focus)             -> [Editor] Region/align-regions-sync-relative

=== HARMLESS (MIDI/Mixer/StepEditing/etc only) ===
  Shift+Tab            Extend Selection To Next Transie (MIDI)
  Shift+M              Toggle Mute                      (Mixer)
  B                    Separate Selection (Commands Foc (Monitor Section, Step Editing)
  N                    Normalize Selection              (Step Editing)
```
