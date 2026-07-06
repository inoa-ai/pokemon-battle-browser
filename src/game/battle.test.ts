import { describe, expect, it } from 'vitest';
import { creatures, typeColors, typeLabels } from '../data/creatures';
import { createBattle, performTurn, randomFoeTeam } from './battle';

describe('battle engine', () => {
  const withFixedRandom = <T>(value: number, run: () => T): T => {
    const originalRandom = Math.random;
    Math.random = () => value;
    try {
      return run();
    } finally {
      Math.random = originalRandom;
    }
  };

  it('starts with active creatures and a playable turn', () => {
    const battle = createBattle(['pikachu', 'charizard', 'venusaur'], ['blastoise', 'gengar', 'mewtwo']);
    expect(battle.phase).toBe('player-turn');
    expect(battle.playerTeam).toHaveLength(3);
    expect(battle.foeTeam).toHaveLength(3);

    const next = performTurn(battle, { kind: 'move', moveId: 'thunderbolt' });
    expect(next.turn).toBeGreaterThanOrEqual(1);
    expect(next.log.length).toBeGreaterThan(battle.log.length);
    expect(next.fx.length).toBeGreaterThan(0);
  });

  it('supports switching as a valid action', () => {
    const battle = createBattle(['pikachu', 'venusaur', 'snorlax'], ['eevee', 'gengar', 'mewtwo']);
    const next = performTurn(battle, { kind: 'switch', targetIndex: 1 });
    expect(next.playerActive).toBe(1);
  });

  it('creates a random foe team from the full roster', () => {
    const foeTeam = randomFoeTeam();
    const rosterIds = new Set(creatures.map((creature) => creature.id));

    expect(foeTeam).toHaveLength(3);
    expect(new Set(foeTeam).size).toBe(3);
    expect(foeTeam.every((id) => rosterIds.has(id))).toBe(true);
  });

  it('includes new species and every current evolution option', () => {
    const rosterIds = new Set(creatures.map((creature) => creature.id));
    const newSpecies = ['alakazam', 'machamp', 'lapras', 'arcanine', 'absol'];
    const evolvedOptions = ['raichu', 'vaporeon', 'jolteon', 'flareon', 'espeon', 'umbreon', 'leafeon', 'glaceon', 'sylveon'];

    expect(creatures).toHaveLength(24);
    expect(newSpecies.every((id) => rosterIds.has(id))).toBe(true);
    expect(evolvedOptions.every((id) => rosterIds.has(id))).toBe(true);
    expect(typeColors.Fairy).toBeTruthy();
    expect(typeLabels.Fairy).toBe('フェアリー');
  });

  it('prevents damage when the target is immune', () => {
    const battle = createBattle(['snorlax', 'pikachu', 'eevee'], ['gengar', 'mewtwo', 'charizard']);
    const before = battle.foeTeam[0].hp;
    const next = performTurn(battle, { kind: 'move', moveId: 'body-slam' });

    expect(next.foeTeam[0].hp).toBe(before);
    expect(next.log.some((entry) => entry.text.includes('効果がないようだ'))).toBe(true);
  });

  it('captures HP snapshots in sync with hit effects', () => {
    withFixedRandom(0.5, () => {
      const battle = createBattle(['pikachu', 'charizard', 'venusaur'], ['blastoise', 'gengar', 'mewtwo']);
      const next = performTurn(battle, { kind: 'move', moveId: 'thunderbolt' });
      const moveStart = next.fx.find((event) => event.kind === 'move-start' && event.source === 'player');
      const hit = next.fx.find((event) => event.kind === 'hit' && event.source === 'player');

      expect(moveStart?.state?.foeTeam[0].hp).toBe(battle.foeTeam[0].hp);
      expect(hit?.state?.foeTeam[0].hp).toBeLessThan(battle.foeTeam[0].hp);
    });
  });

  it('keeps Pikachu alive through a full-health Shadow Ball without a critical hit', () => {
    withFixedRandom(0.5, () => {
      const battle = createBattle(['gengar', 'venusaur', 'snorlax'], ['pikachu', 'charizard', 'blastoise']);
      const next = performTurn(battle, { kind: 'move', moveId: 'shadow-ball' });

      expect(next.foeTeam[0].hp).toBeGreaterThan(0);
      expect(next.foeTeam[0].hp).toBeLessThan(next.foeTeam[0].maxHp);
    });
  });

  it('keeps Charizard alive through a full-health Hydro Pump without a critical hit', () => {
    withFixedRandom(0.5, () => {
      const battle = createBattle(['charizard', 'pikachu', 'venusaur'], ['blastoise', 'gengar', 'mewtwo']);
      const next = performTurn(battle, { kind: 'move', moveId: 'air-slash' });

      expect(next.playerTeam[0].hp).toBeGreaterThan(0);
      expect(next.playerTeam[0].hp).toBeLessThan(next.playerTeam[0].maxHp);
    });
  });
});
