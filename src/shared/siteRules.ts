import type { SiteDefaultMode, SiteRule } from './types'

export function normalizeHost(host: string): string {
  return host.trim().toLowerCase()
}

export function normalizePattern(pattern: string): string {
  return pattern.trim().toLowerCase()
}

/**
 * Normalize free-form user input from the "Add rule" / "Quick check" fields
 * into the canonical form the matcher expects.
 *
 * Accepted shapes:
 *   "https://kwork.ru/path?x=1"      → "kwork.ru"
 *   "http://www.onliner.by"           → "onliner.by"
 *   "WWW.Catalog.Onliner.BY/some/p"   → "catalog.onliner.by"
 *   "kwork.ru"                        → "kwork.ru"   (unchanged)
 *   "*.onliner.by"                    → "*.onliner.by" (wildcard preserved)
 *   "   "                             → ""
 *
 * Anything we can't parse falls back to the lowercased trimmed input —
 * that keeps custom patterns like "*.foo.com" or ad-hoc test strings
 * working without forcing the user to learn URL syntax.
 */
export function normalizeUserHostInput(input: string): string {
  const raw = input.trim().toLowerCase()
  if (!raw) return ''
  // Wildcard patterns are kept verbatim — they're meant to be sub-domain globs.
  if (raw.startsWith('*.')) return raw
  // Strip everything after the first '/' or '?' or '#' so that pasting a full
  // page URL still yields a hostname.
  const candidate = raw
    .replace(/^[a-z][a-z0-9+\-.]*:\/\//, '')
    .replace(/^\/\//, '')
    .split(/[\/?#]/, 1)[0]
    ?.replace(/^www\./, '')
    ?.replace(/:\d+$/, '')
  if (!candidate) return raw
  // If the candidate doesn't look like a hostname at all (no dot, no letters),
  // fall back to the raw input — better to save something the user typed than
  // to silently swallow it.
  if (!/[a-z0-9-]/.test(candidate)) return raw
  return candidate
}

export function matchesHost(pattern: string, host: string): boolean {
  const p = normalizePattern(pattern)
  const h = normalizeHost(host)

  if (!p) return false
  if (p === h) return true

  if (p.startsWith('*.')) {
    const suffix = p.slice(2)
    return h === suffix || h.endsWith(`.${suffix}`)
  }

  return false
}

function specificity(pattern: string): number {
  const p = normalizePattern(pattern)
  // Exact > wildcard; longer is more specific.
  const wildcardPenalty = p.startsWith('*.') ? 0 : 1000
  return wildcardPenalty + p.length
}

export function resolveSiteRule<T extends { pattern: string }>(rules: T[], host: string): T | null {
  const matched = rules.filter((r) => matchesHost(r.pattern, host))
  if (matched.length === 0) return null
  matched.sort((a, b) => specificity(b.pattern) - specificity(a.pattern))
  return matched[0] ?? null
}

export function isEnabledForSite(params: {
  enabledGlobal: boolean
  host: string
  defaultMode: SiteDefaultMode
  rules: SiteRule[]
}): boolean {
  if (!params.enabledGlobal) return false

  const rule = resolveSiteRule(params.rules, params.host)
  if (rule) return rule.mode === 'allow'

  return params.defaultMode === 'enabledEverywhere'
}

export function upsertHostRule(rules: SiteRule[], host: string, mode: SiteRule['mode']): SiteRule[] {
  const h = normalizeHost(host)
  const next = rules.filter((r) => normalizePattern(r.pattern) !== h)
  next.unshift({ pattern: h, mode })
  return next
}

export function upsertRule(rules: SiteRule[], rule: SiteRule): SiteRule[] {
  const p = normalizePattern(rule.pattern)
  if (!p) return rules
  const next = rules.filter((r) => normalizePattern(r.pattern) !== p)
  next.unshift({ pattern: p, mode: rule.mode })
  return next
}

export function removeRule(rules: SiteRule[], pattern: string): SiteRule[] {
  const p = normalizePattern(pattern)
  return rules.filter((r) => normalizePattern(r.pattern) !== p)
}

export function sortRulesForDisplay(rules: SiteRule[]): SiteRule[] {
  return [...rules].sort((a, b) => specificity(b.pattern) - specificity(a.pattern))
}


