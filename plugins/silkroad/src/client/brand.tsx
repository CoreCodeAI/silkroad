/**
 * The 丝路 SilkRoad mark for plugin surfaces (the panel header). The product
 * shell draws the same mark through `SilkRoadMark` in the UI primitives.
 */
import { useId } from 'react'

/** The mark: a road winding across dunes toward a rising sun. */
export function BrandMark({ size = 24 }: { size?: number }) {
  const id = useId().replace(/:/g, '')
  return <svg width={size} height={size} viewBox="0 0 32 32" role="img" aria-label="SilkRoad">
    <defs>
      <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#f0b04a" />
        <stop offset="1" stopColor="#c2502a" />
      </linearGradient>
    </defs>
    <rect width="32" height="32" rx="8" fill={`url(#${id}-sky)`} />
    <circle cx="22.5" cy="9.5" r="4" fill="#fff4dc" />
    <path d="M0 23.5 Q9 19.5 17 23 T32 21.5 V32 H0 Z" fill="#7d2f17" opacity=".38" />
    <path d="M6.5 27 C12.5 27 10.5 18.5 16 18.5 S20.5 13 26 13" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
  </svg>
}
