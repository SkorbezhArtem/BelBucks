import { describe, expect, it } from 'vitest'
import { extractCurrenciesFromJsonText } from './jsonLdCurrency'

describe('extractCurrenciesFromJsonText', () => {
  it('returns [] for empty / whitespace input', () => {
    expect(extractCurrenciesFromJsonText('')).toEqual([])
    expect(extractCurrenciesFromJsonText('   ')).toEqual([])
  })

  it('returns [] on broken JSON without throwing', () => {
    expect(extractCurrenciesFromJsonText('{not: json,}')).toEqual([])
  })

  it('reads a single Offer.priceCurrency', () => {
    const txt = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Product',
      offers: { '@type': 'Offer', price: '49.90', priceCurrency: 'BYN' },
    })
    expect(extractCurrenciesFromJsonText(txt)).toEqual(['BYN'])
  })

  it('reads currencies under AggregateOffer', () => {
    const txt = JSON.stringify({
      '@type': 'Product',
      offers: {
        '@type': 'AggregateOffer',
        offers: [
          { '@type': 'Offer', priceCurrency: 'USD', price: 60 },
          { '@type': 'Offer', priceCurrency: 'USD', price: 70 },
        ],
      },
    })
    expect(extractCurrenciesFromJsonText(txt)).toEqual(['USD', 'USD'])
  })

  it('reads multiple offers in a top-level array', () => {
    const txt = JSON.stringify([
      { '@type': 'Product', offers: { '@type': 'Offer', priceCurrency: 'EUR' } },
      { '@type': 'Product', offers: { '@type': 'Offer', priceCurrency: 'PLN' } },
    ])
    expect(extractCurrenciesFromJsonText(txt).sort()).toEqual(['EUR', 'PLN'])
  })

  it('uppercases and trims', () => {
    const txt = JSON.stringify({ priceCurrency: ' byn ' })
    expect(extractCurrenciesFromJsonText(txt)).toEqual(['BYN'])
  })

  it('ignores priceCurrency that is not a 3-char code', () => {
    expect(extractCurrenciesFromJsonText(JSON.stringify({ priceCurrency: 'XX' }))).toEqual([])
    expect(extractCurrenciesFromJsonText(JSON.stringify({ priceCurrency: '' }))).toEqual([])
  })

  it('walks deeply nested structures', () => {
    const txt = JSON.stringify({
      a: {
        b: {
          c: [{ d: { priceCurrency: 'RUB' } }, { priceCurrency: 'USD' }],
        },
      },
    })
    expect(extractCurrenciesFromJsonText(txt).sort()).toEqual(['RUB', 'USD'])
  })
})
