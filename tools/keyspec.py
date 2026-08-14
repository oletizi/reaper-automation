"""Translate human key specs ("Ctrl+Shift+Left") into REAPER keymap (flags, keycode) pairs.

REAPER's reaper-kb.ini KEY line is:

    KEY <flags> <keycode> <command> <section>

`flags` is a Windows-ACCEL-style bitfield, verified against community keymaps
that carry human-readable comments:

    1   this is a virtual key (rather than a raw ASCII code)
    +4  Shift
    +8  Ctrl      (Command on macOS)
    +16 Alt       (Option on macOS)
    +32 Super/Win (Control on macOS)

flags 0 means the keycode is a raw ASCII character; flags 255 is reserved for
mousewheel / multitouch / media-key input. We only ever emit virtual keys.

`keycode` is a Windows virtual-key code, except that the "extended" navigation
block (VK 33..47: PgUp, PgDn, End, Home, arrows, Insert, Delete) is offset by
+32768, giving REAPER's documented 32801..32815 range.
"""

FLAG_VIRTKEY = 1
FLAG_SHIFT = 4
FLAG_CTRL = 8
FLAG_ALT = 16
FLAG_SUPER = 32

MODIFIERS = {
    "shift": FLAG_SHIFT,
    "ctrl": FLAG_CTRL,
    "control": FLAG_CTRL,
    "cmd": FLAG_CTRL,  # macOS Command lands on Ctrl for a Linux/Windows target
    "alt": FLAG_ALT,
    "opt": FLAG_ALT,
    "option": FLAG_ALT,
    "super": FLAG_SUPER,
    "win": FLAG_SUPER,
    "meta": FLAG_SUPER,
}

# VK 33..47 are the "extended" block; REAPER offsets them by +32768.
EXTENDED_OFFSET = 32768

_EXTENDED = {
    "pgup": 33,
    "pgdn": 34,
    "end": 35,
    "home": 36,
    "left": 37,
    "up": 38,
    "right": 39,
    "down": 40,
    "insert": 45,
    "delete": 46,
    "del": 46,
}

_NAMED = {
    "backspace": 8,
    "tab": 9,
    "return": 13,
    "enter": 13,
    "esc": 27,
    "escape": 27,
    "space": 32,
    # punctuation / OEM keys, US layout
    ";": 186,
    "=": 187,
    ",": 188,
    "-": 189,
    ".": 190,
    "/": 191,
    "`": 192,
    "[": 219,
    "\\": 220,
    "]": 221,
    "'": 222,
    # numeric keypad
    "nummultiply": 106,
    "numplus": 107,
    "numminus": 109,
    "numdecimal": 110,
    "numdivide": 111,
}

for _i in range(10):
    _NAMED[f"num{_i}"] = 96 + _i
for _i in range(1, 25):
    _NAMED[f"f{_i}"] = 111 + _i


class KeySpecError(ValueError):
    pass


def parse(spec):
    """"Ctrl+Shift+Left" -> (13, 32805). Raises KeySpecError on anything unknown."""
    if not spec or not spec.strip():
        raise KeySpecError("empty key spec")

    parts = _split(spec.strip())
    *mods, key = parts

    flags = FLAG_VIRTKEY
    for m in mods:
        low = m.lower()
        if low not in MODIFIERS:
            raise KeySpecError(f"unknown modifier {m!r} in {spec!r}")
        bit = MODIFIERS[low]
        if flags & bit:
            raise KeySpecError(f"duplicate modifier {m!r} in {spec!r}")
        flags |= bit

    code = _keycode(key, spec)
    return flags, code


def _split(spec):
    """Split on '+' but keep a literal '+' key intact (e.g. "Ctrl++")."""
    parts, buf = [], ""
    for i, ch in enumerate(spec):
        if ch == "+" and buf and i != len(spec) - 1:
            parts.append(buf)
            buf = ""
        else:
            buf += ch
    parts.append(buf)
    return [p for p in parts if p != ""] or [spec]


def _keycode(key, spec):
    low = key.lower()
    if low in _EXTENDED:
        return _EXTENDED[low] + EXTENDED_OFFSET
    if low in _NAMED:
        return _NAMED[low]
    if len(key) == 1:
        ch = key.upper()
        if "A" <= ch <= "Z" or "0" <= ch <= "9":
            return ord(ch)
    raise KeySpecError(f"unknown key {key!r} in {spec!r}")


def describe(flags, code):
    """Inverse of parse(), for the human-readable comment on each emitted line."""
    names = []
    if flags & FLAG_CTRL:
        names.append("Ctrl")
    if flags & FLAG_ALT:
        names.append("Alt")
    if flags & FLAG_SUPER:
        names.append("Super")
    if flags & FLAG_SHIFT:
        names.append("Shift")

    label = None
    if code > EXTENDED_OFFSET:
        raw = code - EXTENDED_OFFSET
        for k, v in _EXTENDED.items():
            if v == raw:
                label = k.capitalize()
                break
    if label is None:
        for k, v in _NAMED.items():
            if v == code:
                label = k.capitalize() if k.isalnum() else k
                break
    if label is None and 32 < code < 127:
        label = chr(code)
    if label is None:
        label = f"VK{code}"

    return "+".join(names + [label])
