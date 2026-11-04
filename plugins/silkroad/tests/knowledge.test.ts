import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { ToolDefinition } from '@deepseek-ai/dsh-tools'
import { knowledgeTool } from '../src/knowledge.ts'

async function run(tool: ToolDefinition, args: Record<string, unknown>) {
  const execute = (tool as unknown as { execute: (a: unknown, e: unknown) => Promise<unknown> }).execute
  return execute(args, { signal: new AbortController().signal }) as Promise<Record<string, any>>
}

describe('silkroad_knowledge', () => {
  it('creates the folder with a README on first use and says it is empty', async () => {
    const root = join(await mkdtemp(join(tmpdir(), 'silkroad-kb-')), 'knowledge')
    const result = await run(knowledgeTool(async () => root), {})
    expect(result.directory).toBe(root)
    expect(result.files.map((f: { path: string }) => f.path)).toEqual(expect.arrayContaining(['README.md', 'policies/returns.example.md']))
    expect(result.note).toMatch(/no real content/)
    expect(await readFile(join(root, 'README.md'), 'utf8')).toContain('products/')
  })

  it('lists titles and finds lines by any term, case-insensitively', async () => {
    const root = join(await mkdtemp(join(tmpdir(), 'silkroad-kb-')), 'knowledge')
    const tool = knowledgeTool(async () => root)
    await run(tool, {})
    await writeFile(join(root, 'products', 'lamp.md'), '# LED Desk Lamp\n\nSKU: LAMP-01\nWarranty: 12 months\n')
    await writeFile(join(root, 'products', 'photo.png'), 'binary')
    const listed = await run(tool, {})
    expect(listed.files).toContainEqual(expect.objectContaining({ path: 'products/lamp.md', title: 'LED Desk Lamp' }))
    expect(listed.files.some((f: { path: string }) => f.path.endsWith('.png'))).toBe(false)
    expect(listed.note).toBeUndefined()
    const found = await run(tool, { query: ['warranty', 'nothing-matches'] })
    expect(found.matches).toContainEqual({ path: 'products/lamp.md', line: 4, text: 'Warranty: 12 months' })
  })
})
