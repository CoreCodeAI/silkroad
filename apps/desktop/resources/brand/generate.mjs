#!/usr/bin/env node
/**
 * Generates every 丝路 SilkRoad icon from one mark: a road winding across
 * dunes toward a rising sun. Writes the SVG sources and rasterizes them.
 *
 *   node apps/desktop/resources/brand/generate.mjs
 *
 * Needs `@resvg/resvg-js` resolvable from NODE_PATH (not a workspace
 * dependency; install it in a scratch directory).
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(join(process.env.NODE_PATH ?? process.cwd(), 'noop.js'))
const { Resvg } = require('@resvg/resvg-js')

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../../../..')
const desktop = join(root, 'apps/desktop')

/** The mark drawn on a 1024 grid inside a rounded square with corner radius `rx`. */
function markBody(id, rx) {
  return `<defs>
  <linearGradient id="${id}-sky" x1="0" y1="0" x2="1024" y2="1024" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#F3B54F"/><stop offset="1" stop-color="#C2502A"/>
  </linearGradient>
  <radialGradient id="${id}-glow" cx="720" cy="304" r="300" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#FFF4DC" stop-opacity=".55"/><stop offset="1" stop-color="#FFF4DC" stop-opacity="0"/>
  </radialGradient>
  <clipPath id="${id}-clip"><rect width="1024" height="1024" rx="${rx}"/></clipPath>
</defs>
<g clip-path="url(#${id}-clip)">
  <rect width="1024" height="1024" fill="url(#${id}-sky)"/>
  <circle cx="720" cy="304" r="300" fill="url(#${id}-glow)"/>
  <circle cx="720" cy="304" r="128" fill="#FFF4DC"/>
  <path d="M0 752 Q288 624 544 736 T1024 688 V1024 H0 Z" fill="#7D2F17" fill-opacity=".38"/>
  <path d="M0 872 Q320 792 600 860 T1024 830 V1024 H0 Z" fill="#5C2110" fill-opacity=".22"/>
  <path d="M208 864 C400 864 336 592 512 592 S656 416 832 416" stroke="#FFFFFF" stroke-width="84" stroke-linecap="round" fill="none"/>
</g>`
}

/** A square canvas of `size` with the mark scaled to `inner` and centred, optional soft shadow. */
function icon({ size, inner, rx, shadow, id = 'sr' }) {
  const offset = (size - inner) / 2
  const scale = inner / 1024
  const filter = shadow ? `<filter id="${id}-shadow" x="-10%" y="-10%" width="120%" height="125%"><feDropShadow dx="0" dy="${Math.round(inner * 0.012)}" stdDeviation="${Math.round(inner * 0.014)}" flood-color="#5C2110" flood-opacity=".28"/></filter>` : ''
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="none" xmlns="http://www.w3.org/2000/svg">
<defs>${filter}</defs>
<g transform="translate(${offset} ${offset}) scale(${scale})"${shadow ? ` filter="url(#${id}-shadow)"` : ''}>
${markBody(id, rx)}
</g>
</svg>
`
}

/** Mark plus the 丝路 SilkRoad wordmark, for the Welcome window and the Windows installer. */
function wordmark({ width, height, color, markSize, fontSize }) {
  const scale = markSize / 1024
  const y = (height - markSize) / 2
  const textX = markSize + Math.round(markSize * 0.32)
  const baseline = height / 2 + fontSize * 0.36
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg">
<g transform="translate(0 ${y}) scale(${scale})">${markBody('wm', 230)}</g>
<text x="${textX}" y="${baseline}" font-family="PingFang SC, Hiragino Sans GB, Microsoft YaHei, Noto Sans CJK SC, sans-serif" font-size="${fontSize}" font-weight="600" fill="${color}">丝路<tspan dx="${Math.round(fontSize * 0.35)}" font-weight="500" fill-opacity=".72">SilkRoad</tspan></text>
</svg>
`
}

function png(svg, width) {
  return new Resvg(svg, { fitTo: { mode: 'width', value: width }, font: { loadSystemFonts: true } }).render().asPng()
}

async function emit(path, content) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, content)
  console.log('wrote', path.slice(root.length + 1))
}

const resources = join(desktop, 'resources')
// macOS: Apple's grid puts the 824px body inside a 1024 canvas.
const macos = icon({ size: 1024, inner: 824, rx: 185, shadow: true, id: 'mac' })
// Windows: nearly full-bleed with a smaller radius.
const windows = icon({ size: 1024, inner: 960, rx: 176, shadow: false, id: 'win' })
// About panel / Resources/icon.png (1104 canvas, like upstream).
const about = icon({ size: 1104, inner: 1024, rx: 230, shadow: true, id: 'about' })
const plain = icon({ size: 1024, inner: 1024, rx: 230, shadow: false, id: 'plain' })

await emit(join(resources, 'icon-macos.svg'), macos)
await emit(join(resources, 'icon-macos.png'), png(macos, 1024))
await emit(join(resources, 'icon-windows.svg'), windows)
await emit(join(resources, 'icon-windows.png'), png(windows, 1024))
await emit(join(resources, 'icon.svg'), about)
await emit(join(resources, 'icon.png'), png(about, 1104))
// Windows tray: PNG-entry ICO (the layout scripts/render-tray-icon.ts reads), one bitmap per display scale.
const traySizes = [16, 20, 24, 32, 40, 48, 64]
const trayBitmaps = traySizes.map(size => png(plain, size))
const directory = Buffer.alloc(6 + 16 * traySizes.length)
directory.writeUInt16LE(1, 2)
directory.writeUInt16LE(traySizes.length, 4)
let trayOffset = directory.length
traySizes.forEach((size, index) => {
  const at = 6 + 16 * index
  directory.writeUInt8(size, at)
  directory.writeUInt8(size, at + 1)
  directory.writeUInt16LE(1, at + 4)
  directory.writeUInt16LE(32, at + 6)
  directory.writeUInt32LE(trayBitmaps[index].length, at + 8)
  directory.writeUInt32LE(trayOffset, at + 12)
  trayOffset += trayBitmaps[index].length
})
await emit(join(resources, 'tray-windows.ico'), Buffer.concat([directory, ...trayBitmaps]))

// Web favicon (same mark in both color schemes).
await emit(join(root, 'apps/web/public/favicon.svg'), plain)
await emit(join(root, 'apps/web/public/favicon-dark.svg'), plain)

// Welcome window wordmark: SVG adapts to the color scheme.
await emit(join(desktop, 'renderer/assets/welcome-brand.svg'), wordmark({ width: 472, height: 40, color: 'var(--sr-ink)', markSize: 40, fontSize: 26 })
  .replace('fill="none" xmlns', 'fill="none" xmlns')
  .replace('<g ', '<style>:root{--sr-ink:#0f1115}@media (prefers-color-scheme: dark){:root{--sr-ink:#f9fafb}}</style>\n<g '))

// Windows installer art (1x and 2x, light and dark) and the uninstaller sidebar.
const installer = join(desktop, 'installer/assets')
for (const [name, color] of [['brand', '#0f1115'], ['brand-dark', '#f9fafb']]) {
  const svg = wordmark({ width: 600, height: 196, color, markSize: 96, fontSize: 52 })
  await emit(join(installer, `${name}.png`), png(svg, 600))
  await emit(join(installer, `${name}-2x.png`), png(svg, 1200))
}
const sidebar = `<svg width="164" height="314" viewBox="0 0 164 314" xmlns="http://www.w3.org/2000/svg"><rect width="164" height="314" fill="#FBF6EE"/><g transform="translate(34 40) scale(${96 / 1024})">${markBody('side', 230)}</g></svg>`
await emit(join(installer, 'uninstaller-sidebar.png'), png(sidebar, 164))
