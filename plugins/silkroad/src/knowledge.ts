/**
 * The knowledge base is a plain local folder: product sheets, after-sales
 * policies, reply templates. The agent reads the files directly with its
 * filesystem tools; this module only creates the folder on first use, lists
 * what is there and does a simple text search, so the agent knows which file
 * to open. Vector search can come later, once the folder outgrows this.
 */
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { extname, isAbsolute, join, relative, sep } from 'node:path'
import { defineTool, type ToolDefinition } from '@deepseek-ai/dsh-tools'

const TEXT_EXTENSIONS = new Set(['.md', '.txt', '.csv', '.json', '.yaml', '.yml', '.tsv', '.html'])
const MAX_FILES = 2000
const MAX_FILE_BYTES = 2 * 1024 * 1024
const MAX_MATCHES = 80

/** Root of SilkRoad's local files; `SILKROAD_HOME` overrides `~/SilkRoad` (used by tests and the smoke run). */
export function silkroadHome(): string {
  const override = process.env.SILKROAD_HOME
  return override && isAbsolute(override) ? override : join(homedir(), 'SilkRoad')
}

export function defaultKnowledgeDirectory(): string {
  return join(silkroadHome(), 'knowledge')
}

const README = `# SilkRoad 知识库

这个文件夹里的内容，SilkRoad 的智能体在回复买家、写 Listing、处理售后时会直接读取。
用 Markdown（.md）或纯文本最好；表格可以用 .csv。

建议的结构：

- products/    每个商品一个文件，例如 products/led-desk-lamp.md：
               卖点、规格、材质、尺寸、适用人群、包装清单、常见问题、使用注意事项、禁止的宣称
- policies/    售后规则，例如 policies/returns.md、policies/shipping.md、policies/warranty.md：
               退换货条件和时限、运费由谁承担、补发规则、赔偿上限、哪些情况需要人工处理
- replies/     你认可的回复示例和固定话术（可选）

写清楚「能承诺什么、不能承诺什么」，智能体起草回复时会以这里为准。
`

const POLICY_EXAMPLE = `# 售后规则（示例，请改成你自己的）

- 退货时限：签收后 30 天内。
- 质量问题：我方承担退货运费，可选退款或补发。
- 非质量问题（不喜欢、买错）：买家承担退货运费。
- 物流超过 15 天未签收：先安抚并查询物流，超过 25 天可补发或退款。
- 以下情况必须转人工：要求超出以上规则的赔偿、涉及人身安全、威胁差评或投诉平台。
`

export interface KnowledgeFile { path: string; bytes: number; modified: string; title?: string }

/** Create the folder with a README and the suggested subfolders when it does not exist yet. */
export async function ensureKnowledgeDirectory(directory: string): Promise<boolean> {
  const exists = await stat(directory).then(info => info.isDirectory(), () => false)
  if (exists) return false
  await mkdir(join(directory, 'products'), { recursive: true })
  await mkdir(join(directory, 'policies'), { recursive: true })
  await mkdir(join(directory, 'replies'), { recursive: true })
  await writeFile(join(directory, 'README.md'), README, { flag: 'wx' }).catch(() => undefined)
  await writeFile(join(directory, 'policies', 'returns.example.md'), POLICY_EXAMPLE, { flag: 'wx' }).catch(() => undefined)
  return true
}

async function walk(directory: string, root: string, out: string[]): Promise<void> {
  if (out.length >= MAX_FILES) return
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => [])
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name.startsWith('.')) continue
    const path = join(directory, entry.name)
    if (entry.isDirectory()) await walk(path, root, out)
    else if (entry.isFile() && TEXT_EXTENSIONS.has(extname(entry.name).toLowerCase())) out.push(path)
    if (out.length >= MAX_FILES) return
  }
}

function titleOf(text: string): string | undefined {
  const heading = /^#\s+(.+)$/m.exec(text)
  return heading?.[1]?.trim().slice(0, 120)
}

export async function listKnowledge(directory: string): Promise<KnowledgeFile[]> {
  const paths: string[] = []
  await walk(directory, directory, paths)
  return Promise.all(paths.map(async path => {
    const info = await stat(path)
    const head = info.size <= MAX_FILE_BYTES ? (await readFile(path, 'utf8')).slice(0, 4000) : ''
    const title = titleOf(head)
    return { path: relative(directory, path).split(sep).join('/'), bytes: info.size, modified: info.mtime.toISOString(), ...title ? { title } : {} }
  }))
}

/** Case-insensitive search for any of the terms; returns matching lines with their file and line number. */
export async function searchKnowledge(directory: string, terms: string[]): Promise<{ path: string; line: number; text: string }[]> {
  const needles = terms.map(term => term.trim().toLowerCase()).filter(Boolean)
  if (!needles.length) return []
  const paths: string[] = []
  await walk(directory, directory, paths)
  const matches: { path: string; line: number; text: string }[] = []
  for (const path of paths) {
    if ((await stat(path)).size > MAX_FILE_BYTES) continue
    const lines = (await readFile(path, 'utf8')).split(/\r?\n/)
    for (const [index, line] of lines.entries()) {
      const lower = line.toLowerCase()
      if (!needles.some(needle => lower.includes(needle))) continue
      matches.push({ path: relative(directory, path).split(sep).join('/'), line: index + 1, text: line.trim().slice(0, 300) })
      if (matches.length >= MAX_MATCHES) return matches
    }
  }
  return matches
}

/** `files` counts the user's own content: the README and `*.example.*` files SilkRoad creates are left out. */
export interface KnowledgeStatus { directory: string; exists: boolean; files: number }

const isStarterFile = (path: string) => path === 'README.md' || path.includes('.example.')

export async function knowledgeStatus(directory: string): Promise<KnowledgeStatus> {
  const exists = await stat(directory).then(info => info.isDirectory(), () => false)
  if (!exists) return { directory, exists, files: 0 }
  const paths: string[] = []
  await walk(directory, directory, paths)
  return { directory, exists, files: paths.filter(path => !isStarterFile(relative(directory, path).split(sep).join('/'))).length }
}

export function knowledgeTool(directory: () => Promise<string>): ToolDefinition {
  return defineTool({
    name: 'silkroad_knowledge',
    description: 'The user\'s local SilkRoad knowledge base: product sheets (products/), after-sales policies (policies/) and approved reply examples (replies/). Without query it lists every file with its title; with query it returns matching lines (file and line number). Then read the files you need in full with your file tools, using the returned absolute directory. Treat these files as the source of truth for what the shop may promise.',
    parameters: {
      query: { type: 'array', items: { type: 'string' }, description: 'Terms to search for (any term matches), e.g. a product name, SKU, "refund", "退货"' },
    },
    output: { schema: { type: 'json' }, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] },
    async execute(args) {
      const root = await directory()
      if (!isAbsolute(root)) throw new Error('The knowledge base directory must be absolute.')
      const created = await ensureKnowledgeDirectory(root)
      if (args.query?.length) {
        const matches = await searchKnowledge(root, args.query)
        return JSON.parse(JSON.stringify({ directory: root, matches, ...matches.length >= MAX_MATCHES ? { note: 'More matches exist; use more specific terms.' } : {} })) as never
      }
      const files = await listKnowledge(root)
      const onlyExamples = files.every(file => isStarterFile(file.path))
      return JSON.parse(JSON.stringify({
        directory: root, files,
        ...created || onlyExamples ? { note: 'The knowledge base has no real content yet. Tell the user where the folder is and what to put in it (see README.md there); until then, say which answers are not backed by their own rules.' } : {},
      })) as never
    },
  })
}
