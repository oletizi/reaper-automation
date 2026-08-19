-- Headless transient-navigation probe. Drives REAPER's native transient actions
-- (40375 "next transient", 40836 "nearest transient") on whatever media item is
-- present, under several scenarios, and writes the cursor landings to DIAG_OUT.
--
-- Run via the sibling run.sh, or directly:
--   DIAG_OUT=/tmp/out.txt reaper -cfgfile <ini> -nosplash -new <audio.wav> transient_probe.lua
--
-- An "EDGE" landing is the item start/end; "inside" is a detected internal
-- transient. If every landing is EDGE, transient DETECTION found nothing (a
-- sensitivity/material issue) -- the action itself is not at fault.

local OUT = os.getenv("DIAG_OUT") or "/tmp/transient_probe.txt"
local f = io.open(OUT, "w")
local function log(s) f:write(tostring(s) .. "\n") end

log("app=" .. tostring(reaper.GetAppVersion and reaper.GetAppVersion() or "?"))
log("tracks=" .. reaper.CountTracks(0) .. " items=" .. reaper.CountMediaItems(0))

local it = reaper.GetMediaItem(0, 0)
if not it then
  log("NO ITEM IMPORTED -- media file was not added as expected")
  f:close()
  reaper.Main_OnCommand(40004, 0)
  return
end

local pos = reaper.GetMediaItemInfo_Value(it, "D_POSITION")
local len = reaper.GetMediaItemInfo_Value(it, "D_LENGTH")
log(string.format("item pos=%.3f len=%.3f end=%.3f", pos, len, pos + len))
local take = reaper.GetActiveTake(it)
if take then
  local src = reaper.GetMediaItemTake_Source(take)
  log("take midi=" .. tostring(reaper.TakeIsMIDI(take)) ..
      " srctype=" .. (src and reaper.GetMediaSourceType(src, "") or "?"))
end

local function sweep(label)
  log("--- " .. label .. " ---")
  reaper.SelectAllMediaItems(0, false)
  reaper.SetMediaItemSelected(it, true)
  reaper.SetEditCurPos(pos, false, false)
  for i = 1, 10 do
    local b = reaper.GetCursorPosition()
    reaper.Main_OnCommand(40375, 0)
    local a = reaper.GetCursorPosition()
    local edge = (math.abs(a - pos) < 1e-4 or math.abs(a - (pos + len)) < 1e-4) and "EDGE" or "inside"
    log(string.format("  step %d: %.3f -> %.3f  [%s]", i, b, a, edge))
    if math.abs(a - b) < 1e-9 then log("  (stuck)"); break end
  end
end

sweep("A: bare 40375, no guides calculated")

reaper.SelectAllMediaItems(0, false); reaper.SetMediaItemSelected(it, true)
reaper.Main_OnCommand(42028, 0) -- Calculate transient guides
sweep("B: 40375 after 42028 (calculate transient guides)")

reaper.SelectAllMediaItems(0, false); reaper.SetMediaItemSelected(it, true)
for _ = 1, 30 do reaper.Main_OnCommand(41536, 0) end -- Increase sensitivity x30
reaper.Main_OnCommand(42028, 0)
sweep("C: 40375 after +30 sensitivity then 42028")

log("--- D: 40836 nearest-transient from pos+0.6 ---")
reaper.SelectAllMediaItems(0, false); reaper.SetMediaItemSelected(it, true)
reaper.SetEditCurPos(pos + 0.6, false, false)
reaper.Main_OnCommand(40836, 0)
log(string.format("  cursor -> %.3f", reaper.GetCursorPosition()))

f:close()
reaper.Main_OnCommand(40004, 0) -- Quit REAPER
