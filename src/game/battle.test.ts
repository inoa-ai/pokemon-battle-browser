import { describe, expect, it } from 'vitest';
import { creatures, typeColors, typeLabels } from '../data/creatures';
import { canChallengeBoss, getBossBattle } from './bosses';
import { createBattle, getActiveMoves, performTurn, randomFoeTeam } from './battle';

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

  it('uses only the selected four moves for a custom loadout', () => {
    const battle = createBattle(
      [{ creatureId: 'pikachu', moveIds: ['tackle', 'protect', 'work-up', 'spark'] }],
      ['blastoise'],
    );
    const moveIds = getActiveMoves(battle, 'player').map((move) => move.id);

    expect(moveIds).toEqual(['tackle', 'protect', 'work-up', 'spark']);
    expect(Object.keys(battle.playerTeam[0].pp).sort()).toEqual([...moveIds].sort());
    expect(battle.playerTeam[0].pp.thunderbolt).toBeUndefined();
  });

  it('does not allow an unselected move to be used', () => {
    const battle = createBattle(
      [{ creatureId: 'pikachu', moveIds: ['tackle', 'protect', 'work-up', 'spark'] }],
      ['blastoise'],
    );
    const before = battle.foeTeam[0].hp;
    const next = performTurn(battle, { kind: 'move', moveId: 'thunderbolt' });

    expect(next.foeTeam[0].hp).toBe(before);
    expect(next.log.some((entry) => entry.text.includes('その技を使えない'))).toBe(true);
  });

  it('creates a boss battle against a strengthened solo Mewtwo', () => {
    const normal = createBattle(['pikachu'], ['mewtwo']);
    const mewtwo = getBossBattle('mewtwo-solo');
    const boss = createBattle(['pikachu', 'charizard', 'venusaur'], mewtwo.team, {
      mode: 'boss',
      bossId: mewtwo.id,
      bossTitle: mewtwo.title,
      bossWinLabel: mewtwo.winLabel,
      bossLoseLabel: mewtwo.loseLabel,
      bossHpMultiplier: mewtwo.hpMultiplier,
      bossHpScope: mewtwo.hpScope,
    });

    expect(boss.mode).toBe('boss');
    expect(boss.bossId).toBe('mewtwo-solo');
    expect(boss.foeTeam).toHaveLength(1);
    expect(boss.foeTeam[0].creatureId).toBe('mewtwo');
    expect(boss.foeTeam[0].isBoss).toBe(true);
    expect(boss.foeTeam[0].maxHp).toBeGreaterThan(normal.foeTeam[0].maxHp);
  });

  it('creates a three-creature boss team led by Mewtwo', () => {
    const teamBoss = getBossBattle('mewtwo-team');
    const normal = createBattle(['pikachu'], teamBoss.team);
    const boss = createBattle(['pikachu', 'charizard', 'venusaur'], teamBoss.team, {
      mode: 'boss',
      bossId: teamBoss.id,
      bossTitle: teamBoss.title,
      bossWinLabel: teamBoss.winLabel,
      bossLoseLabel: teamBoss.loseLabel,
      bossHpMultiplier: teamBoss.hpMultiplier,
      bossHpScope: teamBoss.hpScope,
    });

    expect(boss.mode).toBe('boss');
    expect(boss.bossId).toBe('mewtwo-team');
    expect(boss.foeTeam.map((member) => member.creatureId)).toEqual(['mewtwo', 'sylveon', 'machamp']);
    expect(boss.foeTeam.every((member) => member.isBoss)).toBe(true);
    expect(boss.foeTeam.every((member, index) => member.maxHp > normal.foeTeam[index].maxHp)).toBe(true);
    expect(boss.bossTitle).toContain('ニンフィア');
  });

  it('blocks boss challenges that mirror the boss team composition', () => {
    const teamBoss = getBossBattle('mewtwo-team');

    expect(canChallengeBoss(['mewtwo', 'sylveon', 'machamp'], teamBoss)).toBe(false);
    expect(canChallengeBoss(['machamp', 'mewtwo', 'sylveon'], teamBoss)).toBe(false);
    expect(canChallengeBoss(['mewtwo', 'sylveon', 'pikachu'], teamBoss)).toBe(true);
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
