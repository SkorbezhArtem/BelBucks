import type { RateProvider, RatesCache, TargetCurrency, UserSettings } from '../types'
import { fetchBelarusbankAvgBynPerTarget, fetchBelarusbankBestBynPerTarget } from './providers/belarusbank'
import { fetchNbrbBynPerTarget } from './providers/nbrb'

interface RatesProviderAdapter {
  id: RateProvider
  fetchRate: (currency: TargetCurrency, settings: UserSettings) => Promise<number>
}

const PROVIDERS: Record<RateProvider, RatesProviderAdapter> = {
  Custom: {
    id: 'Custom',
    fetchRate: async (currency, settings) => {
      const custom = settings.customRates?.[currency]
      if (!custom || !Number.isFinite(custom) || custom <= 0) {
        throw new Error(`Custom rate missing for ${currency}`)
      }
      return custom
    },
  },
  NBRB: {
    id: 'NBRB',
    fetchRate: async (currency) => fetchNbrbBynPerTarget(currency),
  },
  BankAverage: {
    id: 'BankAverage',
    fetchRate: async (currency) => fetchBelarusbankAvgBynPerTarget(currency, 'Минск'),
  },
  BankBest: {
    id: 'BankBest',
    fetchRate: async (currency) => fetchBelarusbankBestBynPerTarget(currency, 'Минск'),
  },
  BankSpecific: {
    id: 'BankSpecific',
    // MVP: Belarusbank only. bankId is reserved for future multi-bank sources.
    fetchRate: async (currency) => fetchBelarusbankAvgBynPerTarget(currency, 'Минск'),
  },
}

export async function fetchRatesForSettings(settings: UserSettings): Promise<RatesCache> {
  const ttlMs = 60 * 60 * 1000
  const requestedProvider: RateProvider = settings.rateProvider
  let provider: RateProvider = requestedProvider
  const fetchedAt = Date.now()
  let warning: string | undefined

  const currencies: TargetCurrency[] = ['USD', 'EUR', 'PLN', 'RUB']

  const bynPerTarget: Record<TargetCurrency, number> = {
    USD: 0,
    EUR: 0,
    PLN: 0,
    RUB: 0,
  }

  try {
    for (const c of currencies) {
      bynPerTarget[c] = await fetchRate(provider, c, settings)
    }
  } catch (e) {
    const canFallback = provider === 'BankAverage' || provider === 'BankBest' || provider === 'BankSpecific'
    if (!canFallback) throw e

    provider = 'NBRB'
    warning = 'Bank source unavailable; temporarily using NBRB rates.'
    for (const c of currencies) {
      bynPerTarget[c] = await fetchRate(provider, c, settings)
    }
  }

  return {
    fetchedAt,
    ttlMs,
    bynPerTarget,
    provider,
    requestedProvider,
    bankId: settings.bankId,
    warning,
  }
}

async function fetchRate(provider: RateProvider, currency: TargetCurrency, settings: UserSettings): Promise<number> {
  return PROVIDERS[provider].fetchRate(currency, settings)
}

export function isRatesCacheFresh(cache: RatesCache, now = Date.now()): boolean {
  return now - cache.fetchedAt < cache.ttlMs
}

