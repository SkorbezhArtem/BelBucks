import type { SiteDefaultMode, SiteRule } from './types'

export function normalizeHost(host: string): string {
  return host.trim().toLowerCase()
}

export function normalizePattern(pattern: string): string {
  return pattern.trim().toLowerCase()
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

export function resolveSiteRule(rules: SiteRule[], host: string): SiteRule | null {
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

