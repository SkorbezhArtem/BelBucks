import { describe, expect, it } from 'vitest'
import {
  classifyHostByCurrency,
  isGatedByCurrencyHeuristic,
  isLikelyBynHost,
} from './hostCurrencyHeuristic'
import type { SiteRule } from './types'

describe('classifyHostByCurrency', () => {
  it('treats .by hosts as BYN', () => {
    expect(classifyHostByCurrency('kwork.by')).toBe('byn')
    expect(classifyHostByCurrency('onliner.by')).toBe('byn')
    expect(classifyHostByCurrency('catalog.onliner.by')).toBe('byn')
    expect(classifyHostByCurrency('21vek.by')).toBe('byn')
  })

  it('treats foreign TLDs as foreign', () => {
    expect(classifyHostByCurrency('kwork.ru')).toBe('foreign')
    expect(classifyHostByCurrency('aliexpress.com')).toBe('foreign')
    expect(classifyHostByCurrency('amazon.de')).toBe('foreign')
    expect(classifyHostByCurrency('rozetka.com.ua')).toBe('foreign')
  })

  it('is case-insensitive', () => {
    expect(classifyHostByCurrency('ONLINER.BY')).toBe('byn')
    expect(classifyHostByCurrency('Kwork.RU')).toBe('foreign')
  })

  it('strips trailing ports', () => {
    expect(classifyHostByCurrency('onliner.by:443')).toBe('byn')
    expect(classifyHostByCurrency('localhost:3000')).toBe('foreign')
  })

  it('does not match `by` inside a longer TLD', () => {
    // .byz, .byl, etc. are not Belarusian; only the literal ".by" TLD or
    // the bare "by" hostname should match.
    expect(classifyHostByCurrency('foo.byz')).toBe('foreign')
    expect(classifyHostByCurrency('something.cyby')).toBe('foreign')
  })

  it('returns foreign for blank / garbage input', () => {
    expect(classifyHostByCurrency('')).toBe('foreign')
    expect(classifyHostByCurrency('   ')).toBe('foreign')
  })
})

describe('isLikelyBynHost', () => {
  it('mirrors classifyHostByCurrency', () => {
    expect(isLikelyBynHost('onliner.by')).toBe(true)
    expect(isLikelyBynHost('kwork.ru')).toBe(false)
  })
})

describe('isGatedByCurrencyHeuristic', () => {
  it('returns true when host is foreign and has no rule', () => {
    expect(isGatedByCurrencyHeuristic({ host: 'kwork.ru', rules: [] })).toBe(true)
  })

  it('returns false when host is BYN even without a rule', () => {
    expect(isGatedByCurrencyHeuristic({ host: 'onliner.by', rules: [] })).toBe(false)
  })

  it('returns false when an explicit allow rule exists (user override)', () => {
    const rules: SiteRule[] = [{ pattern: 'kwork.ru', mode: 'allow' }]
    expect(isGatedByCurrencyHeuristic({ host: 'kwork.ru', rules })).toBe(false)
  })

  it('returns false when an explicit block rule exists (user has already decided)', () => {
    // Heuristic banner would be redundant if the user has already blocked.
    const rules: SiteRule[] = [{ pattern: 'kwork.ru', mode: 'block' }]
    expect(isGatedByCurrencyHeuristic({ host: 'kwork.ru', rules })).toBe(false)
  })

  it('honors wildcard rules', () => {
    const rules: SiteRule[] = [{ pattern: '*.kwork.ru', mode: 'allow' }]
    expect(isGatedByCurrencyHeuristic({ host: 'help.kwork.ru', rules })).toBe(false)
  })
})
