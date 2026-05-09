import { describe, expect, it } from 'vitest'
import { parseBynPrice } from './priceParser'

describe('parseBynPrice', () => {
  it('parses BYN with spaces and comma decimals', () => {
    expect(parseBynPrice('1 500,00 BYN')?.byn).toBe(1500)
  })

  it('parses BYN with dot as thousands', () => {
    expect(parseBynPrice('1.500 р.')?.byn).toBe(1500)
  })

  it('parses BYN with simple integer', () => {
    expect(parseBynPrice('1500 BYN')?.byn).toBe(1500)
  })

  it('parses kopecks', () => {
    expect(parseBynPrice('15.5 коп.')?.byn).toBeCloseTo(0.155, 6)
    expect(parseBynPrice('15 коп')?.byn).toBeCloseTo(0.15, 6)
  })

  it('returns null when currency hint missing', () => {
    expect(parseBynPrice('1500')).toBeNull()
  })

  it('parses Onliner-style currency symbol', () => {
    expect(parseBynPrice('от 1105,60 ƃ')?.byn).toBeCloseTo(1105.6, 6)
  })

  it('parses "бел. р." hint', () => {
    expect(parseBynPrice('1635,25 бел. р.')?.byn).toBeCloseTo(1635.25, 6)
  })

  describe('non-BYN markers', () => {
    it('refuses dollar prices', () => {
      expect(parseBynPrice('$60')).toBeNull()
      expect(parseBynPrice('60 USD')).toBeNull()
      expect(parseBynPrice('4.26 $')).toBeNull()
      expect(parseBynPrice('$60', { assumeByn: true })).toBeNull()
    })

    it('refuses euro prices', () => {
      expect(parseBynPrice('€499')).toBeNull()
      expect(parseBynPrice('499 EUR')).toBeNull()
      expect(parseBynPrice('499 евро')).toBeNull()
    })

    it('refuses Russian ruble explicit markers', () => {
      expect(parseBynPrice('200 ₽')).toBeNull()
      expect(parseBynPrice('200 RUB')).toBeNull()
      expect(parseBynPrice('200 рос. руб.')).toBeNull()
    })

    it('refuses zloty / hryvnia / pound / yen', () => {
      expect(parseBynPrice('120 zł')).toBeNull()
      expect(parseBynPrice('120 PLN')).toBeNull()
      expect(parseBynPrice('500 ₴')).toBeNull()
      expect(parseBynPrice('£25')).toBeNull()
      expect(parseBynPrice('¥1000')).toBeNull()
    })

    it('does NOT refuse ambiguous "р." (kept for context-aware decision)', () => {
      expect(parseBynPrice('150 р.')?.byn).toBe(150)
    })
  })

  describe('rub + kop merging', () => {
    it('merges "X руб. Y коп." into a single BYN value', () => {
      expect(parseBynPrice('2 100 руб. 99 коп.')?.byn).toBeCloseTo(2100.99, 6)
      expect(parseBynPrice('15 руб. 50 коп.')?.byn).toBeCloseTo(15.5, 6)
      expect(parseBynPrice('1 руб. 5 коп.')?.byn).toBeCloseTo(1.05, 6)
    })

    it('merges short "р." form too', () => {
      expect(parseBynPrice('2100 р. 99 коп.')?.byn).toBeCloseTo(2100.99, 6)
    })

    it('still parses bare kopecks as fractional BYN', () => {
      expect(parseBynPrice('15 коп')?.byn).toBeCloseTo(0.15, 6)
      expect(parseBynPrice('99 коп.')?.byn).toBeCloseTo(0.99, 6)
    })
  })

  describe('right-most currency binding', () => {
    it('picks the right-most "<digits> руб." pair when both old and new prices share the marker', () => {
      // The crossed-out old price is the first in DOM order; the visible
      // current price is second. Without binding to the marker, the parser
      // would lock onto the first number and convert the wrong value.
      expect(parseBynPrice('1 312.42 руб. 1 249.90 руб.')?.byn).toBeCloseTo(1249.9, 6)
    })

    it('still works when only one pair is present', () => {
      expect(parseBynPrice('1 500,00 BYN')?.byn).toBe(1500)
      expect(parseBynPrice('от 1105,60 ƃ')?.byn).toBeCloseTo(1105.6, 6)
    })
  })

  describe('ambiguous space grouping', () => {
    it('refuses "1 312 42" (looks like a typo for "1 312.42")', () => {
      // Without the space-grouping check, parseLocalizedNumber would silently
      // interpret "1 312 42" as 131_242 — a 100x overshoot vs. the intended
      // 1_312.42. We refuse the reading entirely so downstream picks a
      // different variant or returns null.
      expect(parseBynPrice('1 312 42 руб.')).toBeNull()
    })

    it('still accepts proper 3-digit thousands grouping', () => {
      expect(parseBynPrice('1 234 руб.')?.byn).toBe(1234)
      expect(parseBynPrice('12 345 руб.')?.byn).toBe(12345)
      expect(parseBynPrice('1 234 567 руб.')?.byn).toBe(1234567)
    })

    it('accepts space-grouped integer with decimal part', () => {
      expect(parseBynPrice('1 234.56 руб.')?.byn).toBeCloseTo(1234.56, 6)
      expect(parseBynPrice('1 234 567,89 руб.')?.byn).toBeCloseTo(1234567.89, 6)
    })
  })
})

