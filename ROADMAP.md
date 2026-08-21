---
doc-grammar: roadmap
---

# Roadmap

The governed dependency graph of this project's features. Each item is a
heading-keyed unit identified by its `<phase>:<kind>/<slug>` id.

Mutate the graph with `stackctl roadmap` verbs (run `stackctl roadmap --help`
for the full surface): `add` a new item, `advance` its status, `decompose`,
`reclassify`, `defer`, and `cluster` / `group` to gather existing items under a
created-or-reused parent. Example — cluster items under a new epic with a
dependency chain:

    stackctl roadmap cluster multi:feature/epic --children design:feature/a,impl:feature/b --chain --apply

For an edit that has no verb yet (e.g. moving a `part-of` / `depends-on` edge):
edit this file directly, then run `stackctl roadmap order` to revalidate the
graph (it fails loud on a cycle / dangling ref / duplicate id).

## impl:primitive/layer-boundary
- status: in-flight
- spec: docs/superpowers/specs/2026-08-20-daw-control-layering-design.md

## impl:gap/daw-control-rename
- status: planned
- spec: docs/superpowers/specs/2026-08-20-daw-control-layering-design.md
- ref: docs/superpowers/plans/2026-08-20-daw-control-layering.md

## impl:gap/reaper-capability-probes
- status: planned
- spec: docs/superpowers/specs/2026-08-20-daw-control-layering-design.md
- ref: docs/superpowers/plans/2026-08-20-daw-control-layering.md

## design:feature/track-policy
- status: planned
- depends-on: impl:gap/reaper-capability-probes
- spec: docs/superpowers/specs/2026-08-20-daw-control-layering-design.md

## design:feature/midi-map-backend
- status: planned
- depends-on: impl:gap/reaper-capability-probes
- spec: docs/superpowers/specs/2026-08-20-daw-control-layering-design.md