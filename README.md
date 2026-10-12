# Saola Gomoku

A playable Gomoku / Vietnamese Caro application built with **Saola `.sao` components**. No React, React DOM, JSX or React runtime is required. The board, forms, state, events and lifecycle run through the Saola compiler and client.

This repository is a practical Saola case study: migrate a real React game while preserving its existing JavaScript game engine and AI algorithms.

## Run locally

Requires Node.js 22+, npm 10+, PHP 8.3+ and Composer. PHP is used at build time by the Saola compiler. The deployed game is a static SPA and needs no PHP server, API, database or account.

```sh
git clone https://github.com/saolabs/saola-gomoku.git
cd saola-gomoku
composer install
npm ci
npm run dev
```

Open [http://127.0.0.1:5556](http://127.0.0.1:5556). Development recompiles `.sao` files when source changes and serves the result through Vite. `npm run build` produces the deployable `dist/web/` directory; `npm run preview` serves an existing build.

## Play

- Play against one of four bots, with three difficulty levels.
- Play two people on the same device, with custom names.
- Watch two bots play automatically, including starting the next game.
- Choose 5×5, 10×10, 15×15, 20×20, 25×25 or 30×30 boards and 4/5/6 stones to win. A 5×5 board cannot use six.
- Choose ordinary opening or Swap2 on a 15×15 board with five stones to win.
- Use move suggestions, reset, resignation, draw offers, sound and local win statistics.

**Rules:** this is the upstream project's blocked-end Caro variant, rather than standard international Gomoku. A consecutive window of N stones wins when neither adjacent endpoint contains an opponent stone. Board edges and friendly stones outside the window do not block it. Longer runs are checked as individual N-stone windows. This distinction is essential to the referee and bot decisions.

Swap2: the first participant places X–O–X; the second chooses a color or places O–X and lets the first choose. The owner of O then moves. Opening is ordinary by default.

Options and counters are stored locally. Reload starts a new game; in-progress games are not saved. AI searches run synchronously in the browser, so large boards and harder bots may pause the UI while calculating.

## How Saola replaces the React interface

```text
game.sao: @state / @bind / @click / lifecycle hooks
    → GameSession.js: UI snapshots, timers, cleanup, player actions
        → CorrectFiveGame.js: rules, board, Swap2, turn, results
            → BOT_Origin / UCT_Independent / C5_Demo / C5_2025
                → GomokuStrategy.js and the original numeric UCT search
```

`resources/saola/web/views/game.sao` is the authored UI. Saola compiles it to Blade and browser JavaScript, then `sao-dist` bundles it with `@saolabs/client`. This case uses Saola's supported standalone mode because the original game has no server-side business logic.

`GameSession` is an adapter: it calls the imported engine for moves, victory, tactical suggestions and opening choices. It owns only UI presentation and scheduled actions. Each view has its own engine; stopping/destroying the view cancels timers, and resuming schedules at most one bot action. Editing settings pauses a pending bot turn; cancelling resumes the same game.

Generated `.generated/`, `dist/`, `node_modules/` and `vendor/` are ignored. Do not edit generated JavaScript or Blade output.

## Engine provenance and validation

The engine, common helpers, four bots and nine engine test suites were imported from `my-connect-five` on 2026-10-12. They are preserved byte for byte, including their metadata. `UPSTREAM.json` records SHA-256 for every imported source and test file. Builds verify these hashes before compilation. No sibling checkout is needed to run this repository.

```sh
npm run verify:engine     # Check all imported file hashes
npm test                 # Engine regression tests + UI adapter tests
npm run test:engine      # Original engine regression tests only
npm run test:ui          # Browser integration checks (serves the build if needed)
```

For browser tests, install Playwright Chromium with `npx playwright install chromium`. To use an installed Chrome instead: `PLAYWRIGHT_CHANNEL=chrome npm run test:ui`.

The test harness supplies Jest-compatible spies to Vitest and an isolated localStorage. The full-board tests keep their original assertions, while this harness raises their explicit 120-second limits to 300 seconds for slower jsdom environments. The 30×30 seeded match can take several minutes. The original engine's unused resize-image utility causes a Vite const-reassignment warning; its source is kept unchanged for provenance.

## Static deployment

Serve the complete `dist/web/` directory through any static host. Routes use hash navigation, so history rewrites are unnecessary. For a subdirectory build:

```sh
SAOLA_DIST_BASE_URL=/saola-gomoku/ npm run build
```

The included GitHub Actions workflow tests and builds the game, then deploys to GitHub Pages when the repository's Pages source is set to GitHub Actions. Sounds are shipped with the game; no CDN is needed at runtime.

See [the case study](docs/SAOLA_CASE_STUDY.md) for migration decisions and validation.
