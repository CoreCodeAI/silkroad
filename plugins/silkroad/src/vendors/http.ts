/** HTTP helper for vendor calls: timeout, cancellation, secret redaction and a result size cap. */

export class VendorError extends Error {
  constructor(readonly kind: 'auth' | 'missing-key' | 'upstream' | 'bad-request', message: string) { super(message) }
}

/** Results above this many characters are cut so one call cannot flood the context window. */
export const MAX_RESULT_CHARS = 40_000

export interface VendorRequest {
  label: string
  url: string
  init?: RequestInit
  secrets?: readonly (string | undefined)[]
  signal?: AbortSignal
  timeoutMs?: number
  fetchFn?: typeof fetch
}

export function redact(text: string, secrets: readonly (string | undefined)[] = []): string {
  let out = text
  for (const secret of secrets) {
    if (!secret) continue
    out = out.split(secret).join('***').split(encodeURIComponent(secret)).join('***')
  }
  return out
}

export async function requestJson(request: VendorRequest): Promise<unknown> {
  const { label, secrets = [] } = request
  const timeout = AbortSignal.timeout(request.timeoutMs ?? 60_000)
  const signal = request.signal ? AbortSignal.any([request.signal, timeout]) : timeout
  let response: Response
  try {
    response = await (request.fetchFn ?? fetch)(request.url, { ...request.init, signal })
  } catch (error) {
    if (request.signal?.aborted) throw error
    const reason = timeout.aborted ? 'timed out' : error instanceof Error ? error.message : String(error)
    throw new VendorError('upstream', redact(`${label} request failed: ${reason}`, secrets))
  }
  const text = await response.text()
  if (!response.ok) {
    const kind = response.status === 401 || response.status === 403 ? 'auth' : response.status === 400 ? 'bad-request' : 'upstream'
    throw new VendorError(kind, redact(`${label} returned HTTP ${response.status}: ${text.slice(0, 500)}`, secrets))
  }
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new VendorError('upstream', `${label} returned a non-JSON response`)
  }
}

/** Compact JSON text for the model, cut at {@link MAX_RESULT_CHARS} with an explicit marker. */
export function modelText(value: unknown): string {
  const text = JSON.stringify(value)
  if (text.length <= MAX_RESULT_CHARS) return text
  return `${text.slice(0, MAX_RESULT_CHARS)}\n[truncated: ${text.length - MAX_RESULT_CHARS} more characters; narrow the query to see the rest]`
}
