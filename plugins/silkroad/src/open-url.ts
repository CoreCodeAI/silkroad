/** Opens a URL in the user's default browser without a shell. */
import { spawn } from 'node:child_process'
import { isAbsolute } from 'node:path'

export function openInBrowser(url: string): Promise<void> {
  if (!/^https?:\/\//i.test(url)) return Promise.reject(new Error('Only http(s) URLs can be opened.'))
  const [command, args] = process.platform === 'darwin' ? ['open', [url]]
    : process.platform === 'win32' ? ['rundll32', ['url.dll,FileProtocolHandler', url]]
    : ['xdg-open', [url]]
  return new Promise((resolve, reject) => {
    const child = spawn(command, args as string[], { stdio: 'ignore', detached: true })
    child.once('error', reject)
    child.once('spawn', () => { child.unref(); resolve() })
  })
}

/** Reveals a local folder in the system file manager. */
export function openFolder(path: string): Promise<void> {
  if (!isAbsolute(path)) return Promise.reject(new Error('Folder path must be absolute.'))
  const [command, args] = process.platform === 'darwin' ? ['open', [path]]
    : process.platform === 'win32' ? ['explorer', [path]]
    : ['xdg-open', [path]]
  return new Promise((resolve, reject) => {
    const child = spawn(command, args as string[], { stdio: 'ignore', detached: true })
    child.once('error', reject)
    child.once('spawn', () => { child.unref(); resolve() })
  })
}
