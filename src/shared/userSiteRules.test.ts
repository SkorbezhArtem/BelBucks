import { describe, expect, it } from 'vitest'
import type { UserSiteRule } from './types'
import { findUserSiteRule, pushSelector, upsertUserSiteRule } from './userSiteRules'

describe('findUserSiteRule', () => {
  const rules: UserSiteRule[] = [
    { host: 'shop.by', currentPrice: ['.price'] },
    { host: 'kufar.by', oldPrice: ['.old'] },
  ]

  it('returns null when no rule matches', () => {
    expect(findUserSiteRule(rules, 'unknown.by')).toBeNull()
  })

  it('matches case-insensitively', () => {
    expect(findUserSiteRule(rules, 'SHOP.BY')?.currentPrice).toEqual(['.price'])
  })

  it('returns null on empty list', () => {
    expect(findUserSiteRule([], 'shop.by')).toBeNull()
  })
})

describe('pushSelector', () => {
  it('returns the existing list when selector is empty / whitespace', () => {
    expect(pushSelector(['.a'], '')).toEqual(['.a'])
    expect(pushSelector(['.a'], '   ')).toEqual(['.a'])
  })

  it('returns [] when both list undefined and selector empty', () => {
    expect(pushSelector(undefined, '   ')).toEqual([])
  })

  it('appends a trimmed new selector', () => {
    expect(pushSelector(['.a'], '  .b  ')).toEqual(['.a', '.b'])
  })

  it('does not duplicate', () => {
    expect(pushSelector(['.a', '.b'], '.b')).toEqual(['.a', '.b'])
  })
})

describe('upsertUserSiteRule', () => {
  it('inserts a new rule for an unseen host', () => {
    const next = upsertUserSiteRule([], 'shop.by', (r) => ({ ...r, currentPrice: ['.x'] }))
    expect(next).toEqual([{ host: 'shop.by', currentPrice: ['.x'] }])
  })

  it('updates an existing rule for a known host (case-insensitive)', () => {
    const start: UserSiteRule[] = [{ host: 'shop.by', currentPrice: ['.x'] }]
    const next = upsertUserSiteRule(start, 'SHOP.BY', (r) => ({
      ...r,
      currentPrice: pushSelector(r.currentPrice, '.y'),
    }))
    expect(next).toHaveLength(1)
    expect(next[0]).toEqual({ host: 'shop.by', currentPrice: ['.x', '.y'] })
  })

  it('removes a rule when mutate empties every selector list', () => {
    const start: UserSiteRule[] = [
      { host: 'a.by', currentPrice: ['.x'] },
      { host: 'b.by', oldPrice: ['.y'] },
    ]
    const next = upsertUserSiteRule(start, 'a.by', (r) => ({ ...r, currentPrice: [] }))
    expect(next.map((r) => r.host)).toEqual(['b.by'])
  })

  it('does not mutate the original array', () => {
    const start: UserSiteRule[] = [{ host: 'a.by', currentPrice: ['.x'] }]
    const next = upsertUserSiteRule(start, 'b.by', (r) => ({ ...r, currentPrice: ['.y'] }))
    expect(start).toHaveLength(1)
    expect(next).toHaveLength(2)
  })
})
