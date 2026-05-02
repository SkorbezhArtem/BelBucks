import { STORAGE_KEYS } from './storage'

export interface PricePoint {
  t: number
  byn: number
}

export interface PriceHistoryEntry {
  url: string
  title: string
  points: PricePoint[]
}

export type PriceHistoryStore = Record<string, PriceHistoryEntry>

const MAX_ENTRIES = 200
const MAX_POINTS_PER_ENTRY = 30
// 6 hours: short enough to catch real price changes during the user's day,
// long enough that re-opening the same product page (with selectors that
// briefly mismatch / re-mount) doesn't pollute the timeline with near-duplicate
// points.
const MIN_RECORD_INTERVAL_MS = 6 * 60 * 60 * 1000
const FLUSH_DEBOUNCE_MS = 800
// Reject any new point whose value differs from the previous one by more
// than this multiplier — almost always a misparse rather than a real price.
const SPIKE_MULTIPLIER = 5

let storeCache: PriceHistoryStore | null = null
let loadPromise: Promise<PriceHistoryStore> | null = null
let flushTimer: number | null = null
const pendingByUrl = new Map<string, { title: string; byn: number; now: number }>()

function sanitizePoints(points: PricePoint[]): PricePoint[] {
  const base = points.filter((p) => Number.isFinite(p.byn) && p.byn >= 1)
  if (base.length <= 1) return base

  const cleaned: PricePoint[] = [base[0]]
  for (let i = 1; i < base.length; i++) {
    const prev = cleaned[cleaned.length - 1]
    const cur = base[i]
    if (!prev) {
      cleaned.push(cur)
      continue
    }

    // Remove abrupt single-direction spikes, especially for the latest point.
    if (cur.byn > prev.byn * 8) {
      const next = base[i + 1]
      if (!next || cur.byn > next.byn * 6) continue
    }
    cleaned.push(cur)
  }
  return cleaned
}

function clampStore(store: PriceHistoryStore): PriceHistoryStore {
  const entries = Object.values(store)
  entries.sort((a, b) => (b.points.at(-1)?.t ?? 0) - (a.points.at(-1)?.t ?? 0))
  const keep = entries.slice(0, MAX_ENTRIES)
  const next: PriceHistoryStore = {}
  for (const e of keep) {
    const points = sanitizePoints(e.points).slice(-MAX_POINTS_PER_ENTRY)
    if (points.length === 0) continue
    next[e.url] = { ...e, points }
  }
  return next
}

export async function loadPriceHistory(): Promise<PriceHistoryStore> {
  if (storeCache) return storeCache
  if (loadPromise) return loadPromise

  loadPromise = chrome.storage.local.get(STORAGE_KEYS.priceHistory).then((obj) => {
    const loaded = (obj[STORAGE_KEYS.priceHistory] as PriceHistoryStore | undefined) ?? {}
    const sanitized = clampStore(loaded)
    storeCache = sanitized
    loadPromise = null
    // Best-effort self-heal old noisy history in storage.
    if (JSON.stringify(sanitized) !== JSON.stringify(loaded)) {
      void chrome.storage.local.set({ [STORAGE_KEYS.priceHistory]: sanitized })
    }
    return sanitized
  })

  return loadPromise
}

async function loadPriceHistoryFresh(): Promise<PriceHistoryStore> {
  const obj = await chrome.storage.local.get(STORAGE_KEYS.priceHistory)
  const loaded = (obj[STORAGE_KEYS.priceHistory] as PriceHistoryStore | undefined) ?? {}
  const sanitized = clampStore(loaded)
  storeCache = sanitized
  return sanitized
}

export async function savePriceHistory(store: PriceHistoryStore): Promise<void> {
  const next = clampStore(store)
  storeCache = next
  await chrome.storage.local.set({ [STORAGE_KEYS.priceHistory]: next })
}

function scheduleFlush() {
  if (flushTimer != null) window.clearTimeout(flushTimer)
  flushTimer = window.setTimeout(() => {
    flushTimer = null
    void flushPending()
  }, FLUSH_DEBOUNCE_MS)
}

async function flushPending(): Promise<void> {
  if (pendingByUrl.size === 0) return

  const batch = new Map(pendingByUrl)
  pendingByUrl.clear()

  let store = await loadPriceHistory()

  for (const [cleanUrl, p] of batch.entries()) {
    const existing = store[cleanUrl]
    const point: PricePoint = { t: p.now, byn: p.byn }

    if (!existing) {
      store[cleanUrl] = { url: cleanUrl, title: p.title, points: [point] }
      continue
    }

    const last = existing.points.at(-1)
    if (last) {
      const tooSoon = p.now - last.t < MIN_RECORD_INTERVAL_MS
      const samePrice = Math.abs(last.byn - p.byn) < 0.0001
      if (tooSoon && samePrice) continue
      // Write-time anti-spike: refuse a point that diverges wildly from the
      // last accepted one. This is the right place to do it because once the
      // bad value lands in storage every consumer (popup chart, csv export,
      // future migrations) has to filter it out.
      if (last.byn > 0 && p.byn > 0) {
        const ratio = Math.max(p.byn / last.byn, last.byn / p.byn)
        if (ratio > SPIKE_MULTIPLIER) continue
      }
    }

    existing.title = p.title || existing.title
    existing.points = [...existing.points, point].slice(-MAX_POINTS_PER_ENTRY)
    store[cleanUrl] = existing
  }

  try {
    await savePriceHistory(store)
  } catch {
    // If quota/race still happens, merge batch into fresh store and retry once.
    store = await loadPriceHistoryFresh()
    for (const [cleanUrl, p] of batch.entries()) {
      const existing = store[cleanUrl]
      const point: PricePoint = { t: p.now, byn: p.byn }
      if (!existing) {
        store[cleanUrl] = { url: cleanUrl, title: p.title, points: [point] }
        continue
      }
      const last = existing.points.at(-1)
      if (last) {
        const tooSoon = p.now - last.t < MIN_RECORD_INTERVAL_MS
        const samePrice = Math.abs(last.byn - p.byn) < 0.0001
        if (tooSoon && samePrice) continue
        if (last.byn > 0 && p.byn > 0) {
          const ratio = Math.max(p.byn / last.byn, last.byn / p.byn)
          if (ratio > SPIKE_MULTIPLIER) continue
        }
      }
      existing.title = p.title || existing.title
      existing.points = [...existing.points, point].slice(-MAX_POINTS_PER_ENTRY)
      store[cleanUrl] = existing
    }
    await savePriceHistory(store)
  }
}

/**
 * Query parameters that *do* change which product / variant is shown and must
 * therefore stay in the canonical URL. Anything outside this list (utm_*, gclid,
 * fbclid, _ga, ref, sort, page, etc.) is dropped before the URL becomes a
 * storage key — otherwise the same product becomes N entries with N different
 * tracking tails.
 */
const CANONICAL_QUERY_KEYS = new Set([
  'id',
  'item',
  'product',
  'product_id',
  'productId',
  'sku',
  'variant',
  'variant_id',
  'color',
  'size',
  'tab',
  'view',
  'p', // some shops use ?p=12345 for product id
])

export function canonicalizeProductUrl(rawUrl: string): string {
  try {
    const u = new URL(rawUrl)
    u.hash = ''
    const keysToDrop: string[] = []
    u.searchParams.forEach((_v, k) => {
      const lower = k.toLowerCase()
      if (
        lower.startsWith('utm_') ||
        lower.startsWith('_ga') ||
        lower === 'gclid' ||
        lower === 'fbclid' ||
        lower === 'yclid' ||
        lower === 'ref' ||
        lower === 'referrer' ||
        lower === 'from'
      ) {
        keysToDrop.push(k)
        return
      }
      if (!CANONICAL_QUERY_KEYS.has(lower)) keysToDrop.push(k)
    })
    for (const k of keysToDrop) u.searchParams.delete(k)
    // Stable order so two visits with the same params hit the same key.
    const sorted = Array.from(u.searchParams.entries()).sort(([a], [b]) => a.localeCompare(b))
    u.search = ''
    for (const [k, v] of sorted) u.searchParams.append(k, v)
    return u.toString()
  } catch {
    return rawUrl.split('#')[0]
  }
}

export async function recordPricePoint(url: string, title: string, byn: number, now = Date.now()): Promise<void> {
  const cleanUrl = canonicalizeProductUrl(url)
  pendingByUrl.set(cleanUrl, { title, byn, now })
  scheduleFlush()
}

export async function clearPriceHistoryForUrl(url: string): Promise<number> {
  const cleanUrl = canonicalizeProductUrl(url)
  const store = await loadPriceHistory()
  const next: PriceHistoryStore = { ...store }
  let removed = 0

  if (next[cleanUrl]) {
    delete next[cleanUrl]
    removed++
  }

  try {
    const u = new URL(cleanUrl)
    for (const key of Object.keys(next)) {
      try {
        const ku = new URL(key)
        if (ku.origin === u.origin && ku.pathname === u.pathname) {
          delete next[key]
          removed++
        }
      } catch {
        // ignore malformed keys
      }
    }
  } catch {
    // ignore malformed url
  }

  if (removed > 0) await savePriceHistory(next)
  return removed
}

