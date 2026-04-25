# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

