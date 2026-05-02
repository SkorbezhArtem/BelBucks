export type TargetCurrency = 'USD' | 'EUR' | 'PLN' | 'RUB'

export type RateProvider = 'NBRB' | 'BankAverage' | 'BankBest' | 'BankSpecific' | 'Custom'

export type DisplayMode = 'inline' | 'tooltip'
export type BadgeThemeMode = 'manual' | 'auto'

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

  /** New flexible per-site switching */
  siteDefaultMode: SiteDefaultMode
  siteRules: SiteRule[]
  siteVisualRules: SiteVisualRule[]

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

