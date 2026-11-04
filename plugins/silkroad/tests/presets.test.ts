import { describe, expect, it } from 'vitest'
import { DIRECTOR, ROLES, rolePresets, type PresetRow } from '../src/presets.ts'
import { loadSkills } from '../src/skills.ts'

function flatten(rows: PresetRow[]): PresetRow[] {
  return rows.flatMap(row => [row, ...(row.group && Array.isArray(row.config) ? flatten(row.config as PresetRow[]) : [])])
}

describe('role presets', () => {
  const presets = rolePresets('darwin')

  it('defines the four roles with a persona row first', () => {
    expect(presets.map(p => p.id)).toEqual(ROLES.map(r => r.id))
    expect(presets).toHaveLength(4)
    for (const preset of presets) {
      expect(preset.plugins[0]!.name).toBe('@deepseek-ai/dsh-persona')
      expect((preset.plugins[0]!.config as { prefix: string }).prefix).toContain('{{model}}')
    }
  })

  it('never reuses row ids across presets, so profile patches aimed at `standard` cannot hit them', () => {
    const ids = presets.flatMap(p => flatten(p.plugins).map(row => row.id))
    expect(ids.every(Boolean)).toBe(true)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('lets only the director pick specialist presets for its subagents', () => {
    for (const preset of presets) {
      const spawn = flatten(preset.plugins).find(row => row.name === '@deepseek-ai/dsh-tool-subagent' && (row.config as { provider: string }).provider === 'spawn')!
      const allowed = (spawn.config as { allowedAgentPresets?: string[] }).allowedAgentPresets
      if (preset.id === DIRECTOR) {
        expect(allowed).toEqual(['silkroad-product-researcher', 'silkroad-listing-optimizer', 'silkroad-pricing-strategist'])
        expect(allowed!.every(id => presets.some(p => p.id === id))).toBe(true)
      } else {
        expect(allowed).toBeUndefined()
      }
    }
  })

  it('picks the shell by platform', () => {
    const shell = (platform: NodeJS.Platform) => flatten(rolePresets(platform)[0]!.plugins).filter(row => /tool-(bash|pwsh)$/.test(row.name)).map(row => [row.name, row.disabled])
    expect(shell('darwin')).toEqual([['@deepseek-ai/dsh-tool-bash', false], ['@deepseek-ai/dsh-tool-pwsh', true]])
    expect(shell('win32')).toEqual([['@deepseek-ai/dsh-tool-bash', true], ['@deepseek-ai/dsh-tool-pwsh', false]])
  })

  it('only names skills that ship with SilkRoad', async () => {
    const shipped = new Set((await loadSkills()).map(skill => skill.name))
    for (const role of ROLES) {
      for (const name of role.persona.match(/\b(?:tiktok|silkroad)-[a-z-]+\b/g) ?? []) expect(shipped, `${role.id} mentions ${name}`).toContain(name)
    }
  })
})
