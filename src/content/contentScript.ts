import { convertBynToTarget, formatTargetCurrency } from '../shared/converter'
import { parseBynPrice } from '../shared/priceParser'
import { recordPricePoint } from '../shared/priceTracker'
import { getRatesCache, getSettings } from '../shared/storage'
import type { RatesCache, UserSettings } from '../shared/types'
import { getPresetForLocation } from './presets.ts'

let PROCESSED = new WeakSet<Element>()
let settings: UserSettings | null = null
let rates: RatesCache | null = null
let badgeCounter = 0
let observer: MutationObserver | null = null
const PRICE_WITH_CURRENCY_RE = /\d[\d\s\u00A0\u202F]*(?:[.,]\d{1,2})?\s*(?:byn|бел\.?\s*руб|руб|р\.?|br|ƃ)/i

function hasDigits(text: string): boolean {
  return /\d/.test(text)
}

function hasCurrencyHint(text: string): boolean {
  return /(byn|бел\.?\s*руб|руб|br|(^|\s)р\.?($|\s)|ƃ)/i.test(text)
}

function isLikelyPriceToken(text: string): boolean {
  const t = text.replace(/\s+/g, ' ').trim()
  if (!hasDigits(t)) return false
  if (t.includes('%')) return false
  // Keep candidate compact: avoid long descriptions with many numbers.
  if (t.length > 40) return false
  // A price token usually has at least 2 digits and limited letters.
  const digits = (t.match(/\d/g) ?? []).length
  const letters = (t.match(/[a-zа-я]/gi) ?? []).length
  if (digits < 2) return false
  if (letters > 10) return false
  return true
}

function isRateWidgetContext(el: Element, textVariants: string[]): boolean {
  const own = (el.textContent ?? '').toLowerCase()
  const parent = (el.parentElement?.textContent ?? '').toLowerCase()
  const near = `${own} ${parent} ${textVariants.join(' ').toLowerCase()}`

  // Skip bank/rate converter widgets like "1 USD = 2.82 BYN"
  if (/(конвертер|converter|курс|rate)/i.test(near) && /(usd|eur|pln|rub)/i.test(near) && /byn|бел/.test(near)) {
    return true
  }
  if (/(^|\s)\d+\s*(usd|eur|pln|rub)\s*=/.test(near)) return true
  if (/(usd|eur|pln|rub)\s*=/.test(near)) return true
  return false
}

function hasNearbyCurrencyHint(el: Element): boolean {
  const own = el.textContent ?? ''
  if (hasCurrencyHint(own)) return true
  const parent = el.parentElement?.textContent ?? ''
  if (hasCurrencyHint(parent)) return true
  const prev = el.previousElementSibling?.textContent ?? ''
  if (hasCurrencyHint(prev)) return true
  const next = el.nextElementSibling?.textContent ?? ''
  return hasCurrencyHint(next)
}

function isVisibleElement(el: Element): boolean {
  const h = el as HTMLElement
  if (!h.isConnected) return false
  if (h.offsetParent === null && getComputedStyle(h).position !== 'fixed') return false
  const cs = getComputedStyle(h)
  if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false
  return true
}

function collectTextFallbackCandidates(root: ParentNode, maxCount = 500): Element[] {
  const out: Element[] = []
  const seen = new Set<Element>()
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let n: Node | null = walker.nextNode()
  while (n && out.length < maxCount) {
    const text = n.textContent?.replace(/\s+/g, ' ').trim() ?? ''
    if (text.length >= 3 && text.length <= 64 && PRICE_WITH_CURRENCY_RE.test(text)) {
      const parent = n.parentElement
      if (
        parent &&
        !seen.has(parent) &&
        !['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE'].includes(parent.tagName) &&
        isVisibleElement(parent)
      ) {
        seen.add(parent)
        out.push(parent)
      }
    }
    n = walker.nextNode()
  }
  return out
}

function extractTextVariants(el: Element): string[] {
  const variants = new Set<string>()
  const own = (el.textContent ?? '').replace(/\s+/g, ' ').trim()
  if (own) variants.add(own)

  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType !== Node.TEXT_NODE) continue
    const t = (node.textContent ?? '').replace(/\s+/g, ' ').trim()
    if (t) variants.add(t)
  }

  return Array.from(variants).filter((s) => s.length <= 80)
}

function shouldRunOnHost(host: string, s: UserSettings): boolean {
  const h = host.toLowerCase()
  if (s.blacklistDomains.some((d) => d.toLowerCase() === h)) return false
  if (s.useWhitelistOnly) return s.whitelistDomains.some((d) => d.toLowerCase() === h)
  return true
}

function ensureStyles() {
  if (document.getElementById('bb-style')) return
  const style = document.createElement('style')
  style.id = 'bb-style'
  style.textContent = `
.bb-inline-card{
  display:inline-flex !important;
  align-items:center;
  margin-left:.45em;
  padding:.12em .5em;
  border-radius:999px;
  border:1px solid color-mix(in srgb, var(--bb-badge-bg, #7f8fff) 85%, #000 15%);
  background:var(--bb-badge-bg, #7f8fff);
  color:var(--bb-badge-text, #0d1a46);
  font-weight:700;
  font-size:.86em;
  line-height:1.25;
  white-space:nowrap;
  width:auto !important;
  max-width:max-content !important;
  min-width:0 !important;
  flex:0 0 auto !important;
  vertical-align:middle;
  box-shadow:0 1px 0 rgba(255,255,255,.4) inset, 0 1px 4px rgba(17,24,39,.18);
}
`
  document.documentElement.appendChild(style)
}

function applyVisualSettings() {
  if (!settings) return
  let bg = settings.badgeBgColor
  let text = settings.badgeTextColor

  if (settings.badgeThemeMode === 'auto') {
    const host = location.hostname.toLowerCase()
    if (/(^|\.)av\.by$/.test(host)) {
      bg = '#4f86ff'
      text = '#f5f9ff'
    } else if (/(^|\.)onliner\.by$/.test(host) || /(^|\.)catalog\.onliner\.by$/.test(host)) {
      bg = '#ffd449'
      text = '#2f2a10'
    } else if (/(^|\.)21vek\.by$/.test(host)) {
      bg = '#ff4da2'
      text = '#fff4fb'
    } else {
      bg = '#7f8fff'
      text = '#0d1a46'
    }
  }

  document.documentElement.style.setProperty('--bb-badge-bg', bg)
  document.documentElement.style.setProperty('--bb-badge-text', text)
}

function resetRenderedBadges() {
  document.querySelectorAll('.bb-inline-card[data-bb-badge="1"]').forEach((el) => el.remove())
  PROCESSED = new WeakSet<Element>()
}

function renderInline(el: Element, text: string) {
  const host = el as HTMLElement
  if (!host.dataset.bbHostId) host.dataset.bbHostId = `bb-${++badgeCounter}`
  const hostId = host.dataset.bbHostId
  const existing = host.parentElement?.querySelector(`.bb-inline-card[data-bb-for="${hostId}"]`) ?? null
  if (existing) {
    ;(existing as HTMLElement).textContent = text
    return
  }
  const span = document.createElement('span')
  span.className = 'bb-inline-card'
  span.textContent = text
  span.setAttribute('data-bb-badge', '1')
  span.setAttribute('data-bb-for', hostId)
  el.insertAdjacentElement('afterend', span)
}

function applyToElement(el: Element, forceAssumeByn: boolean): number | null {
  if (!settings || !rates) return null
  if (PROCESSED.has(el)) return null
  if (!isVisibleElement(el)) return null
  if ((el as HTMLElement).dataset.bbBadge === '1') return null
  if (el.closest('[data-bb-badge="1"]')) return null

  const textVariants = extractTextVariants(el).filter(isLikelyPriceToken)
  if (textVariants.length === 0) return null

  if (isRateWidgetContext(el, textVariants)) return null

  let parsed = null as ReturnType<typeof parseBynPrice>
  for (const rawText of textVariants) {
    parsed = parseBynPrice(rawText)
    if (!parsed && (forceAssumeByn || hasNearbyCurrencyHint(el))) {
      parsed = parseBynPrice(rawText, { assumeByn: true })
    }
    if (parsed) break
  }
  if (!parsed) return null
  // Guard against converting counters / tiny incidental values.
  if (parsed.byn < 1) return null

  const rate = rates.bynPerTarget[settings.targetCurrency]
  if (!rate || !Number.isFinite(rate)) return null

  const converted = convertBynToTarget(parsed.byn, rate, settings.markupPercent)
  const formattedPrimary = formatTargetCurrency(converted, settings.targetCurrency)
  let text = `≈ ${formattedPrimary}`

  if (settings.secondaryCurrency !== 'NONE' && settings.secondaryCurrency !== settings.targetCurrency) {
    const secondRate = rates.bynPerTarget[settings.secondaryCurrency]
    if (secondRate && Number.isFinite(secondRate)) {
      const secondConverted = convertBynToTarget(parsed.byn, secondRate, settings.markupPercent)
      const formattedSecondary = formatTargetCurrency(secondConverted, settings.secondaryCurrency)
      text = `≈ ${formattedPrimary} · ${formattedSecondary}`
    }
  }

  if (settings.displayMode === 'tooltip') {
    const currentTitle = el.getAttribute('title') ?? ''
    if (!currentTitle.includes('BelBucks')) {
      el.setAttribute('title', `${currentTitle ? currentTitle + '\n' : ''}BelBucks: ${text}`)
    }
  } else {
    renderInline(el, text)
  }

  PROCESSED.add(el)
  return parsed.byn
}

function scan(root: ParentNode) {
  if (!settings || !settings.enabled) return
  const preset = getPresetForLocation(location)
  const forceAssumeByn = preset?.id === 'onliner' || preset?.id === 'shop' || preset?.id === '21vek'
  ensureStyles()
  applyVisualSettings()

  const selectors = preset?.priceSelectors ?? []
  const candidateSet = new Set<Element>()
  for (const sel of selectors) {
    root.querySelectorAll(sel).forEach((el) => candidateSet.add(el))
  }
  for (const el of collectTextFallbackCandidates(root)) {
    candidateSet.add(el)
  }

  const candidates = Array.from(candidateSet)
  const leafCandidates = candidates.filter((el) => !candidates.some((other) => other !== el && el.contains(other)))
  let bestTrackedByn: number | null = null
  for (const el of leafCandidates) {
    if (preset?.excludeSelectors?.some((sel) => el.closest(sel))) continue
    const byn = applyToElement(el, forceAssumeByn)
    if (byn != null && (bestTrackedByn == null || byn > bestTrackedByn)) {
      bestTrackedByn = byn
    }
  }

  // Track one representative price per scan to avoid noisy history.
  if (bestTrackedByn != null) {
    void recordPricePoint(location.href, document.title, bestTrackedByn)
  }
}

let scanTimer: number | null = null
function scheduleScan() {
  if (scanTimer != null) window.clearTimeout(scanTimer)
  scanTimer = window.setTimeout(() => {
    scanTimer = null
    scan(document)
  }, 250)
}

async function init() {
  const s = await getSettings()
  if (!s.enabled) return
  if (!shouldRunOnHost(location.hostname, s)) return

  settings = s
  rates = await getRatesCache()
  if (!rates) {
    // Ask service worker to refresh (async) and keep going with no conversions until it lands.
    void chrome.runtime.sendMessage({ type: 'bb_refresh_rates' })
  }

  scan(document)

  observer = new MutationObserver(() => scheduleScan())
  observer.observe(document.documentElement, { childList: true, subtree: true })

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'sync' && changes.bb_settings_v1) {
      const prev = settings
      const next = changes.bb_settings_v1.newValue as UserSettings
      settings = next
      applyVisualSettings()

      // Toggle: stop all work when disabled.
      if (!next.enabled) {
        resetRenderedBadges()
        observer?.disconnect()
        observer = null
        return
      }

      // Re-enable observer if it was previously disabled.
      if (!observer) {
        observer = new MutationObserver(() => scheduleScan())
        observer.observe(document.documentElement, { childList: true, subtree: true })
      }

      const requiresRatesRefresh =
        !prev ||
        prev.rateProvider !== next.rateProvider ||
        prev.targetCurrency !== next.targetCurrency ||
        prev.secondaryCurrency !== next.secondaryCurrency ||
        prev.markupPercent !== next.markupPercent ||
        JSON.stringify(prev.customRates ?? {}) !== JSON.stringify(next.customRates ?? {})

      // Force immediate repaint for visual and format changes.
      resetRenderedBadges()
      scan(document)

      if (requiresRatesRefresh) {
        void chrome.runtime.sendMessage({ type: 'bb_refresh_rates' })
      }
    }
    if (areaName === 'local' && changes.bb_rates_cache_v1) {
      rates = changes.bb_rates_cache_v1.newValue as RatesCache
      resetRenderedBadges()
      scan(document)
    }
  })
}

void init()

