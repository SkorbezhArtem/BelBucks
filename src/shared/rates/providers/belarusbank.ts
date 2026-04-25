import type { TargetCurrency } from '../../types'

type BelarusbankBranchRate = Record<string, unknown> & {
  USD_out?: string
  EUR_out?: string
  PLN_out?: string
  RUB_out?: string
}

function parseRateString(s: string): number | null {
  const n = Number.parseFloat(s.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function keyFor(currency: TargetCurrency): keyof BelarusbankBranchRate {
  return `${currency}_out` as keyof BelarusbankBranchRate
}

function scaleFor(currency: TargetCurrency): number {
  // Belarusbank returns RUB for 100 units in many feeds.
  if (currency === 'RUB') return 100
  return 1
}

export async function fetchBelarusbankCityRates(city: string): Promise<BelarusbankBranchRate[]> {
  const url = `https://belarusbank.by/api/kursExchange?city=${encodeURIComponent(city)}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Belarusbank fetch failed: ${res.status}`)
  const data = (await res.json()) as unknown
  if (!Array.isArray(data)) throw new Error('Belarusbank response not an array')
  return data as BelarusbankBranchRate[]
}

export async function fetchBelarusbankAvgBynPerTarget(
  currency: TargetCurrency,
  city = 'Минск',
): Promise<number> {
  const list = await fetchBelarusbankCityRates(city)
  const key = keyFor(currency)
  const scale = scaleFor(currency)

  let sum = 0
  let count = 0
  for (const item of list) {
    const v = item[key]
    if (typeof v !== 'string') continue
    const n = parseRateString(v)
    if (n == null) continue
    sum += n / scale
    count++
  }
  if (count === 0) throw new Error(`Belarusbank no rates for ${currency}`)
  // 1 TARGET = X BYN
  return sum / count
}

export async function fetchBelarusbankBestBynPerTarget(
  currency: TargetCurrency,
  city = 'Минск',
): Promise<number> {
  const list = await fetchBelarusbankCityRates(city)
  const key = keyFor(currency)
  const scale = scaleFor(currency)

  let best: number | null = null
  for (const item of list) {
    const v = item[key]
    if (typeof v !== 'string') continue
    const n = parseRateString(v)
    if (n == null) continue
    const normalized = n / scale
    // For BYN -> TARGET conversion, smaller BYN per 1 TARGET is better for user.
    if (best == null || normalized < best) best = normalized
  }
  if (best == null) throw new Error(`Belarusbank no best rate for ${currency}`)
  return best
}

