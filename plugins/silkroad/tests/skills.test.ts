import { describe, expect, it } from 'vitest'
import { loadSkills, parseSkill } from '../src/skills.ts'

describe('shipped skills', () => {
  it('every skill parses, matches its directory, and stays within a sane size', async () => {
    const skills = await loadSkills()
    expect(skills.map(skill => skill.name)).toContain('silkroad-setup')
    for (const skill of skills) {
      expect(skill.description.length).toBeGreaterThan(20)
      expect(skill.content.length).toBeGreaterThan(100)
      expect(skill.content.length).toBeLessThan(40_000)
    }
  })

  it('rejects a file without frontmatter', () => {
    expect(() => parseSkill('# no frontmatter')).toThrow(/frontmatter/)
  })
})
