/** Loads the skills shipped in `skills/<name>/SKILL.md` and registers them as runtime skills. */
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

export interface ShippedSkill { name: string; description: string; content: string }

/** Splits `---` frontmatter holding single-line `key: value` pairs from the body. */
export function parseSkill(text: string): ShippedSkill {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text)
  if (!match) throw new Error('SKILL.md has no frontmatter')
  const fields: Record<string, string> = {}
  for (const line of match[1]!.split(/\r?\n/)) {
    const pair = /^([A-Za-z_-]+):\s*(.*)$/.exec(line)
    if (pair) fields[pair[1]!] = pair[2]!.trim()
  }
  if (!fields.name || !fields.description) throw new Error('SKILL.md needs name and description')
  return { name: fields.name, description: fields.description, content: match[2]!.trim() }
}

/** `skills/` sits beside `lib/` in the package, and beside `src/` in a checkout. */
export function skillsDirectory(): string {
  return fileURLToPath(new URL('../skills/', import.meta.url))
}

export async function loadSkills(directory = skillsDirectory()): Promise<ShippedSkill[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const skills: ShippedSkill[] = []
  for (const entry of entries.filter(item => item.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    const skill = parseSkill(await readFile(join(directory, entry.name, 'SKILL.md'), 'utf8'))
    if (skill.name !== entry.name) throw new Error(`Skill directory ${entry.name} declares name ${skill.name}`)
    skills.push(skill)
  }
  return skills
}
