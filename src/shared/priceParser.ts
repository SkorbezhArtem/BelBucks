import type { ParsedPrice } from './types'

const SPACE_CHARS = /[\s\u00A0\u202F]/g

function normalizeText(text: string): string {
  return text
    .replace(SPACE_CHARS, ' ')
    .replace(/[()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseLocalizedNumber(raw: string): number | null {
  // Keep digits + common separators, drop everything else.
  let s = raw.replace(/[^0-9.,'’\s]/g, '')
  s = s.replace(SPACE_CHARS, ' ').replace(/\s+/g, ' ').trim()
  if (!/\d/.test(s)) return null

  // Remove apostrophes used as thousand separators.
  s = s.replace(/['’]/g, '')

  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')

  let decimalSep: ',' | '.' | null = null
  if (lastComma !== -1 && lastDot !== -1) {
    // If both exist, assume last one is decimal if it looks like decimals (1-2 digits).
    const lastSep = lastComma > lastDot ? ',' : '.'
    const idx = Math.max(lastComma, lastDot)
    const decimals = s.slice(idx + 1).replace(/ /g, '')
    if (/^\d{1,2}$/.test(decimals)) decimalSep = lastSep as ',' | '.'
  } else if (lastComma !== -1) {
    const decimals = s.slice(lastComma + 1).replace(/ /g, '')
    // 1–2 digits → decimals; 3 digits often thousand grouping.
    if (/^\d{1,2}$/.test(decimals)) decimalSep = ','
  } else if (lastDot !== -1) {
    const decimals = s.slice(lastDot + 1).replace(/ /g, '')
    if (/^\d{1,2}$/.test(decimals)) decimalSep = '.'
    // Special case: "1.500" (likely thousands, not decimals)
    if (/^\d{3}$/.test(decimals)) decimalSep = null
  }

  // Drop spaces (thousand separators)
  s = s.replace(/ /g, '')

  if (decimalSep) {
    const thousandSep = decimalSep === ',' ? '.' : ','
    s = s.replaceAll(thousandSep, '')
    s = s.replace(decimalSep, '.')
  } else {
    // No decimal separator: treat dots/commas as thousand separators
    s = s.replace(/[.,]/g, '')
  }

  const n = Number.parseFloat(s)
  if (!Number.isFinite(n)) return null
  return n
}

export function parseBynPrice(text: string, options?: { assumeByn?: boolean }): ParsedPrice | null {
  const raw = normalizeText(text)
  const lower = raw.toLowerCase()

  // "коп." / "копеек" — treat as BYN cents
  const kopMatch = lower.match(/(\d[\d\s\u00A0\u202F.,'’]*)\s*(коп|коп\.|копеек|копейки)/)
  if (kopMatch) {
    const k = parseLocalizedNumber(kopMatch[1])
    if (k == null) return null
    return { byn: k / 100, raw: kopMatch[0] }
  }

  // Heuristic: parse first number token and assume it's BYN if context looks like BYN
  // (We’ll strengthen this later with site presets / context signals.)
  const currencyHint = /(byn|br|руб|бел\.?\s*(?:руб|р)\.?|(^|\s)р\.?($|\s)|ƃ)/i.test(raw)
  if (!currencyHint && !options?.assumeByn) return null

  const numMatch = raw.match(/(\d[\d\s\u00A0\u202F.,'’]*)/)
  if (!numMatch) return null

  const value = parseLocalizedNumber(numMatch[1])
  if (value == null) return null
  return { byn: value, raw: numMatch[0] }
}

