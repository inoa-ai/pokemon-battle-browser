import type { CreateBattleOptions } from './types';

export type BossBattleId = 'mewtwo-solo' | 'mewtwo-team';

export interface BossBattleDefinition {
  id: BossBattleId;
  buttonLabel: string;
  title: string;
  winLabel: string;
  loseLabel: string;
  team: string[];
  hpMultiplier: number;
  hpScope: NonNullable<CreateBattleOptions['bossHpScope']>;
}

export const bossBattles: BossBattleDefinition[] = [
  {
    id: 'mewtwo-solo',
    buttonLabel: 'ミュウツー撃破',
    title: 'ボス戦: ミュウツー撃破',
    winLabel: 'ミュウツー撃破',
    loseLabel: 'ボスに敗北',
    team: ['mewtwo'],
    hpMultiplier: 3,
    hpScope: 'first',
  },
  {
    id: 'mewtwo-team',
    buttonLabel: 'ボスチーム撃破',
    title: 'ボス戦: ミュウツー・ニンフィア・カイリキー',
    winLabel: 'ボスチーム撃破',
    loseLabel: 'ボスチームに敗北',
    team: ['mewtwo', 'sylveon', 'machamp'],
    hpMultiplier: 1.35,
    hpScope: 'all',
  },
];

export function getBossBattle(id: BossBattleId): BossBattleDefinition {
  const boss = bossBattles.find((entry) => entry.id === id);
  if (!boss) throw new Error(`Unknown boss battle: ${id}`);
  return boss;
}

export function canChallengeBoss(playerTeam: string[], boss: BossBattleDefinition): boolean {
  return !isSameTeamComposition(playerTeam, boss.team);
}

export function isSameTeamComposition(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  const normalizedLeft = [...left].sort();
  const normalizedRight = [...right].sort();
  return normalizedLeft.every((id, index) => id === normalizedRight[index]);
}
