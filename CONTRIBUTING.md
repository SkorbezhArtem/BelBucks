# Contributing

Thanks for contributing to BelBucks.

## Prerequisites

- Node.js 20+
- npm 10+
- Chrome/Edge with Developer mode enabled

## Local Setup

```bash
npm install
npm run build
```

Load `dist/` as unpacked extension.

## Quality Checks

Before opening a PR:

```bash
npm run typecheck
npm test
npm run build
```

Optional coverage report:

```bash
npm run test:coverage
```

## Presets and Parsing Changes

- Add or adjust site selectors in `src/content/presets.ts`.
- Keep parsing heuristics in `src/content/contentScript.ts` narrow and site-aware.
- If you change parser behavior, add/adjust tests in `src/shared/priceParser.test.ts`.

## Commit Style

Use conventional commits:

- `feat(...)`
- `fix(...)`
- `refactor(...)`
- `docs(...)`
- `chore(...)`

## Pull Requests

Include:

- what changed;
- why it changed;
- what sites/scenarios were tested manually;
- screenshots for UI/DOM-sensitive behavior changes.
