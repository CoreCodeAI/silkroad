/** Official 丝路 SilkRoad occupant for the sidebar brand-mark slot. */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import { OfficialBrandMark } from './Brand.tsx'

/** Required service: the UI slot registry. */
export const inject = ['slots']

/**
 * Fill the sidebar brand mark in official builds. The brand name stays on the
 * sidebar's localized fallback (丝路 / SilkRoad), and the conversation hero
 * keeps its declaring package's SilkRoad mark fallback, so nothing else is
 * registered here.
 * @param ctx - Client root context.
 */
export function apply(ctx: ClientContext): void {
  if (process.env.DSH_CLIENT_BUILD_PROFILE !== 'official') return
  ctx.slots.inject('sidebar.brand.mark', () => ctx.slots.register({ name: 'sidebar.brand.mark' }, OfficialBrandMark))
}
