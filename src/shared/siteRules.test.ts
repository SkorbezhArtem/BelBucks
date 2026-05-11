import { describe, expect, it } from 'vitest'
import {
  effectiveEnabledForSite,
  isEnabledForSite,
  matchesHost,
  normalizeUserHostInput,
  upsertRule,
} from './siteRules'
import type { SiteRule } from './types'

describe('normalizeUserHostInput', () => {
  it('returns empty for blank input', () => {
    expect(normalizeUserHostInput('')).toBe('')
    expect(normalizeUserHostInput('   ')).toBe('')
  })

  it('lowercases plain hostnames unchanged', () => {
    expect(normalizeUserHostInput('kwork.ru')).toBe('kwork.ru')
    expect(normalizeUserHostInput('Catalog.Onliner.By')).toBe('catalog.onliner.by')
  })

  it('strips http/https scheme and trailing path', () => {
    expect(normalizeUserHostInput('https://kwork.ru/')).toBe('kwork.ru')
    expect(normalizeUserHostInput('http://onliner.by/catalog/computer')).toBe('onliner.by')
    expect(normalizeUserHostInput('HTTPS://Kwork.RU/foo?bar=1#anchor')).toBe('kwork.ru')
  })

  it('strips protocol-relative prefix', () => {
    expect(normalizeUserHostInput('//cdn.example.com/path')).toBe('cdn.example.com')
  })

  it('strips leading www.', () => {
    expect(normalizeUserHostInput('www.fk.by')).toBe('fk.by')
    expect(normalizeUserHostInput('https://www.kwork.ru/services')).toBe('kwork.ru')
  })

  it('strips trailing port', () => {
    expect(normalizeUserHostInput('localhost:3000')).toBe('localhost')
    expect(normalizeUserHostInput('https://staging.shop.by:8443/path')).toBe('staging.shop.by')
  })

  it('preserves wildcard patterns verbatim', () => {
    expect(normalizeUserHostInput('*.onliner.by')).toBe('*.onliner.by')
    expect(normalizeUserHostInput('  *.SHOP.by  ')).toBe('*.shop.by')
  })

  it('falls back to the trimmed input when nothing parseable is left', () => {
    expect(normalizeUserHostInput('???')).toBe('???')
    expect(normalizeUserHostInput('/// ')).toBe('///')
  })
})

describe('isEnabledForSite + normalizeUserHostInput integration', () => {
  // Regression for the kwork.ru bug: a user pastes "https://kwork.ru/" into
  // the "Add rule" field. After we normalize on save, the stored pattern is
  // "kwork.ru" and the content-script hostname "kwork.ru" matches it.
  it('blocks a hostname when the rule was added as a full URL', () => {
    const pattern = normalizeUserHostInput('https://kwork.ru/')
    const rules: SiteRule[] = upsertRule([], { pattern, mode: 'block' })

    expect(rules).toEqual([{ pattern: 'kwork.ru', mode: 'block' }])
    expect(matchesHost(rules[0].pattern, 'kwork.ru')).toBe(true)
    expect(
      isEnabledForSite({
        enabledGlobal: true,
        host: 'kwork.ru',
        defaultMode: 'enabledEverywhere',
        rules,
      }),
    ).toBe(false)
  })

  // The old behaviour silently saved "https://kwork.ru/" as-is, then failed
  // to match at runtime. This test pins the matcher to that exact mismatch so
  // we don't regress to the broken state without noticing.
  it('does NOT match when a rule was saved with the raw URL form', () => {
    const rules: SiteRule[] = [{ pattern: 'https://kwork.ru/', mode: 'block' }]
    expect(matchesHost(rules[0].pattern, 'kwork.ru')).toBe(false)
    expect(
      isEnabledForSite({
        enabledGlobal: true,
        host: 'kwork.ru',
        defaultMode: 'enabledEverywhere',
        rules,
      }),
    ).toBe(true)
  })
})

describe('effectiveEnabledForSite', () => {
  it('respects the global off switch above everything else', () => {
    expect(
      effectiveEnabledForSite({
        enabledGlobal: false,
        host: 'onliner.by',
        defaultMode: 'enabledEverywhere',
        rules: [{ pattern: 'onliner.by', mode: 'allow' }],
      }),
    ).toBe(false)
  })

  it('lets explicit allow rules override the TLD heuristic on foreign hosts', () => {
    const rules: SiteRule[] = [{ pattern: 'kwork.ru', mode: 'allow' }]
    expect(
      effectiveEnabledForSite({
        enabledGlobal: true,
        host: 'kwork.ru',
        defaultMode: 'enabledEverywhere',
        rules,
      }),
    ).toBe(true)
  })

  it('lets explicit block rules win even on .by hosts', () => {
    const rules: SiteRule[] = [{ pattern: 'onliner.by', mode: 'block' }]
    expect(
      effectiveEnabledForSite({
        enabledGlobal: true,
        host: 'onliner.by',
        defaultMode: 'enabledEverywhere',
        rules,
      }),
    ).toBe(false)
  })

  it('disables foreign hosts by default (the kwork.ru bug)', () => {
    expect(
      effectiveEnabledForSite({
        enabledGlobal: true,
        host: 'kwork.ru',
        defaultMode: 'enabledEverywhere',
        rules: [],
      }),
    ).toBe(false)
  })

  it('enables .by hosts when defaultMode is enabledEverywhere', () => {
    expect(
      effectiveEnabledForSite({
        enabledGlobal: true,
        host: 'catalog.onliner.by',
        defaultMode: 'enabledEverywhere',
        rules: [],
      }),
    ).toBe(true)
  })

  it('still respects defaultMode=disabledEverywhere on .by hosts', () => {
    expect(
      effectiveEnabledForSite({
        enabledGlobal: true,
        host: 'catalog.onliner.by',
        defaultMode: 'disabledEverywhere',
        rules: [],
      }),
    ).toBe(false)
  })
})
