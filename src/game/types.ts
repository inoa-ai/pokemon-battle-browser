export type ElementType =
  | 'Normal'
  | 'Fire'
  | 'Water'
  | 'Electric'
  | 'Grass'
  | 'Ice'
  | 'Fighting'
  | 'Poison'
  | 'Rock'
  | 'Ground'
  | 'Flying'
  | 'Psychic'
  | 'Ghost'
  | 'Dragon'
  | 'Dark'
  | 'Steel'
  | 'Fairy';

export type MoveCategory = 'physical' | 'special' | 'status';
export type BattleSide = 'player' | 'foe';
export type StatusName = 'burn' | 'paralyze' | 'seed' | 'trap' | 'taunt' | 'guard' | 'focus';

export interface Stats {
  hp: number;
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
}

export interface Move {
  id: string;
  name: string;
  type: ElementType;
  category: MoveCategory;
  power: number;
  accuracy: number;
  maxPp: number;
  priority?: number;
  effect:
    | {
        kind: 'damage';
        drain?: number;
        burnChance?: number;
        paralyzeChance?: number;
        statDrop?: Partial<Record<keyof Stats, number>>;
        statDropChance?: number;
        statChange?: {
          boosts: Partial<Record<keyof Stats, number>>;
          target?: 'self' | 'opponent';
          chance?: number;
        };
        recoil?: number;
      }
    | { kind: 'boost'; boosts: Partial<Record<keyof Stats, number>>; target?: 'self' | 'opponent'; selfDamagePercent?: number }
    | { kind: 'heal'; percent: number }
    | { kind: 'status'; status: StatusName; chance: number; duration?: number }
    | { kind: 'guard'; duration: number }
    | { kind: 'cleanse' };
  description: string;
  fx: string;
}

export interface Creature {
  id: string;
  name: string;
  title: string;
  types: ElementType[];
  role: string;
  visual: string;
  stats: Stats;
  ability: string;
  abilityText: string;
  moves: Move[];
  palette: {
    primary: string;
    secondary: string;
    accent: string;
  };
  art: {
    imageUrl: string;
  };
}

export interface ActiveCreature {
  uid: string;
  creatureId: string;
  moveIds: string[];
  hp: number;
  maxHp: number;
  pp: Record<string, number>;
  boosts: Partial<Record<keyof Stats, number>>;
  statuses: Array<{ name: StatusName; duration: number }>;
  abilityUsed?: boolean;
  isBoss?: boolean;
}

export interface BattleLogEntry {
  id: number;
  text: string;
  tone?: 'neutral' | 'good' | 'bad' | 'system';
}

export interface BattleFxEvent {
  id: number;
  state?: BattleState;
  kind:
    | 'move-start'
    | 'hit'
    | 'heal'
    | 'status'
    | 'boost'
    | 'miss'
    | 'switch'
    | 'faint'
    | 'turn'
    | 'win';
  source?: BattleSide;
  target?: BattleSide;
  moveName?: string;
  moveType?: ElementType;
  status?: StatusName;
  amount?: number;
  text?: string;
  critical?: boolean;
  effectiveness?: 'super' | 'resist' | 'immune' | 'normal';
}

export interface BattleState {
  phase: 'selecting' | 'player-turn' | 'animating' | 'finished';
  mode?: 'standard' | 'boss';
  bossId?: string;
  bossTitle?: string;
  bossWinLabel?: string;
  bossLoseLabel?: string;
  turn: number;
  playerTeam: ActiveCreature[];
  foeTeam: ActiveCreature[];
  playerActive: number;
  foeActive: number;
  log: BattleLogEntry[];
  fx: BattleFxEvent[];
  winner?: BattleSide;
  lastAction?: {
    source?: BattleSide;
    target?: BattleSide;
    moveType?: ElementType;
    moveName?: string;
    critical?: boolean;
    effectiveness?: 'super' | 'resist' | 'immune' | 'normal';
  };
}

export interface MoveChoice {
  kind: 'move';
  moveId: string;
}

export interface SwitchChoice {
  kind: 'switch';
  targetIndex: number;
}

export type BattleChoice = MoveChoice | SwitchChoice;

export interface TeamMemberSelection {
  creatureId: string;
  moveIds?: string[];
}

export type TeamSelectionInput = string | TeamMemberSelection;

export interface CreateBattleOptions {
  mode?: BattleState['mode'];
  bossId?: string;
  bossTitle?: string;
  bossWinLabel?: string;
  bossLoseLabel?: string;
  bossHpMultiplier?: number;
  bossHpScope?: 'first' | 'all';
}
