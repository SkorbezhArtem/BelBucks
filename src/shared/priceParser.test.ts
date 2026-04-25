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
})

