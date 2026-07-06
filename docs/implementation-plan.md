# Pokemon Battle Browser Game - Implementation Plan

Created: 2026-07-04

## Goal

Build a browser-playable battle-only Pokemon-style game. The first milestone is a polished local single-player battle: player vs CPU, fixed teams, faithful battle resolution through an existing simulator, and a responsive UI.

## Technical Direction

- App: `Vite + TypeScript + React`
- Battle engine: `@pkmn/sim`
- Protocol/state: `@pkmn/protocol`, `@pkmn/client`
- Optional helpers: `@pkmn/view`, `@pkmn/randoms`, `@pkmn/sets`
- Testing: `Vitest`
- Rendering: DOM/CSS for the first version; no Phaser/Canvas unless animation needs become heavier

Rationale: Pokemon battle rules are mature and edge-case-heavy, so the simulator owns mechanics. The app owns presentation, input, CPU choice policy, and progression.

## Milestone Plan

### M0 - Project Scaffold

- Initialize Vite React TypeScript project.
- Add scripts: `dev`, `build`, `test`, `lint` if lint tooling is added.
- Create source layout:
  - `src/battle/engine`
  - `src/battle/presenter`
  - `src/battle/data`
  - `src/components/battle`
  - `src/styles`
- Add basic README with setup and known IP/asset caution.

Acceptance:

- App boots in browser.
- `npm run build` succeeds.

### M1 - Simulator Spike

- Install `@pkmn/sim`, `@pkmn/protocol`, `@pkmn/client`, and any required pkmn helpers.
- Create a tiny fixed-team battle in code.
- Start battle stream, submit choices, and print parsed protocol logs in the UI.
- Confirm the package bundles in Vite.

Acceptance:

- Browser can start one local battle.
- A turn can be advanced with hardcoded choices.
- Battle logs appear in the page.

### M2 - Battle Engine Adapter

- Implement `BattleSession` wrapper:
  - `startBattle(config)`
  - `choosePlayerAction(choice)`
  - `getCurrentRequest()`
  - `getPublicState()`
  - `getEventLog()`
  - `reset(seed?)`
- Normalize simulator requests into app-level action options.
- Preserve deterministic seeds for replayable tests.

Acceptance:

- Unit tests can drive a battle without React.
- Invalid UI choices are not sent to simulator.
- State updates are emitted after each turn.

### M3 - First Playable UI

- Build battle screen:
  - opponent panel
  - player panel
  - HP bars
  - status badges
  - move menu with PP/type/category
  - switch menu
  - battle log
  - turn/result display
- Add basic animations:
  - move flash
  - hit shake
  - HP bar drain
  - faint fade

Acceptance:

- Player can complete a battle against a CPU.
- UI works at desktop and mobile widths.
- No text overlaps in action buttons or panels.

### M4 - CPU Opponent

- Start with random valid choice.
- Add simple heuristic:
  - prefer damaging moves that can hit
  - prefer type-effective moves if available
  - switch only when forced in MVP
- Keep AI behind an interface so strategy can improve later.

Acceptance:

- CPU chooses automatically after player action.
- Battle never stalls when switching/fainting is required.

### M5 - Data And Content

- Define 2-4 curated teams.
- Decide first-generation target:
  - Default: Gen 9 custom game via `@pkmn/sim`
  - Alternative: Gen 1 if user wants simpler retro mechanics
- Add local team definitions using Showdown team format or structured objects.
- Add asset adapter:
  - Current local/private prototype uses official Pokemon names and locally bundled Pokemon artwork files.
  - The asset layer should remain replaceable for any public/commercial build.

Acceptance:

- User can pick from at least two teams.
- Battle setup is data-driven, not hardcoded in components.

### M6 - Polish And Verification

- Add tests for:
  - battle start
  - move choice
  - switch choice
  - faint/win condition
  - seeded deterministic run
- Run browser smoke test.
- Check mobile layout.
- Add README usage instructions.

Acceptance:

- `npm run build` and `npm run test` pass.
- Browser smoke test confirms playable battle.
- README explains how to start and current limitations.

## Risks And Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| `@pkmn/sim` bundle is large | Slow initial load | Start with Vite build analysis after M1; lazy-load battle engine if needed. |
| Simulator request handling is complex | UI can stall on forced switches/faints | Build adapter tests before polishing UI. |
| Official Pokemon assets/IP | Public release risk | User explicitly selected local/private official Pokemon use on 2026-07-04. Keep asset layer replaceable for public/commercial builds. |
| Gen 9 mechanics complexity | More states to display | MVP UI displays generic protocol log plus core HP/status first. |
| Browser package integration issues | M1 blocker | If `@pkmn/sim` fails in Vite, fallback to Worker or local Node simulation only after reporting tradeoff. |

## First Implementation Checklist

1. Scaffold Vite React TypeScript.
2. Install pkmn packages.
3. Build a simulator spike page with hardcoded teams.
4. Wrap simulator in `BattleSession`.
5. Build playable UI around `BattleSession`.
6. Add CPU heuristic valid choice.
7. Add tests and browser verification.

## Recommended Next Decision

Before coding, decide only this:

- Target first generation: Gen 9 modern default, or Gen 1 retro/simple.
- Visual assets: user selected local/private official Pokemon sprites.

If this project ever moves toward public release, replace official names/art with original-safe assets before distribution.

## Implementation Status - 2026-07-04

Completed first playable battle build:

- App scaffolded with `Vite + TypeScript + React`.
- 24 official Pokemon roster implemented for local/private prototype use, including Pikachu/Eevee evolution options.
- Pokemon artwork is bundled under `public/assets/pokemon-art` so classroom browsers do not depend on external raw image hosts.
- Battle engine implemented locally for MVP: 3v3 teams, move choice, switching, PP, type matchups, HP, statuses, boosts, fainting, CPU actions, win/loss.
- Team loadouts now support selecting four moves per Pokemon from a candidate move pool.
- Boss mode added as a strengthened solo Mewtwo battle and a 3v3 Mewtwo/Sylveon/Machamp boss team battle.
- Boss team battles block the exact same three-creature composition on the player side.
- Rich CSS/SVG-style action effects added: move flash, hit shake, type-colored bursts, particles, HP transitions, faint animation, status orbit, responsive layout.
- Tests added in `src/game/battle.test.ts`.
- Verification passed:
  - `npm run test`
  - `npm run build`
  - `npm audit --json` with zero vulnerabilities
  - Browser smoke test at `http://127.0.0.1:5174/`
  - Mobile viewport check with no horizontal overflow

The earlier simulator recommendation remains useful for a future high-fidelity Pokemon-rules version. The current build uses a lightweight battle engine so the roster and polished effects can be playable immediately.
