import { describe, expect, it } from 'vitest'
import { canonicalizeProductUrl } from './priceTracker'

describe('canonicalizeProductUrl', () => {
  it('strips utm_*, gclid, fbclid, yclid', () => {
    expect(
      canonicalizeProductUrl('https://shop.by/p/123?utm_source=fb&utm_medium=cpc&gclid=x&fbclid=y&yclid=z'),
    ).toBe('https://shop.by/p/123')
  })

  it('strips ref / referrer / from / _ga*', () => {
    expect(canonicalizeProductUrl('https://shop.by/p/123?ref=newsletter&referrer=banner&from=email&_ga=1.2.3')).toBe(
      'https://shop.by/p/123',
    )
  })

  it('keeps id-like product variant params', () => {
    const url = canonicalizeProductUrl('https://shop.by/p?id=42&color=red&size=L&utm_source=ig')
    const parsed = new URL(url)
    expect(parsed.origin + parsed.pathname).toBe('https://shop.by/p')
    expect(parsed.searchParams.get('id')).toBe('42')
    expect(parsed.searchParams.get('color')).toBe('red')
    expect(parsed.searchParams.get('size')).toBe('L')
    expect(parsed.searchParams.has('utm_source')).toBe(false)
  })

  it('drops the URL hash', () => {
    expect(canonicalizeProductUrl('https://shop.by/p/123#reviews')).toBe('https://shop.by/p/123')
  })

  it('returns a stable key regardless of param order', () => {
    const a = canonicalizeProductUrl('https://shop.by/p?id=42&color=red')
    const b = canonicalizeProductUrl('https://shop.by/p?color=red&id=42')
    expect(a).toBe(b)
  })

  it('drops unknown query params (e.g. listing filters that are not product variants)', () => {
    const url = canonicalizeProductUrl('https://shop.by/cat?page=3&sort=price&id=42')
    const parsed = new URL(url)
    expect(parsed.searchParams.get('id')).toBe('42')
    expect(parsed.searchParams.has('page')).toBe(false)
    expect(parsed.searchParams.has('sort')).toBe(false)
  })

  it('falls back to raw url without hash on parse failure', () => {
    expect(canonicalizeProductUrl('not a url#frag')).toBe('not a url')
  })
})
