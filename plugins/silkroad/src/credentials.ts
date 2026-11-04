/**
 * The slice of `ctx.credentials` SilkRoad uses. Keeping it narrow lets the
 * connectors run against an in-memory fake in tests.
 */
import type { CredentialKey, CredentialRef } from '@deepseek-ai/dsh-credentials'

export type { CredentialKey, CredentialRef }

export type CredentialRecordLike =
  | { readonly kind: 'api-key'; readonly key?: string; readonly env?: Readonly<Record<string, string>> }
  | { readonly kind: 'grant'; readonly payload: unknown }

export interface CredentialsLike {
  resolve(ref: CredentialRef): Promise<{ value: string } | undefined>
  describe(ref: CredentialRef): Promise<{ configured: boolean; writable: boolean; source?: unknown }>
  set(ref: CredentialRef, value: string): Promise<void>
  unset(ref: CredentialRef): Promise<void>
  readRecord(key: CredentialKey): Promise<CredentialRecordLike | undefined>
  modifyRecord(
    key: CredentialKey,
    mutate: (current: CredentialRecordLike | undefined) => Promise<CredentialRecordLike | undefined>,
  ): Promise<CredentialRecordLike | undefined>
  deleteRecord(key: CredentialKey): Promise<void>
}
