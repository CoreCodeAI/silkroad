import { SilkRoadMark } from '@deepseek-ai/dsh-client-ui-primitives'
import type { SidebarBrandMarkOwnerProps } from '@deepseek-ai/dsh-client-ui-sidebar/client'

/**
 * Render the 丝路 SilkRoad mark with the presentation requested by its host surface.
 * @param props - Host-supplied mark presentation.
 * @returns the SilkRoad mark.
 */
export function OfficialBrandMark({ size }: SidebarBrandMarkOwnerProps) {
  return <SilkRoadMark size={size} />
}
