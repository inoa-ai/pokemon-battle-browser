# Buff And Debuff Research

Access date: 2026-07-06

## Research Frame

- Topic: Pokemon-style stat buffs/debuffs in the browser battle prototype.
- Goal: make buffs/debuffs mechanically meaningful and visibly understandable for students.
- Scope: modern core-series style stat stages, simplified for the current local battle engine.
- Questions:
  1. What range and multiplier should stat stages use?
  2. What should happen to stat stages on switch?
  3. How should critical hits interact with buffs/debuffs?
  4. How should move secondary stat effects be represented?

## Source Ledger

| ID | Source | URL | Publisher | Updated / Published | Type | Credibility | Notes |
|---|---|---|---|---|---|---|---|
| BD1 | Stat modifier | https://bulbapedia.bulbagarden.net/wiki/Stat_modifier | Bulbapedia | Accessed 2026-07-06 | Community mechanics reference | Medium | Documents the -6 to +6 range, Gen III+ multipliers, switch reset, and critical-hit interactions. |
| BD2 | Stat Stages | https://www.dragonflycave.com/mechanics/stat-stages/ | The Cave of Dragonflies | Accessed 2026-07-06 | Mechanics explainer | Medium | Gives a clear stat-stage formula and message conventions for +1/+2/+3 and -1/-2/-3. |
| BD3 | Critical hit | https://bulbapedia.bulbagarden.net/wiki/Critical_hit | Bulbapedia | Accessed 2026-07-06 | Community mechanics reference | Medium | Confirms modern critical hits ignore attacker negative stages and defender positive stages. |
| BD4 | PokeAPI move docs | https://pokeapi.co/docs/v2#moves-section | PokeAPI | Accessed 2026-07-06 | API docs | High for API fields | Move data exposes `effect_chance`, `stat_changes`, and `stat_chance`, useful for effect probability modeling. |

## Findings

- Non-HP stat stages should run from -6 to +6. For Attack, Defense, Sp. Atk, Sp. Def, and Speed, Gen III+ style multipliers are `2/(2+abs(stage))` for negative stages and `(2+stage)/2` for positive stages. That means +2 is 2x, +6 is 4x, and -6 is 0.25x. [BD1][BD2]
- Stat stages reset when the affected Pokemon switches out, except special mechanics such as Baton Pass. This prototype does not implement Baton Pass, so switching clears the outgoing Pokemon's boosts/debuffs. [BD1][BD2]
- Modern critical hits ignore the attacker's negative Attack/Sp. Atk stages and the defender's positive Defense/Sp. Def stages in damage calculation. Burn still remains a separate modifier. [BD1][BD3]
- Secondary stat effects need explicit chance and target data. PokeAPI exposes fields for move `effect_chance`, `stat_changes`, and `stat_chance`, so the local move data should model at least `statDropChance` and self-targeting secondary buffs where relevant. [BD4]

## Implementation Decisions

- Expanded stat-stage clamps from -3/+3 to -6/+6.
- Added `statStageMultiplier(stage)` using the modern Pokemon-style formula.
- Changed damage calculation so critical hits ignore only the relevant harmful/beneficial stages:
  - Attacker negative offensive stages are ignored.
  - Defender positive defensive stages are ignored.
  - Burn's Attack reduction still applies.
- Reset stat stages when a Pokemon switches out.
- Reworked boost/debuff logging:
  - +1: `上がった`
  - +2: `ぐーんと上がった`
  - +3 or more: `ぐぐーんと上がった`
  - -1: `下がった`
  - -2: `がくっと下がった`
  - -3 or less: `がくーんと下がった`
- Added visible stat-stage chips to HP cards, e.g. `攻+2`, `特防-1`, `速+2`.
- Added `statDropChance` and `statChange` to damage moves so damaging attacks can cause chance-based debuffs or self-buffs.
- Tuned representative moves:
  - Guaranteed drops: Icy Wind, Bulldoze, Acid Spray, Snarl.
  - Chance-based drops: Shadow Ball, Psychic, Energy Ball, Flash Cannon, Moonblast, Crunch, Iron Tail, Aurora Beam.
  - Self-buff attacks: Metal Claw, Meteor Mash.

## Caveats

- Accuracy/evasion stages are still not implemented because the current roster does not use accuracy/evasion moves.
- Abilities such as Contrary, Simple, Clear Body, and Unaware are not implemented yet.
- This remains a simplified local engine, not a full Pokemon simulator. If exact competitive fidelity becomes the goal, move this mechanic boundary to `@pkmn/sim`.
