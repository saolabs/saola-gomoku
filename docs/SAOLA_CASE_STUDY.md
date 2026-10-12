# Case study: a real Caro game without React

## What was migrated

The original `my-connect-five` game uses React to render a board, sidebar and modal forms. Its rules and bot algorithms are plain JavaScript. This migration replaces the React presentation and orchestration with Saola while importing those algorithms unchanged.

The application is named **Saola Gomoku**. Gomoku / Five in a Row is the familiar English name; the UI calls the game Caro and explains the project's specific blocked-end rule.

## What this demonstrates

- `.sao` is the authored component source, compiled by `saola/compiler`.
- `@state` and generated setters update the board, turn labels, statistics and modal visibility.
- `@foreach` with coordinate keys renders up to 900 interactive board cells.
- `@bind` connects native form controls; `@click` and `@submit` drive player actions.
- `@if` controls colors, Swap2 choices, game results and configuration constraints.
- Saola view lifecycle hooks pause, resume and dispose game timers.
- `@saolabs/builder` produces a standalone browser application with the Saola client.
- Existing JavaScript classes integrate directly; this migration has no React dependencies.

The PHP compiler is required on the build machine. Static hosting only serves HTML, JavaScript and the bundled audio files. A Laravel backend can be added later if the product needs accounts, network multiplayer or server-authoritative games; those features are outside the current local-game scope.

## Preserved behavior

All four upstream models are available: BOT_Origin, UCT_Independent, C5_Demo and C5_2025. The game keeps configurable board sizes and victory lengths, ordinary opening, both Swap2 branches, victory highlighting, actor-based statistics, bot autoplay, tactical suggestions, resignation and draw offers.

Engine files and original tests are verified against the hashes in `UPSTREAM.json`. The adapter delegates actual moves to `playerSelect()` / `auto()`, color decisions to `resolveOpeningChoice()`, and results to the engine referee. The draw acceptance policy uses the same two-position score comparison as the original UI.

## Integration checks

The adapter tests cover separate view instances, refusing human input during a computer turn, cancellation on reset/configuration/destruction, pause/resume scheduling, ordinary victory, the Swap2 extension branch, board normalization, resignation, draw replies and stopping automation after an AI error.

Browser checks exercise the compiled `.sao` output, not a mock interface: two-player victory, modal cancellation, six-stone restrictions on a 5×5 board, AI response, Swap2 extension/color ownership, autoplay, audio options and mobile overflow.

The engine regression suite includes an independent numeric referee, endpoint/longer-run cases, bot tactical positions, complete seeded games and independent UCT checks. Test execution budgets differ from the original Jest runner; assertions and game source stay identical.

CI runs the rules, tactical, UCT, Swap2, adapter and browser checks. The exhaustive matrices have a separate manually triggered workflow with a larger CPU budget. The local engine verification covered all 245 upstream cases, including rerunning a timed match successfully, and 12 additional adapter cases. No test assertions were removed or weakened. The application runs locally; no hosting or publication is configured.

## Limits

This is local play on one device. It does not claim international Gomoku/Renju rules, online identity, ratings or secure multiplayer. No in-progress game persistence is added. Large synchronous AI searches can occupy the browser main thread; moving those searches to a worker would be a separate performance change.
