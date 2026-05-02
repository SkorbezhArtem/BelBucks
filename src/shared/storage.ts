import type { RatesCache, UserSettings } from './types'
import type { SiteRule } from './types'
import { normalizeHost } from './siteRules'

export const STORAGE_KEYS = {
  settings: 'bb_settings_v1',
  ratesCache: 'bb_rates_cache_v1',
  priceHistory: 'bb_price_history_v1',
} as const

export const DEFAULT_SETTINGS: UserSettings = {
  enabled: true,
  targetCurrency: 'USD',
  secondaryCurrency: 'NONE',
  rateProvider: 'NBRB',
  markupPercent: 0,
  displayMode: 'inline',
  badgeThemeMode: 'manual',
  badgeBgColor: '#7f8fff',
  badgeTextColor: '#0d1a46',
  badgeFontSizePx: 12,
  badgePaddingYpx: 2,
  badgePaddingXpx: 8,
  siteDefaultMode: 'enabledEverywhere',
  siteRules: [],
  siteVisualRules: [],
  useWhitelistOnly: false,
  whitelistDomains: [],
  blacklistDomains: [],
  customRates: {},
  priceTrackerEnabled: false,
  priceTrackerAcknowledged: false,
}

const SETTINGS_WRITE_DEBOUNCE_MS = 220
let pendingSettings: UserSettings | null = null
let flushTimer: ReturnType<typeof setTimeout> | null = null
let inFlightPromise: Promise<void> | null = null
let resolveQueue: Array<() => void> = []
let rejectQueue: Array<(reason?: unknown) => void> = []
let lastPersistedSerialized = ''

export async function getSettings(): Promise<UserSettings> {
  const obj = await chrome.storage.sync.get(STORAGE_KEYS.settings)
  const stored = obj[STORAGE_KEYS.settings] as Partial<UserSettings> | undefined
  let merged = { ...DEFAULT_SETTINGS, ...(stored ?? {}) }

  // One-time-ish migration: legacy whitelist/blacklist -> flexible site rules.
  if (!stored?.siteRules || !stored?.siteDefaultMode) {
    const rules: SiteRule[] = []
    const blacklist = stored?.blacklistDomains ?? merged.blacklistDomains
    const whitelist = stored?.whitelistDomains ?? merged.whitelistDomains
    const useWhitelistOnly = stored?.useWhitelistOnly ?? merged.useWhitelistOnly

    for (const d of blacklist) rules.push({ pattern: normalizeHost(d), mode: 'block' })
    for (const d of whitelist) rules.push({ pattern: normalizeHost(d), mode: 'allow' })

    merged = {
      ...merged,
      siteDefaultMode: useWhitelistOnly ? 'disabledEverywhere' : 'enabledEverywhere',
      siteRules: rules,
    }
  }

  lastPersistedSerialized = JSON.stringify(merged)
  return merged
}

export async function setSettings(settings: UserSettings): Promise<void> {
  const serialized = JSON.stringify(settings)
  // Fast-path: no-op if value is already persisted and queue is empty.
  if (serialized === lastPersistedSerialized && !pendingSettings && !inFlightPromise) return

  pendingSettings = settings

  const waitForFlush = new Promise<void>((resolve, reject) => {
    resolveQueue.push(resolve)
    rejectQueue.push(reject)
  })

  if (flushTimer != null) clearTimeout(flushTimer)
  flushTimer = setTimeout(() => {
    flushTimer = null
    if (!pendingSettings) {
      const resolvers = resolveQueue
      resolveQueue = []
      rejectQueue = []
      resolvers.forEach((r) => r())
      return
    }

    const toWrite = pendingSettings
    pendingSettings = null

    inFlightPromise = chrome.storage.sync
      .set({ [STORAGE_KEYS.settings]: toWrite })
      .then(() => {
        lastPersistedSerialized = JSON.stringify(toWrite)
        const resolvers = resolveQueue
        resolveQueue = []
        rejectQueue = []
        resolvers.forEach((r) => r())
      })
      .catch((err) => {
        const rejecters = rejectQueue
        resolveQueue = []
        rejectQueue = []
        rejecters.forEach((rj) => rj(err))
      })
      .finally(() => {
        inFlightPromise = null
      })
  }, SETTINGS_WRITE_DEBOUNCE_MS)

  await waitForFlush
}

export async function getRatesCache(): Promise<RatesCache | null> {
  const obj = await chrome.storage.local.get(STORAGE_KEYS.ratesCache)
  return (obj[STORAGE_KEYS.ratesCache] as RatesCache | undefined) ?? null
}

export async function setRatesCache(cache: RatesCache): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.ratesCache]: cache })
}

