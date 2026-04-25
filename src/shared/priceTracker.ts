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
const MIN_RECORD_INTERVAL_MS = 15 * 60 * 1000
const FLUSH_DEBOUNCE_MS = 800

let storeCache: PriceHistoryStore | null = null
let loadPromise: Promise<PriceHistoryStore> | null = null
let flushTimer: number | null = null
const pendingByUrl = new Map<string, { title: string; byn: number; now: number }>()

function clampStore(store: PriceHistoryStore): PriceHistoryStore {
  const entries = Object.values(store)
  entries.sort((a, b) => (b.points.at(-1)?.t ?? 0) - (a.points.at(-1)?.t ?? 0))
  const keep = entries.slice(0, MAX_ENTRIES)
  const next: PriceHistoryStore = {}
  for (const e of keep) next[e.url] = e
  return next
}

export async function loadPriceHistory(): Promise<PriceHistoryStore> {
  if (storeCache) return storeCache
  if (loadPromise) return loadPromise

  loadPromise = chrome.storage.local.get(STORAGE_KEYS.priceHistory).then((obj) => {
    const loaded = (obj[STORAGE_KEYS.priceHistory] as PriceHistoryStore | undefined) ?? {}
    storeCache = loaded
    loadPromise = null
    return loaded
  })

  return loadPromise
}

async function loadPriceHistoryFresh(): Promise<PriceHistoryStore> {
  const obj = await chrome.storage.local.get(STORAGE_KEYS.priceHistory)
  const loaded = (obj[STORAGE_KEYS.priceHistory] as PriceHistoryStore | undefined) ?? {}
  storeCache = loaded
  return loaded
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
      }
      existing.title = p.title || existing.title
      existing.points = [...existing.points, point].slice(-MAX_POINTS_PER_ENTRY)
      store[cleanUrl] = existing
    }
    await savePriceHistory(store)
  }
}

export async function recordPricePoint(url: string, title: string, byn: number, now = Date.now()): Promise<void> {
  const cleanUrl = url.split('#')[0]
  pendingByUrl.set(cleanUrl, { title, byn, now })
  scheduleFlush()
}

