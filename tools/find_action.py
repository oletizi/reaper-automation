#!/usr/bin/env python3
"""Search the dumped REAPER action list.

    tools/find_action.py "zoom in horizontal"
    tools/find_action.py --section midi_editor "note: "
    tools/find_action.py --id 40222

All terms must appear (AND, case-insensitive, order-independent).
"""
import argparse
import pathlib
import sys

DUMP = pathlib.Path(__file__).resolve().parent.parent / "data" / "reaper-actions-7.78-linux.tsv"


def load(path=DUMP):
    rows = []
    with open(path, encoding="utf-8", errors="replace") as fh:
        next(fh)  # header
        for line in fh:
            parts = line.rstrip("\n").split("\t")
            if len(parts) >= 5:
                rows.append(
                    {
                        "section": parts[0],
                        "section_id": parts[1],
                        "command_id": parts[2],
                        "named_id": parts[3],
                        "name": parts[4],
                    }
                )
    return rows


def search(rows, terms, section="main"):
    terms = [t.lower() for t in terms]
    out = []
    for r in rows:
        if section and r["section"] != section:
            continue
        hay = r["name"].lower()
        if all(t in hay for t in terms):
            out.append(r)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("terms", nargs="*")
    ap.add_argument("--section", default="main")
    ap.add_argument("--id", help="look up one command id exactly")
    ap.add_argument("--limit", type=int, default=25)
    args = ap.parse_args()

    rows = load()

    if args.id:
        hits = [r for r in rows if r["command_id"] == args.id and r["section"] == args.section]
    else:
        if not args.terms:
            ap.error("give search terms or --id")
        hits = search(rows, args.terms, args.section)

    for r in hits[: args.limit]:
        print(f"{r['command_id']:>8}  {r['name']}")
    if len(hits) > args.limit:
        print(f"... {len(hits) - args.limit} more")
    if not hits:
        print("(no match)", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
