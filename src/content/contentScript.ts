import { convertBynToTarget, formatTargetCurrency } from '../shared/converter'
import { hasNonBynMarker } from '../shared/currencyMarkers'
import { detectDeclaredPageCurrency } from '../shared/jsonLdCurrency'
import { parseBynPrice } from '../shared/priceParser'
import { recordPricePoint } from '../shared/priceTracker'
import { getRatesCache, getSettings } from '../shared/storage'
import { isEnabledForSite } from '../shared/siteRules'
import { resolveVisualSettingsForHost } from '../shared/siteVisual'
import type { RatesCache, UserSettings } from '../shared/types'
import type { PriceRange } from './presets.ts'
import { getPresetForLocation } from './presets.ts'

// Sane defaults for hosts where we have no preset. Lower than the previous
// 1_000_000 BYN ceiling because real-estate / cars on .by easily clear it,
// but still high enough to filter out absurd values from broken parses.
const DEFAULT_PRICE_RANGE: PriceRange = { min: 0.01, max: 100_000_000 }

let PROCESSED = new WeakSet<Element>()
let settings: UserSettings | null = null
let rates: RatesCache | null = null
let badgeCounter = 0
let observer: MutationObserver | null = null
const PRICE_WITH_CURRENCY_RE = /\d[\d\s\u00A0\u202F]*(?:[.,]\d{1,2})?\s*(?:byn|бел\.?\s*(?:руб|р)\.?|руб|р\.?|br|ƃ)/i

function hasDigits(text: string): boolean {
  return /\d/.test(text)
}

function hasCurrencyHint(text: string): boolean {
  return /(byn|бел\.?\s*(?:руб|р)\.?|руб|br|(^|\s)р\.?($|\s)|ƃ)/i.test(text)
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

function isSafeAssumeBynToken(text: string): boolean {
  const t = text.replace(/\s+/g, ' ').trim()
  const digitsOnly = t.replace(/\D/g, '')
  // Avoid phone/article-like long numeric blobs when currency hint is absent.
  if (digitsOnly.length >= 9) return false
  if (/\+?\d[\d\s().-]{8,}/.test(t) && !/[.,]\d{1,2}\b/.test(t)) return false
  if (/(артикул|код|sku|id)/i.test(t)) return false
  return true
}

function isMinorOnlyFragment(text: string): boolean {
  const t = text.replace(/\s+/g, ' ').trim()
  // Fragments like ",43" / ".43" / "43 к." must not be treated as standalone BYN prices.
  if (/^[^\d]*[.,]\s*\d{1,2}[^\d]*$/.test(t)) return true
  if (/^\d{1,2}[^\d]*$/.test(t) && !/(byn|бел|руб|р\.?|br|ƃ)/i.test(t)) return true
  return false
}

const INSTALLMENT_RE =
  /(\/\s*мес\b|в\s*мес(яц|\.)?\b|\/\s*month\b|per\s*month\b|рассроч|кредит|ежемесячн|monthly\s*payment|opłat\s*miesi)/i

function looksLikeInstallment(text: string): boolean {
  return INSTALLMENT_RE.test(text)
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

function textExcludingBadges(root: Element | null | undefined): string {
  // Collect text content of `root` while skipping any subtree that belongs
  // to one of our rendered badges. This is critical because our badge text
  // already contains the target currency symbol ("≈ $5.99") — without this
  // filter, sibling/ancestor checks would self-trigger on re-scans.
  if (!root) return ''
  if ((root as HTMLElement).dataset?.bbBadge === '1') return ''
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      let p: Node | null = node.parentNode
      while (p && p !== root) {
        if (p.nodeType === Node.ELEMENT_NODE && (p as HTMLElement).dataset?.bbBadge === '1') {
          return NodeFilter.FILTER_REJECT
        }
        p = p.parentNode
      }
      return NodeFilter.FILTER_ACCEPT
    },
  })
  const parts: string[] = []
  let n: Node | null = walker.nextNode()
  while (n) {
    parts.push(n.textContent ?? '')
    n = walker.nextNode()
  }
  return parts.join(' ')
}

function hasNearbyCurrencyHint(el: Element): boolean {
  if (hasCurrencyHint(textExcludingBadges(el))) return true
  if (hasCurrencyHint(textExcludingBadges(el.parentElement))) return true
  if (hasCurrencyHint(textExcludingBadges(el.previousElementSibling))) return true
  return hasCurrencyHint(textExcludingBadges(el.nextElementSibling))
}

function hasNearbyNonBynMarker(el: Element): boolean {
  // Look up to 3 ancestors and the immediate sibling pair so we catch markers
  // that sit next to the price node (e.g. $-prices on kufar with the symbol
  // rendered in a sibling span). Badge text is excluded everywhere.
  if (hasNonBynMarker(textExcludingBadges(el))) return true
  let cur: Element | null = el.parentElement
  for (let i = 0; cur && i < 3; i++) {
    if (hasNonBynMarker(textExcludingBadges(cur))) return true
    cur = cur.parentElement
  }
  if (hasNonBynMarker(textExcludingBadges(el.previousElementSibling))) return true
  return hasNonBynMarker(textExcludingBadges(el.nextElementSibling))
}

function isVisibleElement(el: Element): boolean {
  const h = el as HTMLElement
  if (!h.isConnected) return false
  if (h.offsetParent === null && getComputedStyle(h).position !== 'fixed') return false
  const cs = getComputedStyle(h)
  if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false
  return true
}

const OLD_PRICE_CLASS_RE = /(^|[\s_-])(old|original|was|crossed|strik|prev|previous|discount-from|old[-_]?price|old[-_]?cost|стар(ая|ой|ую)|зач[её]ркн)/i

function isCrossedOutOrOldPrice(el: Element): boolean {
  // (a) Wrapping legacy strike-through tags.
  if (el.closest('s, del, strike')) return true
  // (b) CSS line-through anywhere up the tree (handles flexbox layouts where the
  //     <s> got replaced with a span + style).
  let cur: Element | null = el
  for (let i = 0; cur && i < 6; i++) {
    const cs = getComputedStyle(cur as HTMLElement)
    if (cs.textDecorationLine && /line-through/.test(cs.textDecorationLine)) return true
    cur = cur.parentElement
  }
  // (c) Class names that hint "old / was / crossed" — covers the common
  //     framework patterns plus localized Russian "старая цена" classes.
  cur = el
  for (let i = 0; cur && i < 4; i++) {
    const cls = (cur as HTMLElement).className
    const classStr = typeof cls === 'string' ? cls : (cur as HTMLElement).getAttribute?.('class') ?? ''
    if (typeof classStr === 'string' && OLD_PRICE_CLASS_RE.test(classStr)) return true
    cur = cur.parentElement
  }
  return false
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

function extractSplitPriceVariant(el: Element): string | null {
  // Build structural major/minor pair from local node sequence.
  // Handles patterns like: "451<sup>91</sup> бел. р." and "$0<i>198</i><i>00</i>".
  const tokens: string[] = []
  for (const node of Array.from(el.childNodes)) {
    const raw =
      node.nodeType === Node.TEXT_NODE ? node.textContent ?? '' : node.nodeType === Node.ELEMENT_NODE ? node.textContent ?? '' : ''
    const t = raw.replace(/\s+/g, '').replace(/[^\d]/g, '')
    if (t) tokens.push(t)
  }

  // Fallback: some product pages nest integer/fractional parts in spans.
  if (tokens.length < 2) {
    const nested = Array.from(el.querySelectorAll('i, sup, sub, span, b, strong'))
      .map((n) => (n.textContent ?? '').replace(/\s+/g, '').replace(/[^\d]/g, ''))
      .filter(Boolean)
    tokens.push(...nested)
  }
  if (tokens.length < 2) return null

  const candidates: string[] = []
  for (let i = 0; i < tokens.length - 1; i++) {
    const major = tokens[i] ?? ''
    const minor = tokens[i + 1] ?? ''
    if (!/^\d{1,6}$/.test(major)) continue
    if (!/^\d{1,2}$/.test(minor)) continue
    if (major === '0') continue
    candidates.push(`${major}.${minor.padEnd(2, '0').slice(0, 2)}`)
  }
  if (candidates.length === 0) return null
  // Prefer the largest major part as likely "current price" over old/discount fragments.
  candidates.sort((a, b) => Number(b.split('.')[0]) - Number(a.split('.')[0]))
  return candidates[0] ?? null
}

function extractSiblingMinorVariant(el: Element): string | null {
  const majorText = (el.textContent ?? '').replace(/\s+/g, '').trim()
  if (!/^\d{1,6}$/.test(majorText)) return null

  const siblingCandidates: Element[] = []
  if (el.nextElementSibling) siblingCandidates.push(el.nextElementSibling)

  const parent = el.parentElement
  if (parent) {
    const scoped = parent.querySelector('.h_flx_nsh.h_txt_hdl, .h_txt_hdl')
    if (scoped && scoped !== el && !siblingCandidates.includes(scoped)) siblingCandidates.push(scoped)
  }

  let minor = ''
  for (const cand of siblingCandidates) {
    const txt = (cand.textContent ?? '').replace(/\s+/g, ' ').trim().toLowerCase()
    const m = txt.match(/(^|[^\d])(\d{1,2})\s*(?:б|б\.|byn|руб|р\.?|br|ƃ)?\b/)
    if (m?.[2]) {
      minor = m[2]
      break
    }
  }

  if (!/^\d{1,2}$/.test(minor)) return null

  return `${majorText}.${minor.padEnd(2, '0').slice(0, 2)}`
}

function findPriceRenderAnchor(el: Element): Element {
  const next = el.nextElementSibling
  if (next) {
    const txt = (next.textContent ?? '').replace(/\s+/g, ' ').trim().toLowerCase()
    if (
      next.matches('.h_flx_nsh.h_txt_hdl, .h_txt_hdl') &&
      /(^|[^\d])\d{1,2}\s*(?:б|б\.|byn|руб|р\.?|br|ƃ)?\b/.test(txt)
    ) {
      return next
    }
  }
  return el
}

function shouldRunOnHost(host: string, s: UserSettings): boolean {
  return isEnabledForSite({
    enabledGlobal: s.enabled,
    host,
    defaultMode: s.siteDefaultMode,
    rules: s.siteRules,
  })
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
  padding:calc(var(--bb-badge-pad-y, 2px) * 1px) calc(var(--bb-badge-pad-x, 8px) * 1px);
  border-radius:999px;
  border:1px solid color-mix(in srgb, var(--bb-badge-bg, #7f8fff) 85%, #000 15%);
  background:var(--bb-badge-bg, #7f8fff);
  color:var(--bb-badge-text, #0d1a46);
  font-weight:700;
  font-size:calc(var(--bb-badge-font, 12px) * 1px);
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
  const v = resolveVisualSettingsForHost(settings, location.hostname)
  document.documentElement.style.setProperty('--bb-badge-bg', v.bg)
  document.documentElement.style.setProperty('--bb-badge-text', v.text)
  document.documentElement.style.setProperty('--bb-badge-font', String(v.fontSizePx))
  document.documentElement.style.setProperty('--bb-badge-pad-y', String(v.paddingYpx))
  document.documentElement.style.setProperty('--bb-badge-pad-x', String(v.paddingXpx))
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

function applyToElement(el: Element, forceAssumeByn: boolean, priceRange: PriceRange): number | null {
  if (!settings || !rates) return null
  if (PROCESSED.has(el)) return null
  if (!isVisibleElement(el)) return null
  if ((el as HTMLElement).dataset.bbBadge === '1') return null
  if (el.closest('[data-bb-badge="1"]')) return null

  // Don't touch obvious foreign-currency cells (kufar dollar listings, RUB
  // marketplaces, etc.). Markers must be unambiguous (€, $, ₽, USD…); the
  // parser handles inline ones, this catches DOM-context ones.
  if (hasNearbyNonBynMarker(el)) return null

  // Skip the old / crossed-out price so we don't render a long "X · ≈ Y"
  // string that pushes the badge off-screen on narrow listings.
  if (isCrossedOutOrOldPrice(el)) return null

  // Installment / monthly-payment cells: parsing the small per-month figure as
  // BYN and converting yields nonsense ("≈ \$0.85" next to a 2.38 р/мес label).
  // Probe the local slice first (own + parent) — going wider would catch the
  // "в рассрочку" copy that appears far above genuine prices.
  const installmentText = `${textExcludingBadges(el)} ${textExcludingBadges(el.parentElement)}`
  if (looksLikeInstallment(installmentText)) return null

  const splitVariant = extractSplitPriceVariant(el) ?? extractSiblingMinorVariant(el)
  let textVariants = extractTextVariants(el).filter(isLikelyPriceToken)
  if (splitVariant) {
    textVariants = [
      splitVariant,
      ...textVariants.filter((v) => {
        const compact = v.replace(/\s+/g, '')
        // Drop known placeholder-like concatenations such as "$019800".
        return !/^\$?0\d{4,}$/.test(compact)
      }),
    ]
  }
  if (textVariants.length === 0) return null

  if (isRateWidgetContext(el, textVariants)) return null

  const parsedCandidates: number[] = []
  let splitCandidate: number | null = null
  for (const rawText of textVariants) {
    if (isMinorOnlyFragment(rawText) && rawText !== splitVariant) continue
    const hasHint = hasCurrencyHint(rawText) || hasNearbyCurrencyHint(el)
    let candidate = parseBynPrice(rawText)
    if (!candidate && (hasHint || (forceAssumeByn && isSafeAssumeBynToken(rawText)))) {
      candidate = parseBynPrice(rawText, { assumeByn: true })
    }
    // Per-host range. Defaults are wide enough for av.by / realt.by but
    // still drop placeholder-zero and impossibly large values.
    if (candidate && candidate.byn >= priceRange.min && candidate.byn <= priceRange.max) {
      parsedCandidates.push(candidate.byn)
      if (splitVariant && rawText === splitVariant) splitCandidate = candidate.byn
    }
  }
  if (parsedCandidates.length === 0) return null
  const parsedByn = splitCandidate ?? Math.max(...parsedCandidates)

  const rate = rates.bynPerTarget[settings.targetCurrency]
  if (!rate || !Number.isFinite(rate)) return null

  const converted = convertBynToTarget(parsedByn, rate, settings.markupPercent)
  const formattedPrimary = formatTargetCurrency(converted, settings.targetCurrency)
  let text = `≈ ${formattedPrimary}`

  if (settings.secondaryCurrency !== 'NONE' && settings.secondaryCurrency !== settings.targetCurrency) {
    const secondRate = rates.bynPerTarget[settings.secondaryCurrency]
    if (secondRate && Number.isFinite(secondRate)) {
      const secondConverted = convertBynToTarget(parsedByn, secondRate, settings.markupPercent)
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
    const anchor = findPriceRenderAnchor(el)
    renderInline(anchor, text)
  }

  PROCESSED.add(el)
  return parsedByn
}

function scan(root: ParentNode) {
  if (!settings || !settings.enabled) return
  const preset = getPresetForLocation(location)

  // Trust the page's own declaration over any preset / heuristic. If the site
  // explicitly says "priceCurrency: USD" we have no business converting; if it
  // says BYN we can safely force-assume even when the inline glyph is absent.
  const declaredCurrency = detectDeclaredPageCurrency(root)
  if (declaredCurrency && declaredCurrency !== 'BYN' && declaredCurrency !== 'BYR') {
    return
  }
  const declaredByn = declaredCurrency === 'BYN' || declaredCurrency === 'BYR'

  const forceAssumeByn =
    declaredByn ||
    preset?.forceAssumeByn === true ||
    preset?.id === 'onliner' ||
    preset?.id === 'shop' ||
    preset?.id === '21vek' ||
    preset?.id === '7745' ||
    preset?.id === 'newton'
  const priceRange = preset?.priceRange ?? DEFAULT_PRICE_RANGE
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
  const trackedBynValues: number[] = []
  const trackedPrimaryValues: number[] = []
  for (const el of leafCandidates) {
    if (preset?.excludeSelectors?.some((sel) => el.closest(sel))) continue
    const byn = applyToElement(el, forceAssumeByn, priceRange)
    if (byn != null) {
      trackedBynValues.push(byn)
      const isPrimary = (preset?.trackerPrimarySelectors ?? []).some((sel) => {
        try {
          return el.matches(sel) || !!el.closest(sel)
        } catch {
          return false
        }
      })
      if (isPrimary) trackedPrimaryValues.push(byn)
    }
  }

  // Track one representative price per scan and suppress obvious outliers.
  // Order of preference:
  //   1. preset.productPriceSelector matching exactly one node — that's the
  //      canonical "current" price on a product page, no guesswork required.
  //   2. preset.trackerPrimarySelectors (a small whitelist) when the preset
  //      provides any.
  //   3. All parsed prices on the page, after a median-based outlier cut.
  //
  // Recording is also gated by isProductPage: on listings / search results
  // there is no single "this product's price" to track and any guess is a
  // future bug report.
  const isProductPage = preset?.isProductPage ? preset.isProductPage(location) : true
  let representative: number | null = null

  if (isProductPage && preset?.productPriceSelector) {
    const matches = root.querySelectorAll<Element>(preset.productPriceSelector)
    if (matches.length === 1) {
      const sole = matches[0]
      const text = textExcludingBadges(sole)
      const parsed =
        parseBynPrice(text) ??
        (forceAssumeByn || isSafeAssumeBynToken(text) ? parseBynPrice(text, { assumeByn: true }) : null)
      if (
        parsed &&
        Number.isFinite(parsed.byn) &&
        parsed.byn >= priceRange.min &&
        parsed.byn <= priceRange.max
      ) {
        representative = parsed.byn
      }
    }
  }

  if (representative == null && isProductPage) {
    const pool = trackedPrimaryValues.length > 0 ? trackedPrimaryValues : trackedBynValues
    if (pool.length > 0) {
      const sorted = [...pool].sort((a, b) => a - b)
      const median = sorted[Math.floor(sorted.length / 2)] ?? 0
      const outlierCutoff = median > 0 ? median * 50 : Number.POSITIVE_INFINITY
      const filtered = sorted.filter((v) => v <= outlierCutoff)
      const candidates = filtered.length > 0 ? filtered : sorted
      let r = candidates[candidates.length - 1]
      if (candidates.length >= 2) {
        const second = candidates[candidates.length - 2]
        if (r > second * 10) r = second
      }
      representative = r
    }
  }

  if (representative != null) {
    void recordPricePoint(location.href, document.title, representative)
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

      // Per-site rules: stop all work if host is blocked.
      if (!shouldRunOnHost(location.hostname, next)) {
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

