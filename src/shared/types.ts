export type TargetCurrency = 'USD' | 'EUR' | 'PLN' | 'RUB'

export type RateProvider = 'NBRB' | 'BankAverage' | 'BankBest' | 'BankSpecific' | 'Custom'

export type DisplayMode = 'inline' | 'tooltip'
export type BadgeThemeMode = 'manual' | 'auto'

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
  useWhitelistOnly: boolean
  whitelistDomains: string[]
  blacklistDomains: string[]
}

export interface RatesCache {
  fetchedAt: number
  ttlMs: number
  /** 1 TARGET = X BYN */
  bynPerTarget: Record<TargetCurrency, number>
  provider: RateProvider
  bankId?: string
}

export interface ParsedPrice {
  byn: number
  raw: string
}

