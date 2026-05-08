/**
 * Determine the page's *declared* product currency.
 *
 * Order of trust (top wins):
 *   1. <meta itemprop="priceCurrency" content="USD">  (microdata)
 *   2. JSON-LD blocks: pull every priceCurrency under Offer / AggregateOffer
 *      / Product, take the most common.
 *   3. <meta property="og:price:currency" content="…">  / "product:price:currency"
 *   4. <meta property="product:price:currency" content="…">
 *
 * Returns the ISO code (uppercase) when at least one source is found,
 * `null` when the page is silent.
 */

type CurrencyCode = string

function pickCurrencyFromJsonObject(node: unknown, sink: CurrencyCode[]): void {
  if (!node) return
  if (Array.isArray(node)) {
    for (const item of node) pickCurrencyFromJsonObject(item, sink)
    return
  }
  if (typeof node !== 'object') return
  const obj = node as Record<string, unknown>
  const cc = obj.priceCurrency
  if (typeof cc === 'string' && cc.length >= 3) {
    sink.push(cc.trim().toUpperCase())
  }
  // Recurse into nested values that may carry offers.
  for (const key of Object.keys(obj)) {
    const v = obj[key]
    if (v && (typeof v === 'object' || Array.isArray(v))) {
      pickCurrencyFromJsonObject(v, sink)
    }
  }
}

/**
 * Pure helper exported for unit-testing: parses a single JSON-LD block's text
 * and returns every priceCurrency it finds anywhere inside the tree (Offer,
 * AggregateOffer, nested Product etc.). Returns an empty array on parse error.
 */
export function extractCurrenciesFromJsonText(text: string): CurrencyCode[] {
  if (!text) return []
  const out: CurrencyCode[] = []
  try {
    const parsed = JSON.parse(text)
    pickCurrencyFromJsonObject(parsed, out)
  } catch {
    // Many sites embed templated / broken JSON. Caller treats this as silence.
  }
  return out
}

function readJsonLdBlocks(root: ParentNode): CurrencyCode[] {
  const out: CurrencyCode[] = []
  const scripts = root.querySelectorAll('script[type="application/ld+json"]')
  scripts.forEach((s) => {
    const txt = s.textContent
    if (!txt) return
    for (const cc of extractCurrenciesFromJsonText(txt)) out.push(cc)
  })
  return out
}

function readMetaCurrency(root: ParentNode): CurrencyCode | null {
  const itemprop = root.querySelector('meta[itemprop="priceCurrency"]')
  const ipc = itemprop?.getAttribute('content')
  if (ipc && ipc.length >= 3) return ipc.trim().toUpperCase()

  const og = root.querySelector('meta[property="og:price:currency"]')
  const ogc = og?.getAttribute('content')
  if (ogc && ogc.length >= 3) return ogc.trim().toUpperCase()

  const prod = root.querySelector('meta[property="product:price:currency"]')
  const pdc = prod?.getAttribute('content')
  if (pdc && pdc.length >= 3) return pdc.trim().toUpperCase()

  return null
}

function pickMostCommon(list: CurrencyCode[]): CurrencyCode | null {
  if (list.length === 0) return null
  const counts = new Map<string, number>()
  for (const c of list) counts.set(c, (counts.get(c) ?? 0) + 1)
  let best: string | null = null
  let bestCount = 0
  for (const [k, v] of counts) {
    if (v > bestCount) {
      best = k
      bestCount = v
    }
  }
  return best
}

export function detectDeclaredPageCurrency(root: ParentNode = document): CurrencyCode | null {
  // (1) Microdata wins.
  const meta = readMetaCurrency(root)
  if (meta) return meta
  // (2) JSON-LD majority vote.
  const ld = readJsonLdBlocks(root)
  return pickMostCommon(ld)
}

/**
 * Convenience wrapper used by content scripts: true iff the declared currency
 * is a non-BYN code. UNKNOWN / BYN / missing all return false.
 */
export function isDeclaredNonBynCurrency(root: ParentNode = document): boolean {
  const code = detectDeclaredPageCurrency(root)
  if (!code) return false
  return code !== 'BYN' && code !== 'BYR'
}
