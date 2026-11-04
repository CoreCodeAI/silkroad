import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { ToolDefinition } from '@deepseek-ai/dsh-tools'
import { credentialRef } from '../src/keys.ts'
import { imageTool } from '../src/vendors/image.ts'
import { Hub } from '../src/hub.ts'
import { MemoryCredentials } from './fakes.ts'

const PNG = Buffer.from('89504e470d0a1a0a', 'hex')

async function run(tool: ToolDefinition, args: Record<string, unknown>) {
  const execute = (tool as unknown as { execute: (a: unknown, e: unknown) => Promise<unknown> }).execute
  return execute(args, { signal: new AbortController().signal }) as Promise<{ files: string[]; mode: string; model: string }>
}

async function setup() {
  const credentials = new MemoryCredentials()
  await credentials.set(credentialRef('SILKROAD_IMAGE_API_KEY'), 'img-key')
  const hub = new Hub(credentials, new Map())
  await hub.setVendorSettings('image', { baseUrl: 'https://images.example.test/v1/', model: 'test-image-model' })
  const calls: { url: string; init?: RequestInit }[] = []
  const fetchFn = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), init })
    return Response.json({ data: [{ b64_json: PNG.toString('base64') }, { b64_json: PNG.toString('base64') }] })
  }) as typeof fetch
  const tool = imageTool({ credentials, fetchFn, settings: id => hub.vendorSettings(id) })
  const dir = await mkdtemp(join(tmpdir(), 'silkroad-img-'))
  return { calls, tool, dir, hub, credentials }
}

describe('silkroad_generate_image', () => {
  it('generates from text with the user-configured endpoint and model and saves the files', async () => {
    const { calls, tool, dir } = await setup()
    const result = await run(tool, { prompt: 'white background product shot', size: '1024x1024', n: 2, output_dir: dir })
    expect(calls[0]!.url).toBe('https://images.example.test/v1/images/generations')
    expect(JSON.parse(String(calls[0]!.init!.body))).toEqual({ model: 'test-image-model', prompt: 'white background product shot', n: 2, size: '1024x1024' })
    expect(new Headers(calls[0]!.init!.headers).get('authorization')).toBe('Bearer img-key')
    expect(result.mode).toBe('text-to-image')
    expect(result.files).toHaveLength(2)
    expect(await readFile(result.files[0]!)).toEqual(PNG)
  })

  it('uses the edits endpoint with the real product photos as references', async () => {
    const { calls, tool, dir } = await setup()
    const photo = join(dir, 'photo.jpg')
    await writeFile(photo, Buffer.from('fake-jpeg'))
    const result = await run(tool, { prompt: 'place the product on a desk', reference_images: [photo], output_dir: dir })
    expect(calls[0]!.url).toBe('https://images.example.test/v1/images/edits')
    const form = calls[0]!.init!.body as FormData
    expect(form.get('model')).toBe('test-image-model')
    expect(form.getAll('image[]')).toHaveLength(1)
    expect(result.mode).toBe('edit-from-references')
  })

  it('rejects relative or unsupported reference paths and explains a missing key', async () => {
    const { tool, dir, credentials } = await setup()
    await expect(run(tool, { prompt: 'x', reference_images: ['photo.jpg'], output_dir: dir })).rejects.toThrow(/absolute/)
    await expect(run(tool, { prompt: 'x', reference_images: [join(dir, 'a.gif')], output_dir: dir })).rejects.toThrow(/PNG, JPEG or WebP/)
    await credentials.unset(credentialRef('SILKROAD_IMAGE_API_KEY'))
    await expect(run(tool, { prompt: 'x', output_dir: dir })).rejects.toThrow(/SilkRoad\) panel/)
  })

  it('refuses a non-https endpoint except loopback', async () => {
    const { hub } = await setup()
    await expect(hub.setVendorSettings('image', { baseUrl: 'http://evil.example/v1' })).rejects.toThrow(/https/)
    await hub.setVendorSettings('image', { baseUrl: 'http://127.0.0.1:8000/v1' })
    expect((await hub.vendorSettings('image')).baseUrl).toBe('http://127.0.0.1:8000/v1')
  })
})
