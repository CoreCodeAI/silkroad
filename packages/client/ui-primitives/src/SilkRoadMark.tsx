import { useId } from 'react'
import type { IconProps } from './icons/props.ts'

/**
 * The 丝路 SilkRoad mark: a road winding across dunes toward a rising sun, on
 * an amber-to-terracotta square. Full-color artwork; it does not follow
 * `currentColor`. Gradient ids are per-instance so several marks can share a
 * document.
 * @param props.size - edge length in px (default 24).
 * @param props.className - extra class for layout placement.
 * @returns the decorative mark (hidden from assistive technology).
 */
export function SilkRoadMark({ size = 24, className }: IconProps) {
  const id = useId().replaceAll(':', '')
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F3B54F" />
          <stop offset="1" stopColor="#C2502A" />
        </linearGradient>
        <clipPath id={`${id}-clip`}><rect width="32" height="32" rx="7.2" /></clipPath>
      </defs>
      <g clipPath={`url(#${id}-clip)`}>
        <rect width="32" height="32" fill={`url(#${id}-sky)`} />
        <circle cx="22.5" cy="9.5" r="4" fill="#FFF4DC" />
        <path d="M0 23.5Q9 19.5 17 23T32 21.5V32H0Z" fill="#7D2F17" fillOpacity=".38" />
        <path d="M0 27.25Q10 24.75 18.75 26.9T32 25.95V32H0Z" fill="#5C2110" fillOpacity=".22" />
        <path d="M6.5 27C12.5 27 10.5 18.5 16 18.5S20.5 13 26 13" fill="none" stroke="#FFF" strokeWidth="2.6" strokeLinecap="round" />
      </g>
    </svg>
  )
}
