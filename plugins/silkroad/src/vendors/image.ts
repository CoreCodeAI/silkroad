/**
 * `silkroad_generate_image`: product images through any OpenAI Images
 * compatible service the user configures (endpoint, model and key are theirs).
 * With reference images it uses the edits endpoint, so real product photos
 * anchor the result; without them it generates from text alone.
 */
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { extname, isAbsolute, join } from 'node:path'
import { defineTool, type ToolDefinition } from '@deepseek-ai/dsh-tools'
import { credentialRef } from '../keys.ts'
import { vendorById } from './catalog.ts'
import { requestJson, VendorError } from './http.ts'
import type { VendorToolDeps } from './tools.ts'

const MIME: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }
const MAX_REFERENCE_BYTES = 20 * 1024 * 1024
const MAX_REFERENCES = 8

export function defaultImageDirectory(now = new Date()): string {
  const day = now.toISOString().slice(0, 10)
  return join(homedir(), 'SilkRoad', 'images', day)
}

async function referenceBlob(path: string): Promise<{ blob: Blob; name: string }> {
  if (!isAbsolute(path)) throw new VendorError('bad-request', `Reference image path must be absolute: ${path}`)
  const type = MIME[extname(path).toLowerCase()]
  if (!type) throw new VendorError('bad-request', `Reference image must be PNG, JPEG or WebP: ${path}`)
  const info = await stat(path).catch(() => undefined)
  if (!info?.isFile()) throw new VendorError('bad-request', `Reference image not found: ${path}`)
  if (info.size > MAX_REFERENCE_BYTES) throw new VendorError('bad-request', `Reference image is larger than 20 MB: ${path}`)
  return { blob: new Blob([await readFile(path)], { type }), name: path.split(/[\\/]/).pop()! }
}

async function imageBytes(item: { b64_json?: unknown; url?: unknown }, fetchFn: typeof fetch, signal: AbortSignal): Promise<Buffer> {
  if (typeof item.b64_json === 'string') return Buffer.from(item.b64_json, 'base64')
  if (typeof item.url === 'string' && /^https:\/\//.test(item.url)) {
    const response = await fetchFn(item.url, { signal })
    if (!response.ok) throw new VendorError('upstream', `Downloading the generated image failed: HTTP ${response.status}`)
    return Buffer.from(await response.arrayBuffer())
  }
  throw new VendorError('upstream', 'The image service returned an item with neither b64_json nor an https url.')
}

export function imageTool(deps: VendorToolDeps & { settings: (id: string) => Promise<Record<string, string>> }): ToolDefinition {
  const vendor = vendorById('image')!
  return defineTool({
    name: 'silkroad_generate_image',
    description: 'Generate product images (TikTok Shop main image, detail-page images, scene shots) with the image service the user configured in the 跨境电商 (SilkRoad) panel, 数据源 tab. Pass reference_images (absolute paths of the user\'s real product photos) whenever the product must look like the real item. Each call costs the user money: get approval on the image plan first. Returns the saved file paths.',
    parameters: {
      prompt: { type: 'string', required: true, description: 'Full image description; put any on-image text in quotes, in the target market language' },
      size: { type: 'string', description: 'WIDTHxHEIGHT supported by the model, e.g. 1024x1024 (main image), 1024x1536 (portrait detail)' },
      n: { type: 'integer', description: 'Number of images, 1 to 4 (default 1)' },
      reference_images: { type: 'array', items: { type: 'string' }, description: 'Absolute paths of PNG/JPEG/WebP reference photos (up to 8)' },
      output_dir: { type: 'string', description: 'Absolute directory to save into; defaults to ~/SilkRoad/images/<date>' },
    },
    output: {
      schema: { type: 'json' },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
    },
    async execute(args, exec) {
      const key = (await deps.credentials.resolve(credentialRef(vendor.credential)))?.value
      if (!key) {
        throw new VendorError('missing-key', 'Image generation is not configured. Ask the user to open the 跨境电商 (SilkRoad) panel in the left sidebar, 数据源 tab, and fill in the image service (endpoint, model, API key). Until then, deliver the image plan and prompts only.')
      }
      const settings = await deps.settings('image')
      const base = settings.baseUrl!.replace(/\/+$/, '')
      const n = Math.min(Math.max(Math.trunc(args.n ?? 1), 1), 4)
      const references = args.reference_images ?? []
      if (references.length > MAX_REFERENCES) throw new VendorError('bad-request', `At most ${MAX_REFERENCES} reference images.`)
      if (args.output_dir !== undefined && !isAbsolute(args.output_dir)) throw new VendorError('bad-request', 'output_dir must be an absolute path.')
      const fetchFn = deps.fetchFn ?? fetch
      const common = { label: 'Image service', secrets: [key], signal: exec.signal, timeoutMs: 300_000, fetchFn }

      let result: unknown
      if (references.length) {
        const form = new FormData()
        form.set('model', settings.model!)
        form.set('prompt', args.prompt)
        form.set('n', String(n))
        if (args.size) form.set('size', args.size)
        for (const path of references) {
          const { blob, name } = await referenceBlob(path)
          form.append('image[]', blob, name)
        }
        result = await requestJson({ ...common, url: `${base}/images/edits`, init: { method: 'POST', headers: { authorization: `Bearer ${key}` }, body: form } })
      } else {
        result = await requestJson({
          ...common, url: `${base}/images/generations`,
          init: {
            method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
            body: JSON.stringify({ model: settings.model, prompt: args.prompt, n, ...args.size ? { size: args.size } : {} }),
          },
        })
      }

      const items = (result as { data?: unknown }).data
      if (!Array.isArray(items) || !items.length) throw new VendorError('upstream', 'The image service returned no images.')
      const directory = args.output_dir ?? defaultImageDirectory()
      await mkdir(directory, { recursive: true })
      const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..*$/, '')
      const files: string[] = []
      for (const [index, item] of items.entries()) {
        const path = join(directory, `silkroad-${stamp}-${index + 1}.png`)
        await writeFile(path, await imageBytes(item as { b64_json?: unknown; url?: unknown }, fetchFn, exec.signal))
        files.push(path)
      }
      return JSON.parse(JSON.stringify({ files, model: settings.model, mode: references.length ? 'edit-from-references' : 'text-to-image', size: args.size ?? 'service default' })) as never
    },
  })
}
