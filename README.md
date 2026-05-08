# BelBucks

**English** | [Русский](./README.ru.md)

BelBucks is a Chrome/Edge (Manifest V3) extension that automatically finds BYN prices on web pages and displays foreign currency equivalents next to them.

The project is focused on Belarusian marketplaces and listing websites, with strong emphasis on:
- clear and visible UI;
- solid performance on dynamic pages;
- flexible user customization;
- live updates without manual page reloads.

## Features

### Price Conversion
- Automatic price discovery (CSS presets + text-node fallback scanner).
- Supports formats like `1 500,00 BYN`, `1.500 р.`, `от 1105,60 ƃ`, `15.5 коп.`.
- Badge output format: `≈ $100.00`, with optional second currency: `≈ $100.00 · €92.00`.
- Badge layout strategies: `inline` (default), `block-below`, `prepend`, `tooltip`.
- **Currency disambiguation** uses Schema.org / JSON-LD `priceCurrency` as
  the primary signal, then falls back to non-BYN markers (`$`, `€`, `₽`,
  `USD`, `EUR`, `PLN`, `RUB`, `zł`, `евро`, `рос. руб.`, `coral.com.ru`-style
  domains, etc.). Ambiguous `р.` / `руб.` is decided by combining
  per-host preset, page-declared currency and DOM context.
- **Crossed-out / old prices are skipped** (`<s>`, `<del>`, `<strike>`,
  `text-decoration: line-through`, `[class*="oldPrice" i]`,
  `[class*="старая" i]`).
- **Installment prices are skipped** (`/мес`, `в месяц`, `рассрочка`,
  `кредит`, `ежемесячн`, `/month`, `per month`, `opłat miesi`).
- **Per-host price range** (`SitePreset.priceRange`) — real estate /
  car listings get a much wider window than electronics; absolute
  `1_000_000 BYN` cap is gone.
- **Median-relative outlier cap** in scan: a single value > 50× the
  page median is rejected as a misparse instead of being rendered.

### Exchange Rate Sources
- `NBRB` (official rate).
- `BankAverage` (average across bank feed, MVP).
- `BankBest` (best available bank rate in feed, MVP).
- `BankSpecific` (MVP mode via available bank feed).
- `Custom` (manual rate).

> Bank-based modes are currently backed by an aggregated Belarusbank feed in MVP.
> If that feed is unavailable, BelBucks falls back to NBRB and shows a warning in UI.

### Customization
- Primary and secondary currency (`USD`, `EUR`, `PLN`, `RUB`).
- Bank markup adjustment (`-5% ... +10%`).
- Badge background and text colors.
- `Auto theme` mode (site-based color presets, e.g. `av.by` / `onliner.by`).
- Domain whitelist / blacklist.
- **Per-host user rules** (`UserSiteRule`): mark which DOM nodes are the
  current price, the old / crossed-out price, an installment price, or
  "not a price at all" so the converter can be tuned to any host the
  built-in presets do not yet cover.
- **Element picker.** Click a launcher button in the popup ("Цена",
  "Старая", "Рассрочка", "Не цена"), then hover an element on the page
  and click — BelBucks generates a stable CSS selector and stores it in
  the matching `UserSiteRule` slot for that host. `Esc` cancels.
- **Badge layout strategy** (per-host, via `SiteVisualRule.badgeStrategy`):
  `inline` (default), `block-below` (badge goes onto its own line under
  the price — useful for tight grids where an inline badge would push
  layout), `prepend` (badge sits before the price text), or `tooltip`
  (no visible badge, only `title=` on the price node).

### Price Tracker
- **Opt-in.** Off by default. The popup shows a one-time consent banner;
  until the user clicks "Включить" no per-URL data is recorded
  (`UserSettings.priceTrackerEnabled`).
- Stores page price history (`chrome.storage.local`, debounced batched
  writes).
- Shows mini sparkline chart in popup.
- Records **only on product detail pages** (`SitePreset.isProductPage`)
  and **only when** the page-level product price selector matches a
  single node, so listings / search results don't pollute history with
  unrelated card prices.
- **6-hour minimum interval** between recorded points for the same URL
  (raised from 15 minutes) — re-opening a tab with selectors that
  briefly mismatch / re-mount no longer creates near-duplicate points.
- **Write-time anti-spike filter** (`SPIKE_MULTIPLIER = 5`): a new point
  whose value differs from the previous one by more than 5× is rejected
  as a misparse instead of being stored.
- **Canonical URL keys** — `utm_*`, `gclid`, `fbclid`, `yclid`, `_ga*`,
  `ref`, `referrer`, `from` and unknown query params are stripped before
  the URL becomes a storage key, so the same product is one row instead
  of N rows with N tracking tails.

## Supported Sites (built-in presets)

- General marketplaces / catalogs: `kufar.by`, `onliner.by`,
  `catalog.onliner.by`, `21vek.by`, `shop.by`, `oz.by`, `deal.by`,
  `lamoda.by`, `mile.by`, `megatop.by`, `wildberries.by`, `ozon.by`.
- Electronics / appliances: `7745.by`, `5element.by`, `technopoint.by`,
  `holodilnik.by`, `electrosila.by`, `elcom.by`.
- DIY / household: `newton.by`.
- Cars: `av.by`, `abw.by`.
- Real estate: `realt.by`, `dom.by`, `kvartirant.by`, `home.by`.

Each preset can declare its own `priceSelectors`, `oldPriceSelectors`,
`productPriceSelector`, `excludeSelectors`, `priceRange`, `isProductPage`
and `forceAssumeByn`. Anything not in the list above falls through to
the generic scanner; user-defined `UserSiteRule`s always win over the
preset for the matching host.

The architecture is extensible: new site presets can be added without rewriting the core engine.

## Tech Stack

- `TypeScript`
- `React` (popup/options UI)
- `Vite` (build)
- `Manifest V3`
- `chrome.storage.sync` (user settings)
- `chrome.storage.local` (rates cache, price history)
- `MutationObserver` (dynamic content handling)
- strict TypeScript mode (`"strict": true`)

## Permissions (Manifest V3)

BelBucks requests:

- `storage` — persist user settings and local rates/tracker cache.
- `alarms` — schedule periodic rates refresh in background.

Host permissions:

- `https://www.nbrb.by/*` — official exchange rate API.
- `https://belarusbank.by/*` — MVP aggregated bank feed used by bank modes.

Content script scope:

- `<all_urls>` — required for BYN price detection across user-visited pages.
  The content script only reads visible price text; nothing is sent off-device.

## Single Purpose

BelBucks has a single purpose: **show the foreign-currency equivalent of BYN
prices on web pages the user is already looking at.** All features (rate
providers, themes, per-site rules, optional price-history sparkline) exist to
serve that one goal. There is no analytics, no remote logging, no advertising,
no account, and no server owned by BelBucks.

## Privacy

- **No data leaves the user's device.** The extension does not send price
  text, page URLs, page content or user identifiers to any server. The only
  outbound network requests are to the official rate sources listed in the
  `Host permissions` section above.
- **Local-only storage.**
  - `chrome.storage.sync` — user settings (currency, theme, per-site rules).
    Synced across the user's own Chrome profile by Chrome itself; BelBucks
    never reads it from any other device or account.
  - `chrome.storage.local` — exchange-rate cache and (only if explicitly
    enabled) the price-history sparkline. Deleted when the extension is
    uninstalled.
- **Price tracker is opt-in.** The price-history feature is off by default.
  A first-run banner in the popup asks for explicit consent; until the user
  clicks "Включить" no per-URL data is recorded. The user can turn it back
  off at any time, and individual URL histories can be cleared from the
  popup.
- **No third parties.** BelBucks does not embed analytics SDKs, tag
  managers, or remote scripts.

## Project Structure

- `src/content/contentScript.ts` — price detection + rendering on websites.
- `src/content/presets.ts` — per-site selector presets.
- `src/background/serviceWorker.ts` — rates refresh + cache control.
- `src/shared/priceParser.ts` — BYN price parser.
- `src/shared/converter.ts` — conversion + formatting.
- `src/shared/rates/` — rate providers.
- `src/shared/rates/ratesService.ts` — provider adapter contract + fallback logic.
- `src/shared/storage.ts` — settings/cache read-write layer.
- `src/shared/priceTracker.ts` — price tracker logic.
- `src/ui/options/` — full settings UI.
- `src/ui/popup/` — quick settings + tracker view.

## Development Setup

### 1) Install dependencies
```bash
npm install
```

### 2) Build extension
```bash
npm run build
```

Output is generated in `dist/`.

### 3) Load unpacked extension
- Open extensions page:
  - Chrome: `chrome://extensions`
  - Edge: `edge://extensions`
- Enable `Developer mode`.
- Click `Load unpacked`.
- Select `dist/`.

## Commands

- `npm run build` — production build.
- `npm run typecheck` — strict TypeScript validation.
- `npm test` — run unit tests (`vitest`).
- `npm run test:coverage` — run tests with coverage report.

## Rate APIs (MVP)

- NBRB:
  `https://www.nbrb.by/api/exrates/rates/{CUR}?parammode=2`

- Bank feed used for `BankAverage` / `BankBest` in MVP:
  `https://belarusbank.by/api/kursExchange?city=...`

> Note: in the current MVP, bank-based modes are implemented on top of an available aggregated bank feed (not full multi-bank integration yet). Additional adapters (including Myfin-like sources) can be added through the same provider layer.

## Real-Time Behavior

- Settings are applied to active pages without full page reload:
  - badge repaint;
  - live color updates;
  - automatic rates refresh when provider/currency changes.
- Settings/history writes are protected against quota overuse via debounce + batching.

## Known MVP Limitations

- Some websites with highly unstable DOM may still require targeted selectors.
- Price Tracker currently stores one representative page price (not separate per-item list tracking).
- Part of bank-source behavior is still based on shared feeds, not full multi-aggregator integration.

## Build Architecture (MV3)

- `vite` builds HTML UI entries (`options.html`, `popup.html`).
- `esbuild` builds scripts with MV3-required formats:
  - `contentScript.ts` -> IIFE (`dist/contentScript.js`)
  - `serviceWorker.ts` -> ESM (`dist/serviceWorker.js`)

## Troubleshooting

### Badges are not visible
- Ensure extension is enabled.
- Check domain is not blacklisted.
- Reload extension in `chrome://extensions`.
- Hard-refresh page (`Ctrl+F5`).

### Color/settings updates look inconsistent
- Check whether `Auto theme` is enabled (manual color pickers are disabled in auto mode).
- Click `Refresh rates` in popup after switching provider.

### Quota errors in extension page
- Debounce/batching is already enabled.
- Old errors may remain in browser UI; clear errors list and reload extension.

## Roadmap

- Split tracker into `list-price` and `product-price`.
- Expand site presets and selector coverage.
- Enhanced visual customizer (size, opacity, style presets).
- ~~Selector builder ("pick a price on page").~~ — shipped in 0.2.0
  (see "Element picker" under Customization).
- More bank-rate adapters and explicit bank selection.
- Community rules: shareable per-host `UserSiteRule` packs.
- Export / import of user settings + rules.
- Drag-to-reposition badges on a per-host basis.

## Development Process

- CI workflow (`.github/workflows/ci.yml`) runs on push/PR:
  - `npm ci`
  - `npm run typecheck`
  - `npm test`
  - `npm run build`
- Contribution guide: see `CONTRIBUTING.md`.
- License: `MIT` (`LICENSE`).

