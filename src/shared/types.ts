export type TargetCurrency = 'USD' | 'EUR' | 'PLN' | 'RUB'

export type RateProvider = 'NBRB' | 'BankAverage' | 'BankBest' | 'BankSpecific' | 'Custom'

export type DisplayMode = 'inline' | 'tooltip'
export type BadgeThemeMode = 'manual' | 'auto'

/**
 * UI theme mode for the popup and options page chrome (NOT the inline badge
 * appearance, which is controlled by `badgeThemeMode`).
 *  - 'auto'  — follow OS / browser `prefers-color-scheme`
 *  - 'light' — force light surface
 *  - 'dark'  — force dark surface
 */
export type UiThemeMode = 'auto' | 'light' | 'dark'

export type SiteDefaultMode = 'enabledEverywhere' | 'disabledEverywhere'

export interface SiteRule {
  /** Examples: "av.by", "*.onliner.by", "catalog.onliner.by" */
  pattern: string
  mode: 'allow' | 'block'
}

export type SiteVisualThemeMode = 'inherit' | 'manual' | 'auto'

export interface SiteVisualRule {
  /** Examples: "av.by", "*.onliner.by", "catalog.onliner.by" */
  pattern: string
  themeMode?: SiteVisualThemeMode
  badgeBgColor?: string
  badgeTextColor?: string
  badgeFontSizePx?: number
  badgePaddingYpx?: number
  badgePaddingXpx?: number
  /**
   * How the badge is laid out next to the price.
   *  - 'inline'      → adjacent inline-block (default)
   *  - 'block-below' → forced onto its own line under the price
   *  - 'prepend'     → before the price text instead of after
   *  - 'tooltip'     → no visible badge, value goes into title= only
   */
  badgeStrategy?: 'inline' | 'block-below' | 'prepend' | 'tooltip'
}

/**
 * Per-host user overrides built by the element picker. Each list is a set of
 * CSS selectors (ANDed against the preset). When a selector is in
 * `notAPrice` it acts like an exclude; in `oldPrice` it skips the price; in
 * `installment` it also skips. `currentPrice` / `productPrice` add to (rather
 * than replace) the preset's selectors.
 */
export interface UserSiteRule {
  /** Bare hostname, no scheme: "av.by", "catalog.onliner.by". */
  host: string
  currentPrice?: string[]
  productPrice?: string[]
  oldPrice?: string[]
  installment?: string[]
  notAPrice?: string[]
}

export interface UserSettings {
  enabled: boolean
  targetCurrency: TargetCurrency
  secondaryCurrency: TargetCurrency | 'NONE'
  rateProvider: RateProvider
  bankId?: string
  customRates?: Partial<Record<TargetCurrency, number>>
  markupPercent: number
  displayMode: DisplayMode
  badgeThemeMode: BadgeThemeMode
  badgeBgColor: string
  badgeTextColor: string
  badgeFontSizePx: number
  badgePaddingYpx: number
  badgePaddingXpx: number

  /** UI chrome theme for popup + options. Defaults to 'auto'. */
  uiThemeMode: UiThemeMode

  /** New flexible per-site switching */
  siteDefaultMode: SiteDefaultMode
  siteRules: SiteRule[]
  siteVisualRules: SiteVisualRule[]
  userSiteRules: UserSiteRule[]

  /** Legacy (kept for migration/backward compatibility) */
  useWhitelistOnly: boolean
  whitelistDomains: string[]
  blacklistDomains: string[]

  /**
   * Price-history tracker. Off by default — the user must explicitly opt in
   * via the popup banner before any per-URL data is written to local storage.
   * When false, recordPricePoint() is a no-op.
   */
  priceTrackerEnabled: boolean
  /** Set when the user has acknowledged the tracker disclosure (banner). */
  priceTrackerAcknowledged?: boolean
}

export interface RatesCache {
  fetchedAt: number
  ttlMs: number
  /** 1 TARGET = X BYN */
  bynPerTarget: Record<TargetCurrency, number>
  /** Actually used provider (may fallback from selected provider). */
  provider: RateProvider
  /** Provider user selected in settings at fetch time. */
  requestedProvider?: RateProvider
  bankId?: string
  warning?: string
}

export interface ParsedPrice {
  byn: number
  raw: string
}

