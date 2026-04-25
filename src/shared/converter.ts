import type { TargetCurrency } from './types'

export function applyMarkup(rateBynPerTarget: number, markupPercent: number): number {
  return rateBynPerTarget * (1 + markupPercent / 100)
}

/**
 * @param byn Amount in BYN
 * @param rateBynPerTarget 1 TARGET = X BYN
 */
export function convertBynToTarget(
  byn: number,
  rateBynPerTarget: number,
  markupPercent: number,
): number {
  const effectiveRate = applyMarkup(rateBynPerTarget, markupPercent)
  return byn / effectiveRate
}

export function formatTargetCurrency(value: number, currency: TargetCurrency): string {
  // Keep formatting stable regardless of user's OS locale.
  const nf = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  })
  return nf.format(value)
}

