import type { UserSiteRule, UserSettings } from './types'

/**
 * Find the user-defined per-host rule that applies to the given hostname.
 * Hostname match is case-insensitive and exact (no wildcard support yet —
 * the popup writes one row per host).
 */
export function findUserSiteRule(rules: UserSiteRule[], host: string): UserSiteRule | null {
  const h = host.toLowerCase()
  for (const r of rules) if (r.host.toLowerCase() === h) return r
  return null
}

/**
 * Update / insert a user rule. When `mutate` returns an empty rule (every
 * list undefined or empty) the row is removed entirely so an unused row
 * doesn't keep occupying sync storage.
 */
export function upsertUserSiteRule(
  rules: UserSiteRule[],
  host: string,
  mutate: (existing: UserSiteRule) => UserSiteRule,
): UserSiteRule[] {
  const h = host.toLowerCase()
  const idx = rules.findIndex((r) => r.host.toLowerCase() === h)
  const existing: UserSiteRule = idx === -1 ? { host: h } : rules[idx]
  const next = mutate(existing)
  const isEmpty =
    !next.currentPrice?.length &&
    !next.productPrice?.length &&
    !next.oldPrice?.length &&
    !next.installment?.length &&
    !next.notAPrice?.length

  const out = rules.slice()
  if (isEmpty) {
    if (idx !== -1) out.splice(idx, 1)
    return out
  }
  if (idx === -1) out.push(next)
  else out[idx] = next
  return out
}

export function pushSelector(list: string[] | undefined, selector: string): string[] {
  const cleaned = (selector || '').trim()
  if (!cleaned) return list ?? []
  const next = list ? list.slice() : []
  if (!next.includes(cleaned)) next.push(cleaned)
  return next
}

export function getUserRuleForHost(settings: UserSettings, host: string): UserSiteRule | null {
  return findUserSiteRule(settings.userSiteRules ?? [], host)
}
