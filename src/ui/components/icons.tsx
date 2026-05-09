/**
 * Lightweight inline SVG icon set. All icons are 16x16, currentColor,
 * stroke-based, 1.6px stroke. Designed to read at small sizes inside
 * buttons / menu items / badges in the popup and options page.
 */
import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function base({ size = 16, strokeWidth = 1.6, ...rest }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    ...rest,
  }
}

export function IconRefresh(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M13.5 7.5a5.5 5.5 0 1 0-1.6 4.6" />
      <path d="M13.5 3.5v3.5h-3.5" />
    </svg>
  )
}

export function IconSettings(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="8" cy="8" r="2.2" />
      <path d="M8 1.5v1.6M8 12.9v1.6M14.5 8h-1.6M3.1 8H1.5M12.6 3.4l-1.1 1.1M4.5 11.5 3.4 12.6M12.6 12.6l-1.1-1.1M4.5 4.5 3.4 3.4" />
    </svg>
  )
}

export function IconTarget(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="8" cy="8" r="6" />
      <circle cx="8" cy="8" r="2.5" />
      <path d="M8 1v2M8 13v2M1 8h2M13 8h2" />
    </svg>
  )
}

export function IconClose(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
    </svg>
  )
}

export function IconCheck(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 8.5 6.5 12 13 4.5" />
    </svg>
  )
}

export function IconChevronDown(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3.5 6 8 10.5 12.5 6" />
    </svg>
  )
}

export function IconExternal(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M9 3h4v4" />
      <path d="M13 3 7.5 8.5" />
      <path d="M12 9v3.5a.5.5 0 0 1-.5.5h-8a.5.5 0 0 1-.5-.5v-8a.5.5 0 0 1 .5-.5H7" />
    </svg>
  )
}

export function IconTrash(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M2.5 4.5h11" />
      <path d="M6 2.5h4" />
      <path d="M3.8 4.5l.6 8.4a1 1 0 0 0 1 .9h5.2a1 1 0 0 0 1-.9l.6-8.4" />
      <path d="M6.5 7v4M9.5 7v4" />
    </svg>
  )
}

export function IconPlus(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M8 2.5v11M2.5 8h11" />
    </svg>
  )
}

export function IconLink(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M9.5 7.5a3 3 0 0 0-4.2 0l-2 2a3 3 0 1 0 4.2 4.2l1-1" />
      <path d="M6.5 8.5a3 3 0 0 0 4.2 0l2-2a3 3 0 1 0-4.2-4.2l-1 1" />
    </svg>
  )
}

export function IconChart(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M2 13V3M13 13H2" />
      <path d="M3 10l2.5-3 2.5 2L11 5l2 2" />
    </svg>
  )
}

export function IconSparkle(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M8 2v3M8 11v3M2 8h3M11 8h3" />
      <path d="M8 5.5L9.5 8 8 10.5 6.5 8 8 5.5z" />
    </svg>
  )
}

export function IconTag(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M2.5 7.5V3a.5.5 0 0 1 .5-.5h4.5a1 1 0 0 1 .7.3l5 5a1 1 0 0 1 0 1.4l-4.5 4.5a1 1 0 0 1-1.4 0l-5-5a1 1 0 0 1-.3-.7z" />
      <circle cx="5.5" cy="5.5" r="0.7" fill="currentColor" />
    </svg>
  )
}

export function IconGlobe(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="8" cy="8" r="6" />
      <path d="M2 8h12" />
      <path d="M8 2c1.8 2 2.7 4 2.7 6S9.8 14 8 14s-2.7-2-2.7-6S6.2 2 8 2z" />
    </svg>
  )
}

export function IconPalette(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M8 2c3.3 0 6 2.5 6 5.5 0 1.7-1.3 3-3 3h-1.5c-.8 0-1.5.7-1.5 1.5 0 .4.2.8.4 1.1.3.3.4.6.4 1 0 .8-.6 1.4-1.4 1.4C4.7 15.5 2 12 2 8c0-3.3 2.7-6 6-6z" />
      <circle cx="5.5" cy="6" r="0.7" fill="currentColor" />
      <circle cx="8" cy="4.5" r="0.7" fill="currentColor" />
      <circle cx="10.7" cy="6" r="0.7" fill="currentColor" />
      <circle cx="11.5" cy="9" r="0.7" fill="currentColor" />
    </svg>
  )
}

export function IconLayers(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M8 2 1.5 5.5 8 9l6.5-3.5L8 2z" />
      <path d="M2 8.5 8 12l6-3.5" />
      <path d="M2 11.5 8 15l6-3.5" />
    </svg>
  )
}

export function IconMoon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M13.5 9.5A6 6 0 0 1 6.5 2.5a6 6 0 1 0 7 7z" />
    </svg>
  )
}

export function IconSun(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="8" cy="8" r="3" />
      <path d="M8 1.5v1.5M8 13v1.5M14.5 8h-1.5M3 8H1.5M12.6 3.4l-1.1 1.1M4.5 11.5 3.4 12.6M12.6 12.6l-1.1-1.1M4.5 4.5 3.4 3.4" />
    </svg>
  )
}

export function IconAuto(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="8" cy="8" r="6" />
      <path d="M8 2v12" />
      <path d="M8 2a6 6 0 0 0 0 12" fill="currentColor" stroke="none" />
    </svg>
  )
}
