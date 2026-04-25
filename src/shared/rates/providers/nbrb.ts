import type { TargetCurrency } from '../../types'

interface NbrbRateResponse {
  Cur_OfficialRate: number
  Cur_Scale: number
  Cur_Abbreviation: string
  Date: string
}

export async function fetchNbrbBynPerTarget(currency: TargetCurrency): Promise<number> {
  const url = `https://www.nbrb.by/api/exrates/rates/${currency}?parammode=2`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`NBRB ${currency} fetch failed: ${res.status}`)
  const data = (await res.json()) as NbrbRateResponse
  const scale = data.Cur_Scale || 1
  const official = data.Cur_OfficialRate
  if (!Number.isFinite(official) || !Number.isFinite(scale) || scale <= 0) {
    throw new Error(`NBRB ${currency} invalid response`)
  }
  // 1 TARGET = X BYN
  return official / scale
}

