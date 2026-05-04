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
    trackerPrimarySelectors: [
      'h3[class*="styles_price__" i]',
      '[data-name="price-byn"]',
      '[class*="styles_price__byr" i]',
    ],
    productPriceSelector: '[data-name="price-byn"]',
    oldPriceSelectors: [
      '[class*="oldPrice" i]',
      '[class*="old_price" i]',
      '[class*="strike" i]',
    ],
    excludeSelectors: [
      '[class*="profile" i]',
      '[class*="seller" i]',
      '[class*="user" i]',
      '[class*="phone" i]',
      '[class*="reviews" i]',
    ],
    isProductPage: (loc) => /\/item\//.test(loc.pathname) || /\/vi\//i.test(loc.pathname),
    priceRange: { min: 0.5, max: 5_000_000 },
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
    productPriceSelector: '.product-aside__price--primary, .product-aside__price, .schema-product__price',
    oldPriceSelectors: [
      '.product-aside__price--old',
      '.offers-description__price--old',
      '[class*="old" i][class*="price" i]',
    ],
    excludeSelectors: [
      '[class*="installment" i]',
      '[class*="credit" i]',
      '[class*="per-month" i]',
      '[class*="per_month" i]',
    ],
    isProductPage: (loc) => /\/(catalog|mobile|laptop|tv|home)\/[^/]+\/[^/]+/i.test(loc.pathname) || /\/details\b/.test(loc.pathname),
    priceRange: { min: 0.5, max: 1_000_000 },
    forceAssumeByn: true,
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
    excludeSelectors: [
      '[class*="installment" i]',
      '[class*="credit" i]',
      '[class*="rating" i]',
      '[class*="per_month" i]',
      '[class*="per-month" i]',
    ],
    productPriceSelector: '.product-price, .price_main, .offer-price',
    oldPriceSelectors: ['.price-old', '[class*="old" i][class*="price" i]'],
    isProductPage: (loc) => /\/m\d+|\/p\d+|\/product\//i.test(loc.pathname),
    priceRange: { min: 0.5, max: 1_000_000 },
    forceAssumeByn: true,
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
    productPriceSelector: '.g-price__current, .price__current, [class*="style_currentPrice__"]',
    oldPriceSelectors: ['[class*="style_oldPrice__"]', '.g-price__old', '[class*="old" i][class*="price" i]'],
    excludeSelectors: [
      '[class*="installment" i]',
      '[class*="credit" i]',
      '[class*="discount" i]',
      '[class*="perMonth" i]',
      '[class*="per_month" i]',
    ],
    isProductPage: (loc) => /\/catalog\/[^/]+\/[^/]+\/[^/]+/i.test(loc.pathname),
    priceRange: { min: 0.5, max: 500_000 },
    forceAssumeByn: true,
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
    productPriceSelector: '.product_price .price',
    oldPriceSelectors: ['.price-old', '.old_price', '[class*="old" i][class*="price" i]'],
    excludeSelectors: [
      '[class*="installment" i]',
      '[class*="credit" i]',
      '[class*="discount" i]',
      '.рассрочка',
      '.кредит',
    ],
    isProductPage: (loc) => /\/p\d+|\/product\//i.test(loc.pathname),
    priceRange: { min: 0.5, max: 500_000 },
    forceAssumeByn: true,
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
    productPriceSelector: '.product_price .price, .product-price .price',
    oldPriceSelectors: [
      '.old_price',
      '.price-old',
      '.price__old',
      '[class*="old" i][class*="price" i]',
      '[class*="strik" i]',
    ],
    excludeSelectors: [
      '[class*="installment" i]',
      '[class*="credit" i]',
      '[class*="discount" i]',
      '[class*="per_month" i]',
      '[class*="per-month" i]',
      '[class*="month" i]',
      '.b-related-products',
      '.related-products',
      '.recommendation',
      '.related',
      '[class*="related" i]',
    ],
    isProductPage: (loc) => /\/p\d+|\/product\//i.test(loc.pathname),
    priceRange: { min: 0.5, max: 500_000 },
    forceAssumeByn: true,
  },
  {
    id: 'oz',
    match: (loc) => /(^|\.)oz\.by$/i.test(loc.hostname),
    priceSelectors: [
      '.book-price',
      '.product-price',
      '.price',
      '[class*="price" i]',
      '[class*="cost" i]',
    ],
    excludeSelectors: [
      '[class*="installment" i]',
      '[class*="credit" i]',
      '[class*="per_month" i]',
    ],
    productPriceSelector: '.book-price, .product-price',
    oldPriceSelectors: ['[class*="old" i][class*="price" i]', '.price-old'],
    isProductPage: (loc) => /\/product\/|\/book\//i.test(loc.pathname),
    priceRange: { min: 0.5, max: 50_000 },
    forceAssumeByn: true,
  },
  {
    id: 'deal',
    match: (loc) => /(^|\.)deal\.by$/i.test(loc.hostname),
    priceSelectors: [
      '[data-qaid="product_price"]',
      '[data-qaid*="price" i]',
      '.product-price',
      '.price',
      '[class*="price" i]',
    ],
    excludeSelectors: ['[class*="installment" i]', '[class*="credit" i]'],
    productPriceSelector: '[data-qaid="product_price"], .product-price',
    oldPriceSelectors: ['[data-qaid*="oldPrice" i]', '[class*="old" i][class*="price" i]'],
    isProductPage: (loc) => /\/p\d+/i.test(loc.pathname),
    priceRange: { min: 0.5, max: 1_000_000 },
    forceAssumeByn: true,
  },
  {
    id: 'lamoda',
    match: (loc) => /(^|\.)lamoda\.by$/i.test(loc.hostname),
    priceSelectors: [
      '.x-product-card-description__price-single',
      '.x-product-card-description__price-new',
      '[class*="price" i]',
    ],
    excludeSelectors: ['[class*="installment" i]', '[class*="credit" i]'],
    productPriceSelector: '.x-product-card-description__price-single, .x-product-card-description__price-new',
    oldPriceSelectors: ['.x-product-card-description__price-old', '[class*="oldPrice" i]'],
    isProductPage: (loc) => /\/p\/\w+/i.test(loc.pathname),
    priceRange: { min: 0.5, max: 50_000 },
    forceAssumeByn: true,
  },
  {
    id: 'mile',
    match: (loc) => /(^|\.)mile\.by$/i.test(loc.hostname),
    priceSelectors: [
      '.product-card__price',
      '.product__price',
      '.price',
      '[class*="price" i]',
    ],
    excludeSelectors: ['[class*="installment" i]', '[class*="credit" i]'],
    productPriceSelector: '.product__price, .product-card__price',
    oldPriceSelectors: ['.product__price--old', '.price-old', '[class*="old" i][class*="price" i]'],
    isProductPage: (loc) => /\/product\/|\/p\d+/i.test(loc.pathname),
    priceRange: { min: 0.5, max: 100_000 },
    forceAssumeByn: true,
  },
  {
    id: 'megatop',
    match: (loc) => /(^|\.)megatop\.by$/i.test(loc.hostname),
    priceSelectors: [
      '.product-price',
      '.price',
      '[class*="price" i]',
    ],
    excludeSelectors: ['[class*="installment" i]', '[class*="credit" i]'],
    productPriceSelector: '.product-price',
    oldPriceSelectors: ['.price-old', '[class*="old" i][class*="price" i]'],
    isProductPage: (loc) => /\/product\/|\/p\d+/i.test(loc.pathname),
    priceRange: { min: 0.5, max: 10_000 },
    forceAssumeByn: true,
  },
  {
    id: '5element',
    match: (loc) => /(^|\.)5element\.by$/i.test(loc.hostname),
    priceSelectors: [
      '.product-card__price',
      '.product-detail__price',
      '.price',
      '[class*="price" i]',
    ],
    excludeSelectors: ['[class*="installment" i]', '[class*="credit" i]', '[class*="month" i]'],
    productPriceSelector: '.product-detail__price, .product-card__price',
    oldPriceSelectors: ['.price-old', '[class*="oldPrice" i]', '[class*="old" i][class*="price" i]'],
    isProductPage: (loc) => /\/[a-z0-9_-]+\/[a-z0-9_-]+\/[a-z0-9_-]+/i.test(loc.pathname),
    priceRange: { min: 0.5, max: 200_000 },
    forceAssumeByn: true,
  },
  {
    id: 'technopoint',
    match: (loc) => /(^|\.)technopoint\.by$/i.test(loc.hostname),
    priceSelectors: ['.price', '.product-price', '[class*="price" i]'],
    excludeSelectors: ['[class*="installment" i]', '[class*="credit" i]'],
    productPriceSelector: '.product-price, .price',
    oldPriceSelectors: ['[class*="old" i][class*="price" i]', '.price-old'],
    isProductPage: (loc) => /\/product\/|\/p\d+/i.test(loc.pathname),
    priceRange: { min: 0.5, max: 200_000 },
    forceAssumeByn: true,
  },
  {
    id: 'holodilnik',
    match: (loc) => /(^|\.)holodilnik\.by$/i.test(loc.hostname),
    priceSelectors: ['.price', '.product__price', '.product-price', '[class*="price" i]'],
    excludeSelectors: ['[class*="installment" i]', '[class*="credit" i]'],
    productPriceSelector: '.product__price, .product-price',
    oldPriceSelectors: ['.product__price--old', '[class*="old" i][class*="price" i]'],
    isProductPage: (loc) => /\/catalog\/[^/]+\/[^/]+/i.test(loc.pathname),
    priceRange: { min: 0.5, max: 100_000 },
    forceAssumeByn: true,
  },
  {
    id: 'electrosila',
    match: (loc) => /(^|\.)electrosila\.by$/i.test(loc.hostname),
    priceSelectors: ['.price', '.product__price', '.product-price', '[class*="price" i]'],
    excludeSelectors: ['[class*="installment" i]', '[class*="credit" i]'],
    productPriceSelector: '.product__price, .product-price',
    oldPriceSelectors: ['[class*="old" i][class*="price" i]'],
    isProductPage: (loc) => /\/catalog\/[^/]+\/[^/]+|\/product\//i.test(loc.pathname),
    priceRange: { min: 0.5, max: 100_000 },
    forceAssumeByn: true,
  },
  {
    id: 'elcom',
    match: (loc) => /(^|\.)elcom\.by$/i.test(loc.hostname),
    priceSelectors: ['.price', '.product__price', '.product-price', '[class*="price" i]'],
    excludeSelectors: ['[class*="installment" i]', '[class*="credit" i]'],
    productPriceSelector: '.product__price, .product-price',
    oldPriceSelectors: ['[class*="old" i][class*="price" i]'],
    isProductPage: (loc) => /\/catalog\/[^/]+\/[^/]+|\/product\//i.test(loc.pathname),
    priceRange: { min: 0.5, max: 100_000 },
    forceAssumeByn: true,
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
    trackerPrimarySelectors: ['.card-price', '.listing-item__price'],
    productPriceSelector: '.card-price, .listing-item__price',
    oldPriceSelectors: ['[class*="old" i][class*="price" i]'],
    isProductPage: (loc) => /\/car\/|\/avto\/|\/announcement\//i.test(loc.pathname),
    // Cars on av.by easily go past 1M BYN — keep the ceiling generous.
    priceRange: { min: 1, max: 50_000_000 },
  },
  {
    id: 'realt',
    match: (loc) => /(^|\.)realt\.by$/i.test(loc.hostname),
    priceSelectors: ['.price', '.object__price', '[class*="price" i]', '[class*="cost" i]'],
    trackerPrimarySelectors: ['.object__price', '.price'],
    productPriceSelector: '.object__price, .price',
    oldPriceSelectors: ['[class*="old" i][class*="price" i]'],
    isProductPage: (loc) => /\/object\/|\/objects\/\d+/i.test(loc.pathname),
    // Real estate: 2-3M BYN is normal. Allow up to 100M for the rare luxury items.
    priceRange: { min: 1, max: 100_000_000 },
  },
  {
    id: 'abw',
    match: (loc) => /(^|\.)abw\.by$/i.test(loc.hostname),
    priceSelectors: ['.price', '.car-price', '[class*="price" i]'],
    excludeSelectors: ['[class*="rating" i]', '[class*="phone" i]'],
    productPriceSelector: '.car-price, .price',
    oldPriceSelectors: ['[class*="old" i][class*="price" i]'],
    isProductPage: (loc) => /\/cars\/|\/avto\/|\/car-\d+/i.test(loc.pathname),
    // Cars on abw.by: same scale as av.by.
    priceRange: { min: 1, max: 50_000_000 },
  },
  {
    id: 'dom',
    match: (loc) => /(^|\.)dom\.by$/i.test(loc.hostname),
    priceSelectors: ['.price', '.object-price', '[class*="price" i]', '[class*="cost" i]'],
    excludeSelectors: ['[class*="phone" i]', '[class*="contact" i]'],
    productPriceSelector: '.object-price, .price',
    oldPriceSelectors: ['[class*="old" i][class*="price" i]'],
    isProductPage: (loc) => /\/object|\/property|\/announcement/i.test(loc.pathname),
    priceRange: { min: 1, max: 100_000_000 },
  },
  {
    id: 'kvartirant',
    match: (loc) => /(^|\.)kvartirant\.by$/i.test(loc.hostname),
    priceSelectors: ['.price', '.cost', '[class*="price" i]', '[class*="cost" i]'],
    excludeSelectors: ['[class*="phone" i]', '[class*="contact" i]'],
    productPriceSelector: '.price, .cost',
    oldPriceSelectors: ['[class*="old" i][class*="price" i]'],
    isProductPage: (loc) => /\/object|\/announcement|\/rent\//i.test(loc.pathname),
    priceRange: { min: 1, max: 50_000_000 },
  },
  {
    id: 'home',
    match: (loc) => /(^|\.)home\.by$/i.test(loc.hostname),
    priceSelectors: ['.price', '.object__price', '[class*="price" i]', '[class*="cost" i]'],
    excludeSelectors: ['[class*="phone" i]', '[class*="contact" i]'],
    productPriceSelector: '.object__price, .price',
    oldPriceSelectors: ['[class*="old" i][class*="price" i]'],
    isProductPage: (loc) => /\/object|\/announcement/i.test(loc.pathname),
    priceRange: { min: 1, max: 100_000_000 },
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

