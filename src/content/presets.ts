export interface PriceRange {
  /** Minimum BYN amount that should be considered a real price on this host. */
  min: number
  /** Maximum BYN amount allowed before we treat the value as garbage / out of category. */
  max: number
}

export interface SitePreset {
  id: string
  match: (loc: Location) => boolean
  priceSelectors: string[]
  trackerPrimarySelectors?: string[]
  excludeSelectors?: string[]
  mutationScopeSelector?: string

  /**
   * Selectors that point at the *old / crossed-out* price. Anything matched here
   * is skipped during conversion and never recorded by the tracker.
   */
  oldPriceSelectors?: string[]

  /**
   * Single, canonical selector for the current product price on a product detail
   * page. The tracker only records when this selector matches exactly one node.
   */
  productPriceSelector?: string

  /**
   * Returns true if the current Location points at a product detail page (vs.
   * listing / category). Used to gate price-history recording.
   */
  isProductPage?: (loc: Location) => boolean

  /**
   * Per-host BYN range. When set, replaces the default global cap.
   * Real estate / cars need a much wider window than electronics.
   */
  priceRange?: PriceRange

  /**
   * Force-treat any matched price as BYN even when no inline currency hint
   * is present (used on hosts where the markup never spells out the unit).
   */
  forceAssumeByn?: boolean
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
      '.h_txt_ell.h_txt_t10',
      '.h_txt_ell',
      '.h_flx_nsh.h_txt_hdl',
      '.h_txt_hdl',
      '[class*="money" i]',
      '[class*="cash" i]',
      '.price-primary',
      '.price',
      '[data-bind*="price" i]',
      '[data-price]',
      '[class*="price" i]',
    ],
    trackerPrimarySelectors: [
      '.product-aside__price',
      '.product-aside__price--primary',
      '.catalog-masthead__price',
      '.schema-product__price',
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
    trackerPrimarySelectors: ['.g-price__current', '.price__current', '[class*="style_currentPrice__"]'],
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
    trackerPrimarySelectors: ['.catalog_item_price .price', '.product_price .price'],
    excludeSelectors: ['[class*="installment" i]', '[class*="credit" i]', '[class*="discount" i]'],
  },
  {
    id: 'newton',
    match: (loc) => /(^|\.)newton\.by$/i.test(loc.hostname),
    priceSelectors: [
      '.catalog_item_price .price',
      '.catalog-item-price .price',
      '.product_price .price',
      '.product-price .price',
      '.price',
      '[class*="price" i]',
      '[class*="cost" i]',
      '[data-price]',
    ],
    trackerPrimarySelectors: ['.catalog_item_price .price', '.catalog-item-price .price', '.product_price .price'],
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

