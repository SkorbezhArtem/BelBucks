import { describe, expect, it } from 'vitest'
import type { RatesCache } from '../types'
import { RATES_CACHE_MAX_AGE_MS, isRatesCacheFresh, isRatesCacheUsable } from './ratesService'

function buildCache(overrides: Partial<RatesCache> = {}): RatesCache {
  return {
    fetchedAt: Date.now(),
    ttlMs: 60 * 60 * 1000,
    bynPerTarget: { USD: 3.2, EUR: 3.5, PLN: 0.8, RUB: 0.04 },
    provider: 'NBRB',
    requestedProvider: 'NBRB',
    ...overrides,
  }
}

describe('isRatesCacheFresh', () => {
  it('treats a just-fetched cache as fresh', () => {
    const now = 1_700_000_000_000
    const cache = buildCache({ fetchedAt: now - 1000, ttlMs: 60 * 60 * 1000 })
    expect(isRatesCacheFresh(cache, now)).toBe(true)
  })

  it('treats an expired-by-ttl cache as stale', () => {
    const now = 1_700_000_000_000
    const cache = buildCache({ fetchedAt: now - 2 * 60 * 60 * 1000, ttlMs: 60 * 60 * 1000 })
    expect(isRatesCacheFresh(cache, now)).toBe(false)
  })

  it('refuses cache older than 24h even if ttlMs is huge (the hard cap)', () => {
    const now = 1_700_000_000_000
    const cache = buildCache({
      fetchedAt: now - (RATES_CACHE_MAX_AGE_MS + 60_000),
      ttlMs: 365 * 24 * 60 * 60 * 1000,
    })
    expect(isRatesCacheFresh(cache, now)).toBe(false)
  })
})

describe('isRatesCacheUsable', () => {
  it('returns false when cache is null', () => {
    expect(isRatesCacheUsable(null)).toBe(false)
  })

  it('allows cache up to MAX_AGE old (we will still convert with a stale-warning UI)', () => {
    const now = 1_700_000_000_000
    const cache = buildCache({ fetchedAt: now - (RATES_CACHE_MAX_AGE_MS - 60_000) })
    expect(isRatesCacheUsable(cache, now)).toBe(true)
  })

  it('refuses cache older than MAX_AGE outright', () => {
    const now = 1_700_000_000_000
    const cache = buildCache({ fetchedAt: now - (RATES_CACHE_MAX_AGE_MS + 60_000) })
    expect(isRatesCacheUsable(cache, now)).toBe(false)
  })
})
