# Pokemon Battle Browser Game - Research

Access date: 2026-07-04

## Research Frame

- Topic: Browser-based game focused only on Pokemon-style battles.
- Decision goal: choose a battle simulation approach, data source, browser architecture, MVP scope, and risk controls before implementation.
- Target reader: future Codex sessions implementing `C:\AI-Workspace\projects\pokemon`.
- Time scope: current web/browser ecosystem as of 2026-07-04.
- Geography: local development first; public release risk noted separately.
- Research questions:
  1. Should the battle mechanics be implemented from scratch or backed by an existing engine?
  2. Which libraries can run battle simulation in the browser?
  3. What data sources are appropriate for Pokemon, moves, types, abilities, and sprites?
  4. What mechanics belong in the first playable MVP?
  5. What legal/IP and asset risks should shape the implementation?

## Bottom Line

Use a proven simulator for the core rules, and keep our code focused on the playable browser experience.

The best default is `Vite + TypeScript + React` with `@pkmn/sim` as the battle simulator, `@pkmn/protocol` / `@pkmn/client` for battle state parsing, and a local UI adapter that converts simulator requests into buttons and animations. This avoids hand-rolling the many edge cases in Pokemon battle rules while still letting us build our own battle screen, menus, effects, CPU behavior, and progression.

Do not use the upstream `pokemon-showdown` npm package directly in the browser for the first implementation. Its own docs say the Node API currently works in Node, not browsers. `@pkmn/sim` exists specifically as a browser-usable modular extraction of the simulator and supports generations 1-9.

`@pkmn/engine` is also browser-capable via WebAssembly and technically attractive, but its docs say modern generation support is future work and only Gen I is currently supported through the TypeScript API. Use it only if we deliberately choose a Gen I retro battle game.

## Source Ledger

| ID | Source | URL | Publisher | Updated / Published | Type | Credibility | Notes |
|---|---|---|---|---|---|---|---|
| S1 | Pokemon Showdown repository README | https://github.com/smogon/pokemon-showdown | Smogon / Pokemon Showdown contributors | Accessed 2026-07-04 | Open-source project | High for simulator scope | Describes Pokemon Showdown as a JS battle simulator and data library, supporting gens 1-9; server is MIT licensed. |
| S2 | Pokemon Showdown `sim/README.md` | https://raw.githubusercontent.com/smogon/pokemon-showdown/master/sim/README.md | Pokemon Showdown contributors | Accessed 2026-07-04 | Official project docs | High | Node API currently works in Node, not browsers; undocumented APIs should be pinned. |
| S3 | Pokemon Showdown `SIMULATOR.md` and `SIM-PROTOCOL.md` | https://raw.githubusercontent.com/smogon/pokemon-showdown/master/sim/SIMULATOR.md / https://raw.githubusercontent.com/smogon/pokemon-showdown/master/sim/SIM-PROTOCOL.md | Pokemon Showdown contributors | Accessed 2026-07-04 | Official project docs | High | Defines stream inputs, player choices, choice requests, update messages, battle events, damage/status/weather/switch protocol lines. |
| S4 | `@pkmn/ps` and `@pkmn/sim` README | https://raw.githubusercontent.com/pkmn/ps/main/README.md / https://raw.githubusercontent.com/pkmn/ps/main/sim/README.md | pkmn contributors | Accessed 2026-07-04 | Open-source project docs | High | `@pkmn/sim` is a generated extraction of Pokemon Showdown sim, browser-usable, gens 1-9, MIT. |
| S5 | `@pkmn/client`, `@pkmn/protocol`, `@pkmn/view` READMEs | https://raw.githubusercontent.com/pkmn/ps/main/client/README.md / https://raw.githubusercontent.com/pkmn/ps/main/protocol/README.md / https://www.npmjs.com/package/%40pkmn/view | pkmn contributors / npm | Accessed 2026-07-04 | Package docs | High | Useful for parsing protocol, tracking battle state, formatting logs, and building UI responses. |
| S6 | `@pkmn/engine` docs | https://pkmn-engine.mintlify.app/ | pkmn contributors | Generated 2026-03-30; accessed 2026-07-04 | Project docs | Medium-high | Browser/WASM works, but generation support docs say Stage 1 Gen I/II is in progress and TypeScript API currently points to Gen I. |
| S7 | PokeAPI v2 docs | https://pokeapi.co/docs/v2 | PokeAPI | Accessed 2026-07-04 | API docs | High for API behavior | No auth; no rate limit, though request frequency should be limited. Move endpoint includes accuracy, PP, priority, power, damage class, etc. |
| S8 | PokeAPI data/sprite licensing references | https://github.com/PokeAPI/api-data / https://github.com/PokeAPI/sprites | PokeAPI | Accessed 2026-07-04 | Open-source repos | Medium | API data repo is BSD-3-Clause. Sprite repo is accessible but image copyright remains a separate Pokemon IP concern. |
| S9 | Bulbapedia battle mechanics pages | https://bulbapedia.bulbagarden.net/wiki/Damage / https://bulbapedia.bulbagarden.net/wiki/Priority / https://bulbapedia.bulbagarden.net/wiki/Stat | Bulbapedia community | Damage page last edited 2026-06-24; accessed 2026-07-04 | Community encyclopedia | Medium | Useful for human-readable mechanics notes; do not treat as primary implementation source where simulator code exists. |
| S10 | Pokemon.com legal pages | https://www.pokemon.com/us/legal/copyright / https://www.pokemon.com/us/legal/terms-of-use / https://www.pokemon.com/us/legal/information | The Pokemon Company International | Access blocked by Incapsula; snippets accessed 2026-07-04 | Official legal pages | High, but page body not accessible in browser tool | Search snippets indicate Pokemon.com content is copyrighted and fan-art/IP use is limited. Treat as a risk signal; not legal advice. |

## Key Findings

### 1. Core battle rules should not be hand-rolled

Pokemon battle resolution is a large rules engine, not a small damage formula. Even a simple single battle touches priority, Speed tie randomness, accuracy/evasion, type effectiveness, STAB, critical hits, major statuses, volatile statuses, switching, fainting, PP, secondary effects, abilities, items, weather, field effects, and generation differences.

Pokemon Showdown already implements a battle simulator and exposes a stream/protocol model for choices and battle updates (S1, S3). The protocol separates "what happened" from "how the UI displays it", which fits our browser game well.

Practical judgment: our implementation should treat the simulator as the source of truth, then build a UI layer that translates simulator requests into human choices.

### 2. Best browser engine choice: `@pkmn/sim`

Options considered:

| Option | Pros | Cons | Recommendation |
|---|---|---|---|
| Hand-rolled TypeScript rules | Full control, small initial bundle | Edge cases explode quickly; correctness risk high | Avoid for core rules. Only use for a deliberately simplified "Pokemon-like" clone. |
| `pokemon-showdown` upstream npm | Canonical simulator, all gens | Its docs say Node API currently works in Node, not browsers | Good reference, not first browser runtime choice. |
| `@pkmn/sim` | Browser-usable extraction of Showdown sim; gens 1-9; typed; MIT | Bundle size and package integration need testing; formats are curated | Default choice. |
| `@pkmn/engine` | Fast, browser/WASM, clean API | Modern gens are not ready; current TS examples use Gen I | Use only for Gen I/II retro scope. |

Implementation implication:

- Use `@pkmn/sim` for battle execution.
- Use `@pkmn/protocol` to parse simulator output.
- Use `@pkmn/client` to maintain displayable battle state.
- Use `@pkmn/view` only where it helps with log formatting or choice building.

### 3. Data sources: prefer bundled simulator data first

The first build should avoid runtime dependency on PokeAPI for battle logic. `@pkmn/sim` / `@pkmn/dex` already provide data aligned with the simulator. PokeAPI is useful for supplemental display data, experiments, or importing Pokemon/move metadata, but it is not the battle source of truth.

PokeAPI is consumption-only, requires no auth, and no longer rate-limits, but still asks clients to limit request frequency to reduce hosting cost (S7). If used, cache responses locally and avoid fetching repeatedly during battle.

Sprites/assets need caution:

- PokeAPI sprite repos are convenient, but official Pokemon images/sprites can still be copyrighted Pokemon IP.
- For a local prototype, we can use text, silhouettes, simple generated placeholders, or user-provided assets.
- For a public release, we should not ship official names/logos/sprites/music without permission. Build a data/asset adapter so Pokemon data can be swapped for original creatures later.

### 4. Mechanics scope for MVP

MVP should be a playable single battle, not a full Pokemon clone.

Recommended MVP:

- 1v1 singles.
- Two fixed teams, 3 or 6 Pokemon each.
- Move selection, switching, fainting, win/loss.
- Battle log.
- HP bars, status display, move PP.
- CPU opponent with random valid choices first, heuristic AI second.
- Deterministic seed support for reproducible tests.
- Desktop and mobile responsive battle layout.

Defer:

- Team builder.
- Online multiplayer.
- Full asset library.
- Inventory/items UI beyond held items handled by simulator.
- Custom campaign/progression.
- Full animation catalog for every move.

### 5. UI architecture

Keep three layers separate:

1. `battle-core`
   - Starts simulator.
   - Sends player choices.
   - Receives chunks/protocol messages.
   - Exposes current request, public battle state, and event log.

2. `battle-presenter`
   - Converts state into UI view models: active Pokemon, HP %, statuses, available moves, switch targets, disabled actions.
   - Converts user button clicks into simulator-compatible choice strings.

3. `battle-ui`
   - React components and CSS animations.
   - No game rule decisions.

This gives us testable rule boundaries and makes future engine swaps possible.

## QA Notes

Source QA:

- Primary technical sources were official project docs and GitHub READMEs for Showdown, pkmn packages, and PokeAPI.
- Bulbapedia was used only for human-readable mechanics framing, not as the implementation authority.
- Pokemon.com legal pages could not be opened due Incapsula, but official URLs and search snippets were checked. Legal claims are kept conservative.

Logic QA:

- The recommendation follows from the browser requirement: upstream Showdown docs say Node-only for its package, while `@pkmn/sim` explicitly targets browser use.
- `@pkmn/engine` would be attractive technically, but its documented generation support blocks it as the default for a modern battle game.
- Because the user asked for a browser game, no server-first architecture is planned for MVP.

## Open Questions For Implementation

- Which generation should the first playable version target? Default recommendation: Gen 9 custom battle via `@pkmn/sim`, unless the user wants a Gen I nostalgic scope.
- Resolved 2026-07-04: the first local/private version should use official Pokemon characters and PokeAPI sprites official-artwork URLs. If distribution or commercial use becomes a goal, replace names/art with original-safe assets first.
- Should the visual style be classic handheld-inspired 2D, modern card-like, or minimal tactical UI?
- Should CPU be casual/random first or strategically competent from the first build?
