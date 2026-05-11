import type { SiteRule } from './types'
import { resolveSiteRule } from './siteRules'

/**
 * BelBucks is a BYN-only converter. Running it on hosts that *don't* show BYN
 * prices (kwork.ru, aliexpress.com, etc.) just rewrites foreign numerals as if
 * they were Belarusian rubles, which is worse than doing nothing.
 *
 * To avoid that, we gate the whole extension behind a coarse host-level
 * heuristic before the per-element currency checks even run:
 *
 *   - `.by` TLD                  → 'byn'      (default on)
 *   - host in BYN_HOST_ALLOWLIST → 'byn'      (carveout for known BY shops
 *                                              that live on a non-`.by` TLD)
 *   - anything else              → 'foreign'  (default off, user can override
 *                                              with an explicit allow rule)
 *
 * An explicit user rule (block or allow) always wins over the heuristic —
 * that's the whole point of letting people enable the extension on a
 * foreign-TLD site they trust.
 */

/**
 * Hosts that are NOT on `.by` but should still be treated as BYN-using by
 * default. Currently empty: every curated preset in this repo lives on a
 * `.by` TLD, so the heuristic is fully covered by the TLD rule. Add entries
 * here if a BY-only marketplace shows up on `.com` / `.io` / etc.
 *
 * Entries are matched as exact hostnames *and* as suffix-rooted subdomains —
 * i.e. `"belbucks.com"` here matches both `belbucks.com` and `m.belbucks.com`.
 */
const BYN_HOST_ALLOWLIST: ReadonlySet<string> = new Set<string>([])

export type HostCurrencyClass = 'byn' | 'foreign'

function normalizeHost(host: string): string {
  return host.trim().toLowerCase().replace(/:\d+$/, '')
}

export function classifyHostByCurrency(host: string): HostCurrencyClass {
  const h = normalizeHost(host)
  if (!h) return 'foreign'
  if (h === 'by' || h.endsWith('.by')) return 'byn'
  if (BYN_HOST_ALLOWLIST.has(h)) return 'byn'
  for (const allow of BYN_HOST_ALLOWLIST) {
    if (h.endsWith(`.${allow}`)) return 'byn'
  }
  return 'foreign'
}

export function isLikelyBynHost(host: string): boolean {
  return classifyHostByCurrency(host) === 'byn'
}

/**
 * Returns true iff the extension would currently be running on this host only
 * because of the heuristic — i.e. the user hasn't made an explicit decision.
 * The popup uses this to show a "we turned this off automatically, enable
 * here?" banner without nagging on every page.
 */
export function isGatedByCurrencyHeuristic(params: {
  host: string
  rules: SiteRule[]
}): boolean {
  if (!params.host) return false
  if (resolveSiteRule(params.rules, params.host)) return false
  return !isLikelyBynHost(params.host)
}
