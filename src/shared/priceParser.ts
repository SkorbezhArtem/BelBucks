import { hasNonBynMarker } from './currencyMarkers'
import type { ParsedPrice } from './types'

const SPACE_CHARS = /[\s\u00A0\u202F]/g

// Currency hint that lives at the *end* of a price token. Used to bind a digit
// run to a specific currency marker so a string like
//   "1 312 42 руб. 1 249.90 руб."
// picks "1 249.90 руб." (the right-most pair) instead of the orphan first
// number — which on real sites is almost always the obsolete crossed-out one.
const BYN_TAIL_RE =
  /(\d[\d\s\u00A0\u202F.,'’]*)\s*(?:byn|бел\.?\s*(?:руб|р)\.?|руб\.?|р\.|br|ƃ)/i

function normalizeText(text: string): string {
  return text
    .replace(SPACE_CHARS, ' ')
    .replace(/[()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Validate that runs of digits separated by spaces look like a valid 3-digit
 * thousands grouping. "1 312" / "12 345" / "1 234 567" → ok.
 * "1 312 42" / "12 34" → ambiguous (most likely a decimal point dropped from
 * "1 312.42"). We refuse to commit to a reading and ask the caller to skip.
 *
 * Strings without spaces and strings that mix digits with other separators
 * pass through unchanged — downstream code already handles those.
 */
function hasValidSpaceGrouping(s: string): boolean {
  if (!/\s/.test(s)) return true
  const compact = s.trim().replace(/\s+/g, ' ')
  if (!/^\d+(?: \d+)+$/.test(compact)) return true
  const groups = compact.split(' ')
  if (groups[0].length > 3) return false
  for (let i = 1; i < groups.length; i++) {
    if (groups[i].length !== 3) return false
  }
  return true
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

  // Validate space grouping on the integer part only — once we know which
  // side is decimals we can reject "1 312 42" without false-rejecting the
  // perfectly valid "1 312.42".
  const intEnd = decimalSep ? s.lastIndexOf(decimalSep) : s.length
  const integerPart = s.slice(0, intEnd)
  if (/\s/.test(integerPart) && !hasValidSpaceGrouping(integerPart)) return null

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

  // Hard refuse strings that carry an explicit non-BYN currency marker.
  // This pre-empts assumeByn so a "$60" never becomes 60 BYN on a noisy page.
  if (hasNonBynMarker(raw)) return null

  // "X руб. Y коп." — must be checked BEFORE bare kop fallback, otherwise
  // the kop regex matches "Y коп" alone and we silently lose the rubles part.
  const rubKop = parseRubKopPair(lower)
  if (rubKop != null) return { byn: rubKop, raw }

  // "коп." / "копеек" — treat as BYN cents
  const kopMatch = lower.match(/(\d[\d\s\u00A0\u202F.,'’]*)\s*(коп|коп\.|копеек|копейки)/)
  if (kopMatch) {
    const k = parseLocalizedNumber(kopMatch[1])
    if (k == null) return null
    return { byn: k / 100, raw: kopMatch[0] }
  }

  // Currency-bound match: prefer "<digits> <byn-marker>" pairs and pick the
  // last (right-most) one. On listings with old + current price both labelled
  // "руб." that gives us the current price; on a bare "1 500 BYN" it still
  // matches the only pair. Falls through to the legacy heuristic when there
  // is no inline currency marker and the caller passed assumeByn.
  let lastBound: RegExpExecArray | null = null
  const re = new RegExp(BYN_TAIL_RE.source, 'gi')
  let bound: RegExpExecArray | null = re.exec(raw)
  while (bound) {
    lastBound = bound
    bound = re.exec(raw)
  }
  if (lastBound) {
    const value = parseLocalizedNumber(lastBound[1])
    if (value != null) return { byn: value, raw: lastBound[0] }
  }

  // No BYN marker bound to a number. Fall back to the legacy heuristic only
  // when the caller explicitly opted in (assumeByn) or there's a currency hint
  // somewhere in the string.
  const currencyHint = /(byn|br|руб|бел\.?\s*(?:руб|р)\.?|(^|\s)р\.?($|\s)|ƃ)/i.test(raw)
  if (!currencyHint && !options?.assumeByn) return null

  const numMatch = raw.match(/(\d[\d\s\u00A0\u202F.,'’]*)/)
  if (!numMatch) return null

  const value = parseLocalizedNumber(numMatch[1])
  if (value == null) return null
  return { byn: value, raw: numMatch[0] }
}

/**
 * Detect the "X руб. Y коп." pattern (rubles and kopecks rendered as
 * separate sibling text fragments). Returns the merged BYN value or null.
 * Anchored to a "руб" / "р." marker so we don't accidentally swallow a
 * JSON-LD / breadcrumb where "руб" lives somewhere else on the page.
 */
function parseRubKopPair(lower: string): number | null {
  const m = lower.match(
    /(\d[\d\s\u00A0\u202F.,'’]*)\s*(?:руб(?:\.|\s|лей|ля|$)|р\.)\s*(\d{1,2})\s*(?:коп|копеек|копейки)/,
  )
  if (!m) return null
  const major = parseLocalizedNumber(m[1])
  if (major == null) return null
  const minor = Number.parseInt(m[2], 10)
  if (!Number.isFinite(minor) || minor < 0 || minor > 99) return null
  return major + minor / 100
}

