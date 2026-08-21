import { describe, it, expect } from 'vitest'
import { renderSeparateScript } from '@/adapters/reaper/templates/separate'

describe('renderSeparateScript', () => {
  const lua = renderSeparateScript({ label: 'LUNA: Separate', spec: 'luna.toml' })
  it('splits at the razor when one exists, else at the edit cursor', () => {
    expect(lua).toContain('P_RAZOREDITS')
    expect(lua).toContain('40061') // split at razor
    expect(lua).toContain('40012') // split at edit cursor (fallback)
  })
  it('is wrapped in an undo block naming the label', () => {
    expect(lua).toContain('Undo_BeginBlock')
    expect(lua).toContain('Undo_EndBlock("LUNA: Separate"')
  })
})
