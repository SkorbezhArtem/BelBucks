import type { RateProvider, RatesCache, TargetCurrency, UserSettings } from '../types'
import { fetchBelarusbankAvgBynPerTarget, fetchBelarusbankBestBynPerTarget } from './providers/belarusbank'
import { fetchNbrbBynPerTarget } from './providers/nbrb'

export async function fetchRatesForSettings(settings: UserSettings): Promise<RatesCache> {
  const ttlMs = 60 * 60 * 1000
  const provider: RateProvider = settings.rateProvider
  const fetchedAt = Date.now()

  const currencies: TargetCurrency[] = ['USD', 'EUR', 'PLN', 'RUB']

  const bynPerTarget: Record<TargetCurrency, number> = {
    USD: 0,
    EUR: 0,
    PLN: 0,
    RUB: 0,
  }

  for (const c of currencies) {
    bynPerTarget[c] = await fetchRate(provider, c, settings)
  }

  return {
    fetchedAt,
    ttlMs,
    bynPerTarget,
    provider,
    bankId: settings.bankId,
  }
}

async function fetchRate(provider: RateProvider, currency: TargetCurrency, settings: UserSettings): Promise<number> {
  if (provider === 'Custom') {
    const custom = settings.customRates?.[currency]
    if (!custom || !Number.isFinite(custom) || custom <= 0) throw new Error(`Custom rate missing for ${currency}`)
    return custom
  }

  if (provider === 'NBRB') {
    return await fetchNbrbBynPerTarget(currency)
  }

  if (provider === 'BankAverage') {
    // MVP approximation of market-average via Belarusbank city feed.
    return await fetchBelarusbankAvgBynPerTarget(currency, 'Минск')
  }

  if (provider === 'BankBest') {
    // "Best by banks": lowest BYN per 1 target in the sampled bank feed.
    return await fetchBelarusbankBestBynPerTarget(currency, 'Минск')
  }

  if (provider === 'BankSpecific') {
    // MVP: Belarusbank only. `bankId` reserved for future multi-bank selection.
    return await fetchBelarusbankAvgBynPerTarget(currency, 'Минск')
  }

  // Exhaustive guard
  const _never: never = provider
  throw new Error(`Unknown provider: ${_never}`)
}

export function isRatesCacheFresh(cache: RatesCache, now = Date.now()): boolean {
  return now - cache.fetchedAt < cache.ttlMs
}

