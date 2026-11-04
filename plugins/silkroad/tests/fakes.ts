import type { CredentialKey, CredentialRecordLike, CredentialRef, CredentialsLike } from '../src/credentials.ts'

/** In-memory stand-in for `ctx.credentials`. */
export class MemoryCredentials implements CredentialsLike {
  readonly values = new Map<string, string>()
  readonly records = new Map<string, CredentialRecordLike>()

  async resolve(ref: CredentialRef) { const value = this.values.get(ref); return value ? { value } : undefined }
  async describe(ref: CredentialRef) { return { configured: this.values.has(ref), writable: true } }
  async set(ref: CredentialRef, value: string) { if (!value) throw new Error('empty'); this.values.set(ref, value) }
  async unset(ref: CredentialRef) { this.values.delete(ref) }
  async readRecord(key: CredentialKey) { return structuredClone(this.records.get(key)) }
  async modifyRecord(key: CredentialKey, mutate: (current: CredentialRecordLike | undefined) => Promise<CredentialRecordLike | undefined>) {
    const next = await mutate(structuredClone(this.records.get(key)))
    if (next) this.records.set(key, structuredClone(next))
    return next
  }
  async deleteRecord(key: CredentialKey) { this.records.delete(key) }
}
