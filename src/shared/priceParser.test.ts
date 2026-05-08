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
})

