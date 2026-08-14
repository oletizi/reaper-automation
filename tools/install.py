#!/usr/bin/env python3
"""Copy the built keymap and its ReaScripts into REAPER's resource directory.

    tools/install.py                      # install into ~/.config/REAPER
    tools/install.py --resource-dir DIR   # or somewhere else

This does NOT activate the keymap -- REAPER owns that. After installing, import
it in REAPER: Actions > Show action list > Key map > Import...

The scripts must be on disk before the import, or the SCR entries in the keymap
resolve to nothing and those keys land on dead actions.
"""
import argparse
import pathlib
import shutil
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
DEFAULT_RESOURCE = pathlib.Path.home() / ".config" / "REAPER"
KEYMAP_NAME = "LUNA (Pro Tools).ReaperKeyMap"


def install(built_keymap, resource_dir, script_subdir="luna"):
    built = pathlib.Path(built_keymap)
    if not built.is_file():
        print(f"no built keymap at {built} -- run build_keymap.py first", file=sys.stderr)
        return 1

    res = pathlib.Path(resource_dir)
    if not res.is_dir():
        print(f"{res} is not a REAPER resource directory", file=sys.stderr)
        return 1

    # ReaScripts first: the keymap references them by path.
    src_scripts = built.parent / "Scripts" / script_subdir
    n_scripts = 0
    if src_scripts.is_dir():
        dst_scripts = res / "Scripts" / script_subdir
        dst_scripts.mkdir(parents=True, exist_ok=True)
        for lua in sorted(src_scripts.glob("*.lua")):
            shutil.copy2(lua, dst_scripts / lua.name)
            n_scripts += 1
        print(f"{n_scripts} ReaScript(s) -> {dst_scripts}")

    keymaps = res / "KeyMaps"
    keymaps.mkdir(parents=True, exist_ok=True)
    dst = keymaps / KEYMAP_NAME
    shutil.copy2(built, dst)
    print(f"keymap             -> {dst}")

    print()
    print("Now in REAPER: Actions > Show action list > Key map > Import...")
    print(f"and choose \"{KEYMAP_NAME}\".")
    return 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--keymap", default=str(ROOT / "build" / "luna-linux.ReaperKeyMap"))
    ap.add_argument("--resource-dir", default=str(DEFAULT_RESOURCE))
    args = ap.parse_args()
    return install(args.keymap, args.resource_dir)


if __name__ == "__main__":
    sys.exit(main())
