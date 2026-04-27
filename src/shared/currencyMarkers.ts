/**
 * Markers that *unambiguously* indicate a NON-BYN currency.
 *
 * The rule is conservative: the regex must only match strings that cannot be
 * the Belarusian ruble. Ambiguous tokens like "р." or "руб" stay out — those
 * are decided elsewhere via DOM/JSON-LD context.
 */
export const NON_BYN_MARKER_RE =
  /(\$|€|₽|£|¥|zł|z\u0142|₴|\bUS?D\b|\bEUR\b|\bRUB\b|\bPLN\b|\bUAH\b|\bGBP\b|\bJPY\b|\bCZK\b|\bCHF\b|рос\.?\s*руб|российск\w*\s*руб|грив(?:ен|ны|на)|евро\b)/i

export function hasNonBynMarker(text: string): boolean {
  return NON_BYN_MARKER_RE.test(text)
}
