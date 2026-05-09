import { useEffect, useMemo, useRef, useState } from 'react'
import type { TargetCurrency } from '../../shared/types'

export interface BadgePreviewProps {
  bg: string
  fg: string
  fontSizePx: number
  paddingYpx: number
  paddingXpx: number
  currency: TargetCurrency
  /** What 1 TARGET costs in BYN — controls the demo number on the right. */
  rate?: number
  /** Sample BYN price to convert. Defaults to 199.99. */
  bynPrice?: number
}

/**
 * Renders a faux product price + a BelBucks badge using the active style.
 * Used in the "Внешний вид" tab so the user sees the badge update live.
 */
export function BadgePreview({
  bg,
  fg,
  fontSizePx,
  paddingYpx,
  paddingXpx,
  currency,
  rate,
  bynPrice = 199.99,
}: BadgePreviewProps) {
  const symbol = useMemo(() => {
    switch (currency) {
      case 'USD':
        return '$'
      case 'EUR':
        return '€'
      case 'PLN':
        return 'zł'
      case 'RUB':
        return '₽'
      default:
        return ''
    }
  }, [currency])

  const value = useMemo(() => {
    if (!rate || !Number.isFinite(rate) || rate <= 0) return null
    return (bynPrice / rate).toFixed(2)
  }, [rate, bynPrice])

  // Briefly highlight when style props change to draw the eye.
  const ref = useRef<HTMLSpanElement | null>(null)
  const [tickKey, setTickKey] = useState(0)
  useEffect(() => {
    setTickKey((n) => n + 1)
  }, [bg, fg, fontSizePx, paddingYpx, paddingXpx])

  return (
    <div className="bb-previewSurface" aria-label="Live badge preview">
      <span className="bb-previewPrice">{bynPrice.toFixed(2)} BYN</span>
      <span
        ref={ref}
        key={tickKey}
        className="bb-previewBadge"
        style={{
          background: bg,
          color: fg,
          fontSize: `${fontSizePx}px`,
          padding: `${paddingYpx}px ${paddingXpx}px`,
          animation: 'bb-pulse 0.4s ease-out',
        }}
      >
        {value !== null ? `${symbol}${value}` : `${symbol}—`}
      </span>
    </div>
  )
}
