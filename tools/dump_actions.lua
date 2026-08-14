-- Dump every REAPER action (section, command id, name) to a TSV file, then quit.
-- Run via: reaper -cfgfile <resdir>/reaper.ini -nosplash -new dump_actions.lua

local OUT = os.getenv("REAPER_DUMP_OUT") or "/tmp/reaper-actions.tsv"
local LOG = OUT .. ".log"

local log = {}
local function note(s) log[#log + 1] = tostring(s) end

note("kbd_enumerateActions=" .. tostring(reaper.kbd_enumerateActions ~= nil))
note("SectionFromUniqueID=" .. tostring(reaper.SectionFromUniqueID ~= nil))
note("ReverseNamedCommandLookup=" .. tostring(reaper.ReverseNamedCommandLookup ~= nil))
note("GetAppVersion=" .. tostring(reaper.GetAppVersion and reaper.GetAppVersion() or "?"))

local SECTIONS = {
  { id = 0,     label = "main" },
  { id = 100,   label = "main_alt" },
  { id = 32060, label = "midi_editor" },
  { id = 32061, label = "midi_evtlist" },
  { id = 32062, label = "midi_inline" },
  { id = 32063, label = "media_explorer" },
}

local rows = {}

if reaper.kbd_enumerateActions and reaper.SectionFromUniqueID then
  for _, sec in ipairs(SECTIONS) do
    local ok, section = pcall(reaper.SectionFromUniqueID, sec.id)
    if ok and section then
      local i, n = 0, 0
      while true do
        local ok2, cmd, name = pcall(reaper.kbd_enumerateActions, section, i)
        if not ok2 or not cmd or cmd == 0 then break end
        -- named (extension/script) actions resolve to a _string id
        local named = ""
        if reaper.ReverseNamedCommandLookup then
          named = reaper.ReverseNamedCommandLookup(cmd) or ""
        end
        rows[#rows + 1] = table.concat({ sec.label, tostring(sec.id), tostring(cmd), named, name or "" }, "\t")
        i = i + 1
        n = n + 1
        if i > 100000 then break end
      end
      note(("section %s (%d): %d actions"):format(sec.label, sec.id, n))
    else
      note(("section %s (%d): SectionFromUniqueID failed"):format(sec.label, sec.id))
    end
  end
else
  note("FATAL: enumeration API unavailable")
end

local f = io.open(OUT, "w")
if f then
  f:write("section\tsection_id\tcommand_id\tnamed_id\taction_name\n")
  f:write(table.concat(rows, "\n"))
  f:write("\n")
  f:close()
  note("wrote " .. #rows .. " rows to " .. OUT)
end

local lf = io.open(LOG, "w")
if lf then
  lf:write(table.concat(log, "\n") .. "\n")
  lf:close()
end

-- quit REAPER so the probe leaves nothing running
reaper.Main_OnCommand(40004, 0)
