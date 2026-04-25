export interface SitePreset {
  id: string
  match: (loc: Location) => boolean
  priceSelectors: string[]
  excludeSelectors?: string[]
  mutationScopeSelector?: string
}

const PRESETS: SitePreset[] = [
  {
    id: 'kufar',
    match: (loc) => /(^|\.)kufar\.by$/i.test(loc.hostname),
    priceSelectors: [
      '[data-name*="price" i]',
      '[class*="price" i]',
      '[class*="cost" i]',
      '[class*="amount" i]',
    ],
    excludeSelectors: ['[class*="profile" i]', '[class*="seller" i]', '[class*="user" i]'],
  },
  {
    id: 'onliner',
    match: (loc) => /(^|\.)onliner\.by$/i.test(loc.hostname),
    priceSelectors: [
      '.schema-product__price',
      '.offers-description__price',
      '.b-offers__price',
      '.catalog-masthead__price',
      '.product-aside__price',
      '.product-aside__price--primary',
      '.catalog-form__offers-part__price',
      '.catalog-offers__price',
      '[class*="money" i]',
      '[class*="cash" i]',
      '.price-primary',
      '.price',
      '[data-bind*="price" i]',
      '[data-price]',
      '[class*="price" i]',
    ],
    excludeSelectors: ['[class*="installment" i]', '[class*="credit" i]'],
  },
  {
    id: 'shop',
    match: (loc) => /(^|\.)shop\.by$/i.test(loc.hostname),
    priceSelectors: [
      '.price',
      '.price-value',
      '.price_main',
      '.product-price',
      '.offer-price',
      '.model-price',
      '[class*="price" i]',
      '[class*="cost" i]',
      '[class*="money" i]',
      '[data-price]',
    ],
    excludeSelectors: ['[class*="installment" i]', '[class*="credit" i]', '[class*="rating" i]'],
  },
  {
    id: '21vek',
    match: (loc) => /(^|\.)21vek\.by$/i.test(loc.hostname),
    priceSelectors: [
      '.g-price__current',
      '.price__current',
      '[class*="style_price__"]',
      '[class*="style_salePrice__"]',
      '[class*="style_currentPrice__"]',
      '[class*="style_oldPrice__"]',
      '[class*="PriceBlock"]',
      '[class*="priceBlock"]',
      '[data-testid*="price" i]',
      '[class*="price" i]',
    ],
    excludeSelectors: ['[class*="installment" i]', '[class*="credit" i]', '[class*="discount" i]'],
  },
  {
    id: '7745',
    match: (loc) => /(^|\.)7745\.by$/i.test(loc.hostname),
    priceSelectors: [
      '.catalog_item_price .price',
      '.product_price .price',
      '.price',
      '[class*="price" i]',
      '[class*="cost" i]',
      '[data-price]',
    ],
    excludeSelectors: ['[class*="installment" i]', '[class*="credit" i]', '[class*="discount" i]'],
  },
  {
    id: 'wildberries',
    match: (loc) => /(^|\.)wildberries\.by$/i.test(loc.hostname),
    priceSelectors: [
      '.price__lower-price',
      '.product-card__price',
      '.product-page__price',
      '[class*="price" i]',
    ],
  },
  {
    id: 'ozon',
    match: (loc) => /(^|\.)ozon\.by$/i.test(loc.hostname),
    priceSelectors: [
      '[data-widget*="webPrice" i]',
      '[data-widget*="price" i]',
      '[class*="price" i]',
      '[class*="amount" i]',
    ],
  },
  {
    id: 'av',
    match: (loc) => /(^|\.)av\.by$/i.test(loc.hostname),
    priceSelectors: ['.card-price', '.listing-item__price', '[class*="price" i]', '[data-testid*="price" i]'],
  },
  {
    id: 'realt',
    match: (loc) => /(^|\.)realt\.by$/i.test(loc.hostname),
    priceSelectors: ['.price', '.object__price', '[class*="price" i]', '[class*="cost" i]'],
  },
]

const GENERIC: SitePreset = {
  id: 'generic',
  match: () => true,
  priceSelectors: [
    '[data-testid*="price" i]',
    '[class*="price" i]',
    '[class*="cost" i]',
    '[class*="amount" i]',
  ],
}

export function getPresetForLocation(loc: Location): SitePreset | null {
  for (const p of PRESETS) if (p.match(loc)) return p
  return GENERIC.match(loc) ? GENERIC : null
}

