# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-05-08

### Added
- **Element picker** for marking price-related nodes on any host. Popup
  exposes five launcher buttons (`Цена` / `Цена товара` / `Старая` /
  `Рассрочка` / `Не цена`); content-script handles hover-highlight,
  generates a stable CSS selector (id → `data-*` → stable class →
  nth-child fallback) and persists it via `UserSiteRule`. `Esc` cancels.
- **Per-host `UserSiteRule`** schema with `currentPrice`, `productPrice`,
  `oldPrice`, `installment`, `notAPrice` slots. User rules win over
  built-in presets for the matching host; empty rows are removed
  automatically so sync storage is not polluted.
- **Badge layout strategies** (`SiteVisualRule.badgeStrategy`): `inline`
  (default), `block-below`, `prepend`, `tooltip` — for hosts where the
  default inline layout fights with the page's grid.
- **JSON-LD / Schema.org currency detector** (`detectDeclaredPageCurrency`,
  `isDeclaredNonBynCurrency`). Read first; on a non-BYN page the scanner
  bails out, on a BYN page it force-assumes BYN.
- **Per-host `priceRange`** field on `SitePreset`, replacing the absolute
  `1_000_000 BYN` cap. Real-estate / car presets get a much wider window.
- **Median-relative outlier cap** during scan (50× page median) for
  cases where the page does not declare a currency.
- **Currency-marker library** (`currencyMarkers.ts`) covering `$`, `€`,
  `₽`, `USD`, `EUR`, `PLN`, `RUB`, `zł`, `₴`, `£`, `¥`, `евро`,
  `рос. руб.` etc.
- **20+ new built-in BY presets**: `oz.by`, `deal.by`, `lamoda.by`,
  `mile.by`, `megatop.by`, `5element.by`, `technopoint.by`,
  `holodilnik.by`, `electrosila.by`, `elcom.by`, `wildberries.by`,
  `ozon.by`, `av.by`, `realt.by`, `abw.by`, `dom.by`, `kvartirant.by`,
  `home.by`, plus tightened existing presets (kufar, onliner, shop,
  21vek, 7745, newton).
- **Privacy policy** + **Single Purpose** statement in `README.md`.
- **Unit tests** for `parseBynPrice` (incl. non-BYN markers),
  `canonicalizeProductUrl`, `extractCurrenciesFromJsonText`,
  `findUserSiteRule` / `pushSelector` / `upsertUserSiteRule`,
  `isRatesCacheFresh` / `isRatesCacheUsable`.

### Changed
- **Crossed-out / old prices are skipped** (`<s>`, `<del>`, `<strike>`,
  `text-decoration: line-through`, `[class*="oldPrice" i]`,
  `[class*="старая" i]`).
- **Installment / per-month prices are skipped** (`/мес`, `в месяц`,
  `рассрочка`, `кредит`, `ежемесячн`, `/month`, `per month`,
  `opłat miesi`).
- **Tracker is opt-in** via `UserSettings.priceTrackerEnabled` (off by
  default). Popup shows a one-time consent banner.
- **Tracker `MIN_RECORD_INTERVAL_MS` raised to 6 hours** (was 15 minutes)
  so re-mounting selectors don't pollute the timeline with near-duplicate
  points.
- **Tracker write-time anti-spike filter** (`SPIKE_MULTIPLIER = 5`) —
  rejects any new point whose value diverges by more than 5× from the
  previous one (almost always a misparse, not a real price change).
- **URL canonicalization** for tracker storage keys: strip `utm_*`,
  `gclid`, `fbclid`, `yclid`, `_ga*`, `ref`, `referrer`, `from` and any
  unknown query params; whitelist `id`, `item`, `product`, `sku`,
  `variant`, `color`, `size`, `tab`, `view`, `p`. Same product → one
  storage row, not N rows with N tracking tails.
- **Tracker records only on product detail pages**
  (`SitePreset.isProductPage`) and only when
  `SitePreset.productPriceSelector` matches exactly one node — listings
  / search results no longer pollute history.
- Rates cache has a **hard 24h max-age** (`RATES_CACHE_MAX_AGE_MS`) on
  top of `ttlMs`; a long network outage cannot silently surface
  week-old rates as "current".

### Fixed
- Non-BYN currency markers in node text or DOM context now make the
  scanner skip the node instead of converting USD / EUR / RUB prices
  as if they were BYN.
- Our own badge text is excluded from nearby-currency checks (no more
  self-feedback when re-scanning).
- `р.` / `руб.` is no longer auto-mapped to BYN — the scanner combines
  per-host preset, `forceAssumeByn`, page-declared currency and DOM
  context to decide.
- newton.by's spaced `kopecks` (`86 25` = 86.25 BYN) parses correctly;
  per-line installment row (`/мес`, `в месяц`) is excluded.

### Removed
- `activeTab` permission (manifest) — not needed for the single-purpose
  scope and triggers extra Web Store review friction.
- Absolute `1_000_000 BYN` sanity cap (replaced by per-host `priceRange`
  and median-relative cap).

### Security
- `chrome.runtime.onMessage` validates the sender — messages from other
  extensions or unverifiable origins are dropped.
- No data leaves the device. Outbound requests go only to `nbrb.by` and
  `belarusbank.by` rate APIs (declared in `host_permissions`).

## [0.1.0] - 2026-04-25

### Added
- MV3 extension scaffold with dedicated popup/options entrypoints and build pipeline.
- BYN parsing and conversion engine with support for localized number formats and kopecks.
- Exchange-rate provider layer with NBRB and bank-feed based providers, plus cache refresh in service worker.
- DOM scanner with MutationObserver, site presets, fallback text-node matching, and inline/tooltip rendering.
- Full options page for currency/provider selection, visual customization, domain filters, and live setting updates.
- Popup quick controls for fast setting changes and rate refresh.
- Price Tracker with sparkline visualization in popup and batched storage writes.
- Bilingual documentation (`README.md` + `README.ru.md`) with language switch links.

### Changed
- Improved candidate extraction coverage for dense, dynamic listing pages.
- Added Auto theme behavior for badge coloring per supported domain.

### Fixed
- Reduced false-positive matches on discount labels (e.g., percentages) for 21vek flows.
- Filtered out exchange-widget contexts (e.g., `1 USD = ... BYN`) from conversion badges.
- Stabilized storage usage with debounced writes to reduce `chrome.storage` quota pressure.

