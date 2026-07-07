import { describe, expect, it } from 'vitest';
import { creatures, typeColors, typeLabels } from '../data/creatures';
import { canChallengeBoss, getBossBattle } from './bosses';
import { battleStatValue, createActiveCreature, createBattle, getActiveMoves, performTurn, randomFoeTeam, statIv, statStageMultiplier } from './battle';
import { effectiveness } from './typeChart';
import type { Stats } from './types';

describe('battle engine', () => {
  const statKeys: Array<keyof Stats> = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];

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

  it('includes expanded popular species and every current evolution option', () => {
    const rosterIds = new Set(creatures.map((creature) => creature.id));
    const newSpecies = ['alakazam', 'machamp', 'lapras', 'arcanine', 'absol'];
    const popularSpecies = [
      'greninja',
      'mimikyu',
      'garchomp',
      'rayquaza',
      'gardevoir',
      'dragapult',
      'tyranitar',
      'bulbasaur',
      'toxtricity',
      'lugia',
      'rowlet',
      'aegislash',
      'chandelure',
      'luxray',
      'decidueye',
      'zoroark',
      'lycanroc',
      'corviknight',
      'flygon',
      'hydreigon',
    ];
    const evolvedOptions = ['raichu', 'vaporeon', 'jolteon', 'flareon', 'espeon', 'umbreon', 'leafeon', 'glaceon', 'sylveon'];

    expect(creatures).toHaveLength(45);
    expect(newSpecies.every((id) => rosterIds.has(id))).toBe(true);
    expect(popularSpecies.every((id) => rosterIds.has(id))).toBe(true);
    expect(rosterIds.has('jirachi')).toBe(true);
    expect(evolvedOptions.every((id) => rosterIds.has(id))).toBe(true);
    expect(creatures.every((creature) => creature.art.imageUrl.endsWith('.png'))).toBe(true);
    expect(typeColors.Rock).toBeTruthy();
    expect(typeLabels.Rock).toBe('いわ');
    expect(typeColors.Fairy).toBeTruthy();
    expect(typeLabels.Fairy).toBe('フェアリー');
  });

  it('assigns and applies individual values for every creature', () => {
    const jirachi = creatures.find((creature) => creature.id === 'jirachi');

    expect(jirachi).toBeTruthy();
    expect(creatures.every((creature) => statKeys.every((stat) => {
      const iv = creature.ivs?.[stat];
      return typeof iv === 'number' && iv >= 0 && iv <= 31;
    }))).toBe(true);
    expect(jirachi?.ivs).toEqual({ hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 });
    expect(statIv(jirachi!, 'hp')).toBe(31);
    expect(battleStatValue(jirachi!, 'hp')).toBe(175);
    expect(battleStatValue(jirachi!, 'spe')).toBe(120);

    const lowIvJirachi = { ...jirachi!, ivs: { ...jirachi!.ivs, hp: 0, spe: 0 } };
    const active = createActiveCreature(lowIvJirachi, 'player', 0);

    expect(statIv(lowIvJirachi, 'hp')).toBe(0);
    expect(battleStatValue(lowIvJirachi, 'hp')).toBe(160);
    expect(battleStatValue(lowIvJirachi, 'spe')).toBe(105);
    expect(active.maxHp).toBe(160);
    expect(statIv({ ...jirachi!, ivs: { hp: 99, atk: -3 } }, 'hp')).toBe(31);
    expect(statIv({ ...jirachi!, ivs: { hp: 99, atk: -3 } }, 'atk')).toBe(0);
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

  it('uses the full Pokemon-style stat stage multiplier range', () => {
    expect(statStageMultiplier(2)).toBe(2);
    expect(statStageMultiplier(6)).toBe(4);
    expect(statStageMultiplier(-6)).toBe(0.25);
    expect(statStageMultiplier(99)).toBe(4);
    expect(statStageMultiplier(-99)).toBe(0.25);
  });

  it('applies visible boost stages from setup moves', () => {
    withFixedRandom(0.5, () => {
      const battle = createBattle(['lucario', 'pikachu', 'venusaur'], ['snorlax', 'gengar', 'mewtwo']);
      const next = performTurn(battle, { kind: 'move', moveId: 'swords-dance' });

      expect(next.playerTeam[0].boosts.atk).toBe(2);
      expect(next.fx.some((event) => event.kind === 'boost' && event.text === '攻+2')).toBe(true);
      expect(next.log.some((entry) => entry.text.includes('攻撃がぐーんと上がった'))).toBe(true);
    });
  });

  it('applies guaranteed damaging-move debuffs with their stage amount', () => {
    withFixedRandom(0.5, () => {
      const battle = createBattle(
        [{ creatureId: 'venusaur', moveIds: ['acid-spray', 'energy-ball', 'protect', 'work-up'] }],
        ['blastoise', 'gengar', 'mewtwo'],
      );
      const next = performTurn(battle, { kind: 'move', moveId: 'acid-spray' });

      expect(next.foeTeam[0].boosts.spd).toBe(-2);
      expect(next.log.some((entry) => entry.text.includes('特防ががくっと下がった'))).toBe(true);
    });
  });

  it('resets stat stages when switching out', () => {
    withFixedRandom(0.5, () => {
      const battle = createBattle(['pikachu', 'charizard', 'venusaur'], ['blastoise', 'gengar', 'mewtwo']);
      battle.playerTeam[0].boosts.spa = 4;
      const next = performTurn(battle, { kind: 'switch', targetIndex: 1 });

      expect(next.playerTeam[0].boosts).toEqual({});
      expect(next.playerActive).toBe(1);
    });
  });

  it('prevents damage when the target is immune', () => {
    const battle = createBattle(['snorlax', 'pikachu', 'eevee'], ['gengar', 'mewtwo', 'charizard']);
    const before = battle.foeTeam[0].hp;
    const next = performTurn(battle, { kind: 'move', moveId: 'body-slam' });

    expect(next.foeTeam[0].hp).toBe(before);
    expect(next.log.some((entry) => entry.text.includes('効果がないようだ'))).toBe(true);
  });

  it('applies Rock defensive matchups for newly added Rock creatures', () => {
    expect(effectiveness('Water', ['Rock'])).toBe(2);
    expect(effectiveness('Grass', ['Rock'])).toBe(2);
    expect(effectiveness('Fighting', ['Rock'])).toBe(2);
    expect(effectiveness('Ground', ['Rock'])).toBe(2);
    expect(effectiveness('Steel', ['Rock'])).toBe(2);
    expect(effectiveness('Normal', ['Rock'])).toBe(0.5);
    expect(effectiveness('Fire', ['Rock'])).toBe(0.5);
    expect(effectiveness('Poison', ['Rock'])).toBe(0.5);
    expect(effectiveness('Flying', ['Rock'])).toBe(0.5);
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
