import { creatures, getCreature, movePoolFor, normalizeMoveIds } from '../data/creatures';
import { effectiveness, effectivenessTone } from './typeChart';
import type { ActiveCreature, BattleChoice, BattleFxEvent, BattleLogEntry, BattleSide, BattleState, CreateBattleOptions, Creature, Move, Stats, StatusName, TeamSelectionInput } from './types';

let nextLogId = 1;
let nextFxId = 1;

const statKeys: Array<keyof Stats> = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
const BATTLE_LEVEL = 50;
const CASUAL_DAMAGE_SCALE = 0.55;
const MIN_BOOST_STAGE = -6;
const MAX_BOOST_STAGE = 6;
const statLabels: Record<keyof Stats, string> = {
  hp: 'HP',
  atk: '攻撃',
  def: '防御',
  spa: '特攻',
  spd: '特防',
  spe: '素早さ',
};

interface BoostApplicationOptions {
  source?: BattleSide;
  move?: Move;
  silentIfNoChange?: boolean;
}

export function createActiveCreature(creature: Creature, side: BattleSide, slot: number, moveIds?: string[], options: { hpMultiplier?: number; isBoss?: boolean } = {}): ActiveCreature {
  const selectedMoveIds = normalizeMoveIds(creature, moveIds);
  const selectedMoves = movePoolFor(creature).filter((move) => selectedMoveIds.includes(move.id));
  const maxHp = Math.round(battleHp(creature.stats.hp) * (options.hpMultiplier ?? 1));
  return {
    uid: `${side}-${slot}-${creature.id}`,
    creatureId: creature.id,
    moveIds: selectedMoveIds,
    hp: maxHp,
    maxHp,
    pp: Object.fromEntries(selectedMoves.map((move) => [move.id, move.maxPp])),
    boosts: {},
    statuses: [],
    isBoss: options.isBoss,
  };
}

export function createBattle(playerIds: TeamSelectionInput[], foeIds: TeamSelectionInput[], options: CreateBattleOptions = {}): BattleState {
  nextLogId = 1;
  nextFxId = 1;
  const playerTeam = playerIds.map((member, index) => {
    const selection = normalizeTeamMember(member);
    return createActiveCreature(getCreature(selection.creatureId), 'player', index, selection.moveIds);
  });
  const foeTeam = foeIds.map((member, index) => {
    const selection = normalizeTeamMember(member);
    const isBoss = options.mode === 'boss' && ((options.bossHpScope ?? 'first') === 'all' || index === 0);
    return createActiveCreature(getCreature(selection.creatureId), 'foe', index, selection.moveIds, { hpMultiplier: isBoss ? options.bossHpMultiplier ?? 3 : 1, isBoss });
  });

  const state: BattleState = {
    phase: 'player-turn',
    mode: options.mode ?? 'standard',
    bossId: options.bossId,
    bossTitle: options.bossTitle,
    bossWinLabel: options.bossWinLabel,
    bossLoseLabel: options.bossLoseLabel,
    turn: 1,
    playerTeam,
    foeTeam,
    playerActive: 0,
    foeActive: 0,
    log: [
      log(`ターン1 - ${getCreature(playerTeam[0].creatureId).name} 対 ${getCreature(foeTeam[0].creatureId).name}`, 'system'),
      log('技を選ぶか、控えと交代してください。', 'neutral'),
    ],
    fx: [],
  };
  pushFx(state, { kind: 'turn', text: 'ターン1' });
  return state;
}

export function getActive(state: BattleState, side: BattleSide): ActiveCreature {
  const team = side === 'player' ? state.playerTeam : state.foeTeam;
  const activeIndex = side === 'player' ? state.playerActive : state.foeActive;
  return team[activeIndex];
}

export function getActiveCreature(state: BattleState, side: BattleSide): Creature {
  return getCreature(getActive(state, side).creatureId);
}

export function getActiveMoves(state: BattleState, side: BattleSide): Move[] {
  const active = getActive(state, side);
  const creature = getActiveCreature(state, side);
  const pool = movePoolFor(creature);
  return active.moveIds.map((id) => pool.find((move) => move.id === id)).filter((move): move is Move => Boolean(move));
}

export function isFainted(active: ActiveCreature): boolean {
  return active.hp <= 0;
}

export function availableSwitches(state: BattleState, side: BattleSide): number[] {
  const activeIndex = side === 'player' ? state.playerActive : state.foeActive;
  const team = side === 'player' ? state.playerTeam : state.foeTeam;
  return team.map((member, index) => ({ member, index })).filter(({ member, index }) => index !== activeIndex && !isFainted(member)).map(({ index }) => index);
}

export function validMoves(state: BattleState, side: BattleSide): Move[] {
  const active = getActive(state, side);
  const taunted = active.statuses.some((status) => status.name === 'taunt');
  return getActiveMoves(state, side).filter((move) => (active.pp[move.id] ?? 0) > 0 && (!taunted || move.category !== 'status'));
}

export function performTurn(state: BattleState, playerChoice: BattleChoice): BattleState {
  if (state.phase === 'finished') return state;
  const working = cloneState(state);
  working.phase = 'animating';
  working.fx = [];

  const foeChoice = chooseFoeAction(working);
  const ordered = orderActions(working, [
    { side: 'player' as const, choice: playerChoice },
    { side: 'foe' as const, choice: foeChoice },
  ]);

  pushLog(working, `ターン${working.turn}`, 'system');
  pushFx(working, { kind: 'turn', text: `ターン${working.turn}` });

  for (const action of ordered) {
    if (battleFinished(working)) break;
    if (isFainted(getActive(working, action.side))) continue;
    resolveChoice(working, action.side, action.choice);
    checkForcedSwitchOrWin(working);
  }

  if (!battleFinished(working)) {
    endOfTurn(working);
    checkForcedSwitchOrWin(working);
  }

  if (!battleFinished(working)) {
    working.turn += 1;
    working.phase = 'player-turn';
    pushLog(working, '行動を選んでください。', 'neutral');
  }

  return working;
}

export function switchPlayer(state: BattleState, targetIndex: number): BattleState {
  return performTurn(state, { kind: 'switch', targetIndex });
}

function chooseFoeAction(state: BattleState): BattleChoice {
  const active = getActive(state, 'foe');
  if (isFainted(active)) {
    const next = availableSwitches(state, 'foe')[0];
    return { kind: 'switch', targetIndex: next ?? state.foeActive };
  }

  const moves = validMoves(state, 'foe');
  if (moves.length === 0) return { kind: 'move', moveId: getActiveMoves(state, 'foe')[0].id };

  const player = getActiveCreature(state, 'player');
  const best = [...moves].sort((a, b) => scoreMove(state, 'foe', b, player) - scoreMove(state, 'foe', a, player))[0];
  return { kind: 'move', moveId: best.id };
}

function scoreMove(state: BattleState, side: BattleSide, move: Move, target: Creature): number {
  if (move.effect.kind === 'boost') {
    const targetSide = move.effect.target === 'opponent' ? other(side) : side;
    const targetActive = getActive(state, targetSide);
    const usefulStages = Object.entries(move.effect.boosts).reduce((total, [stat, delta]) => {
      if (stat === 'hp') return total;
      const key = stat as keyof Stats;
      const before = targetActive.boosts[key] ?? 0;
      const after = clamp(before + delta, MIN_BOOST_STAGE, MAX_BOOST_STAGE);
      return total + Math.abs(after - before);
    }, 0);
    return usefulStages > 0 ? 34 + usefulStages * 16 - state.turn * 1.5 : 8;
  }
  if (move.category === 'status') return move.effect.kind === 'heal' ? 35 : 26;
  return move.power * effectiveness(move.type, target.types) + (move.priority ?? 0) * 12 + move.accuracy * 0.1;
}

function orderActions(state: BattleState, actions: Array<{ side: BattleSide; choice: BattleChoice }>) {
  return [...actions].sort((a, b) => {
    const priorityDiff = actionPriority(state, b) - actionPriority(state, a);
    if (priorityDiff !== 0) return priorityDiff;
    return modifiedStat(state, b.side, 'spe') - modifiedStat(state, a.side, 'spe');
  });
}

function actionPriority(state: BattleState, action: { side: BattleSide; choice: BattleChoice }): number {
  const choice = action.choice;
  if (choice.kind !== 'move') return 6;
  const move = getActiveMoves(state, action.side).find((entry) => entry.id === choice.moveId);
  return move?.priority ?? 0;
}

function resolveChoice(state: BattleState, side: BattleSide, choice: BattleChoice): void {
  if (choice.kind === 'switch') {
    resolveSwitch(state, side, choice.targetIndex);
    return;
  }

  const source = getActive(state, side);
  const creature = getActiveCreature(state, side);
  const moves = getActiveMoves(state, side);
  const move = moves.find((entry) => entry.id === choice.moveId);
  if (!move) {
    pushLog(state, `${creature.name}はその技を使えない。`, side === 'player' ? 'bad' : 'good');
    return;
  }
  if ((source.pp[move.id] ?? 0) <= 0) {
    pushLog(state, `${creature.name}は${move.name}のPPが足りない。`, side === 'player' ? 'bad' : 'good');
    return;
  }

  source.pp[move.id] -= 1;
  const targetSide = other(side);
  const targetCreature = getActiveCreature(state, targetSide);
  pushLog(state, `${creature.name}の${move.name}！`, side === 'player' ? 'good' : 'bad');
  pushFx(state, { kind: 'move-start', source: side, target: targetSide, moveName: move.name, moveType: move.type });
  state.lastAction = { source: side, target: targetSide, moveName: move.name, moveType: move.type };

  if (!hitCheck(state, side, move)) {
    pushLog(state, `${move.name}は外れた！`, side === 'player' ? 'bad' : 'good');
    pushFx(state, { kind: 'miss', source: side, target: targetSide, moveName: move.name, moveType: move.type, text: 'ミス' });
    return;
  }

  switch (move.effect.kind) {
    case 'damage':
      resolveDamageMove(state, side, move, targetCreature);
      break;
    case 'boost':
      {
        const boostTarget = move.effect.target === 'opponent' ? targetSide : side;
        applyBoosts(state, boostTarget, move.effect.boosts, { source: side, move });
      }
      break;
    case 'heal':
      heal(state, side, Math.round(getActive(state, side).maxHp * (move.effect.percent / 100)), `${creature.name}はHPを回復した。`);
      break;
    case 'status':
      applyStatusByMove(state, targetSide, move.effect.status, move.effect.duration ?? 3, move.effect.chance, move);
      break;
    case 'guard':
      applyStatus(state, side, 'guard', move.effect.duration);
      pushLog(state, `${creature.name}は光る守りを構えた。`, side === 'player' ? 'good' : 'bad');
      pushFx(state, { kind: 'status', source: side, target: side, moveName: move.name, moveType: move.type, status: 'guard', text: '防御' });
      break;
    case 'cleanse':
      source.statuses = source.statuses.filter((status) => status.name === 'guard' || status.name === 'focus');
      statKeys.forEach((key) => {
        if ((source.boosts[key] ?? 0) < 0) source.boosts[key] = 0;
      });
      pushLog(state, `${creature.name}は清めの霧に包まれた。`, side === 'player' ? 'good' : 'bad');
      applyBoosts(state, side, { spd: 1 }, { source: side, move });
      pushFx(state, { kind: 'status', source: side, target: side, moveName: move.name, moveType: move.type, text: '浄化' });
      break;
  }
}

function resolveSwitch(state: BattleState, side: BattleSide, targetIndex: number): void {
  const team = side === 'player' ? state.playerTeam : state.foeTeam;
  const activeIndex = side === 'player' ? state.playerActive : state.foeActive;
  if (targetIndex === activeIndex || !team[targetIndex] || isFainted(team[targetIndex])) return;

  resetBoosts(team[activeIndex]);
  if (side === 'player') state.playerActive = targetIndex;
  else state.foeActive = targetIndex;
  const creature = getCreature(team[targetIndex].creatureId);
  pushLog(state, `${side === 'player' ? 'こちらは' : '相手は'}${creature.name}を繰り出した！`, side === 'player' ? 'good' : 'bad');
  pushFx(state, { kind: 'switch', source: side, target: side, text: creature.name });
}

function resolveDamageMove(state: BattleState, side: BattleSide, move: Move, targetCreature: Creature): void {
  const targetSide = other(side);
  const sourceCreature = getActiveCreature(state, side);
  const source = getActive(state, side);
  const target = getActive(state, targetSide);
  const multiplier = effectiveness(move.type, targetCreature.types);
  const tone = effectivenessTone(multiplier);
  const critical = Math.random() < 0.08;
  const attackingStat = move.category === 'physical' ? 'atk' : 'spa';
  const defendingStat = move.category === 'physical' ? 'def' : 'spd';
  const attack = modifiedStat(state, side, attackingStat, { critical, role: 'attack' });
  const defense = Math.max(1, modifiedStat(state, targetSide, defendingStat, { critical, role: 'defense' }));
  const sameType = sourceCreature.types.includes(move.type) ? (sourceCreature.id === 'eevee' ? 2 : 1.5) : 1;
  const critBoost = critical ? 1.45 : 1;
  const variance = 0.92 + Math.random() * 0.16;
  const guard = consumeGuard(target);
  const guardMod = guard ? 0.45 : 1;
  const levelFactor = (2 * BATTLE_LEVEL) / 5 + 2;
  const raw = (((levelFactor * move.power * attack) / defense) / 50 + 2) * multiplier * sameType * critBoost * variance * guardMod * CASUAL_DAMAGE_SCALE;
  let damage = multiplier <= 0 ? 0 : Math.max(1, Math.round(raw));

  if (sourceCreature.id === 'charizard' && !source.abilityUsed && source.hp <= source.maxHp / 3 && move.type === 'Fire') {
    damage = Math.round(damage * 1.25);
    source.abilityUsed = true;
    pushLog(state, `${sourceCreature.name}のもうかで炎が強まった！`, side === 'player' ? 'good' : 'bad');
  }
  if (sourceCreature.id === 'blastoise' && !source.abilityUsed && source.hp <= source.maxHp / 3 && move.type === 'Water') {
    damage = Math.round(damage * 1.25);
    source.abilityUsed = true;
    pushLog(state, `${sourceCreature.name}のげきりゅうで水流が強まった！`, side === 'player' ? 'good' : 'bad');
  }
  if (sourceCreature.id === 'venusaur' && !source.abilityUsed && source.hp <= source.maxHp / 3 && move.type === 'Grass') {
    damage = Math.round(damage * 1.25);
    source.abilityUsed = true;
    pushLog(state, `${sourceCreature.name}のしんりょくで草の力が強まった！`, side === 'player' ? 'good' : 'bad');
  }
  if (targetCreature.id === 'dragonite' && target.hp === target.maxHp) {
    damage = Math.max(1, Math.round(damage * 0.5));
    pushLog(state, `${targetCreature.name}のマルチスケイルがダメージを和らげた！`, targetSide === 'player' ? 'good' : 'bad');
  }
  if (targetCreature.id === 'snorlax' && (move.type === 'Fire' || move.type === 'Ice')) {
    damage = Math.max(1, Math.round(damage * 0.5));
    pushLog(state, `${targetCreature.name}のあついしぼうが効いている！`, targetSide === 'player' ? 'good' : 'bad');
  }

  target.hp = Math.max(0, target.hp - damage);
  state.lastAction = { source: side, target: targetSide, moveType: move.type, moveName: move.name, critical, effectiveness: tone };
  if (tone === 'super') pushLog(state, '効果は抜群だ！', side === 'player' ? 'good' : 'bad');
  if (tone === 'resist') pushLog(state, '効果はいまひとつ。', 'neutral');
  if (tone === 'immune') pushLog(state, '効果がないようだ。', 'neutral');
  if (critical) pushLog(state, '急所に当たった！', side === 'player' ? 'good' : 'bad');
  pushFx(state, { kind: 'hit', source: side, target: targetSide, moveName: move.name, moveType: move.type, amount: damage, critical, effectiveness: tone });

  if (move.effect.kind === 'damage' && damage > 0) {
    if (move.effect.drain) heal(state, side, Math.max(1, Math.round(damage * move.effect.drain)), `${sourceCreature.name}は生命力を吸収した。`);
    if (move.effect.burnChance && Math.random() * 100 < move.effect.burnChance) applyStatus(state, targetSide, 'burn', 4);
    if (move.effect.paralyzeChance && Math.random() * 100 < move.effect.paralyzeChance) applyStatus(state, targetSide, 'paralyze', 4);
    if (!isFainted(target) && move.effect.statDrop && Math.random() * 100 < (move.effect.statDropChance ?? 30)) {
      applyBoosts(state, targetSide, move.effect.statDrop, { source: side, move, silentIfNoChange: true });
    }
    if (!isFainted(target) && move.effect.statChange && Math.random() * 100 < (move.effect.statChange.chance ?? 100)) {
      const changeTarget = move.effect.statChange.target === 'self' ? side : targetSide;
      applyBoosts(state, changeTarget, move.effect.statChange.boosts, { source: side, move, silentIfNoChange: true });
    }
  }

  if (targetCreature.id === 'pikachu' && move.category === 'physical' && damage > 0 && !isFainted(target) && Math.random() < 0.25) {
    applyStatus(state, side, 'paralyze', 4);
    pushLog(state, `${targetCreature.name}のせいでんきが発動した！`, targetSide === 'player' ? 'good' : 'bad');
  }

  if (isFainted(target)) {
    pushLog(state, `${targetCreature.name}は倒れた！`, targetSide === 'player' ? 'bad' : 'good');
    pushFx(state, { kind: 'faint', target: targetSide, text: targetCreature.name });
  }
}

function hitCheck(state: BattleState, side: BattleSide, move: Move): boolean {
  let accuracy = move.accuracy;
  if (getActive(state, side).statuses.some((status) => status.name === 'paralyze')) accuracy -= 8;
  return Math.random() * 100 < accuracy;
}

function applyStatusByMove(state: BattleState, targetSide: BattleSide, status: StatusName, duration: number, chance: number, move: Move) {
  if (Math.random() * 100 > chance) {
    pushLog(state, `${move.name}は決まらなかった。`, 'neutral');
    return;
  }
  applyStatus(state, targetSide, status, duration);
}

function applyStatus(state: BattleState, side: BattleSide, status: StatusName, duration: number): void {
  const active = getActive(state, side);
  if (!active.statuses.some((entry) => entry.name === status)) {
    active.statuses.push({ name: status, duration });
  }
  pushLog(state, `${getActiveCreature(state, side).name}は${statusName(status)}状態になった。`, side === 'player' ? 'bad' : 'good');
  pushFx(state, { kind: 'status', target: side, status, text: statusName(status) });
}

function applyBoosts(state: BattleState, side: BattleSide, boosts: Partial<Record<keyof Stats, number>>, options: BoostApplicationOptions = {}): void {
  const active = getActive(state, side);
  const creature = getActiveCreature(state, side);
  const changes: Array<{ stat: keyof Stats; before: number; after: number; delta: number }> = [];
  let capped = false;

  for (const [key, delta] of Object.entries(boosts) as Array<[keyof Stats, number]>) {
    if (key === 'hp') continue;
    const before = active.boosts[key] ?? 0;
    const after = clamp(before + delta, MIN_BOOST_STAGE, MAX_BOOST_STAGE);
    active.boosts[key] = after;
    if (after !== 0) active.boosts[key] = after;
    else delete active.boosts[key];
    if (before !== after) changes.push({ stat: key, before, after, delta: after - before });
    else if (!options.silentIfNoChange) {
      capped = true;
      pushLog(state, `${creature.name}の${statLabels[key]}はこれ以上${delta > 0 ? '上がらない' : '下がらない'}！`, 'neutral');
    }
  }

  if (changes.length === 0) {
    if (!options.silentIfNoChange && !capped) pushLog(state, 'しかし、能力は変化しなかった。', 'neutral');
    return;
  }

  for (const change of changes) {
    pushLog(state, boostMessage(creature.name, change.stat, change.delta), side === 'player' ? 'good' : 'bad');
  }

  pushFx(state, {
    kind: 'boost',
    source: options.source,
    target: side,
    moveName: options.move?.name,
    moveType: options.move?.type,
    text: changes.map((change) => `${statShortLabel(change.stat)}${change.delta > 0 ? '+' : ''}${change.delta}`).join(' / '),
  });
}

function heal(state: BattleState, side: BattleSide, amount: number, message: string): void {
  const active = getActive(state, side);
  const before = active.hp;
  active.hp = Math.min(active.maxHp, active.hp + amount);
  if (active.hp > before) {
    pushLog(state, message, side === 'player' ? 'good' : 'bad');
    pushFx(state, { kind: 'heal', target: side, amount: active.hp - before, text: '回復' });
  }
}

function consumeGuard(active: ActiveCreature): boolean {
  const index = active.statuses.findIndex((status) => status.name === 'guard');
  if (index === -1) return false;
  active.statuses.splice(index, 1);
  return true;
}

function endOfTurn(state: BattleState): void {
  for (const side of ['player', 'foe'] as const) {
    const active = getActive(state, side);
    if (isFainted(active)) continue;

    for (const status of [...active.statuses]) {
      if (status.name === 'burn' || status.name === 'seed') {
        const amount = Math.max(1, Math.round(active.maxHp * (status.name === 'burn' ? 0.07 : 0.09)));
        active.hp = Math.max(0, active.hp - amount);
        pushLog(state, `${getActiveCreature(state, side).name}は${statusName(status.name)}でダメージを受けた。`, side === 'player' ? 'bad' : 'good');
        pushFx(state, { kind: 'status', target: side, status: status.name, amount });
      }
      status.duration -= 1;
    }

    active.statuses = active.statuses.filter((status) => status.duration > 0);
    if (isFainted(active)) {
      pushLog(state, `${getActiveCreature(state, side).name}は倒れた！`, side === 'player' ? 'bad' : 'good');
      pushFx(state, { kind: 'faint', target: side, text: getActiveCreature(state, side).name });
    }
  }
}

function checkForcedSwitchOrWin(state: BattleState): void {
  for (const side of ['player', 'foe'] as const) {
    const team = side === 'player' ? state.playerTeam : state.foeTeam;
    if (team.every(isFainted)) {
      state.phase = 'finished';
      state.winner = other(side);
      pushLog(state, other(side) === 'player' ? '勝利！アリーナを制覇した。' : '敗北。チームが全滅した。', other(side) === 'player' ? 'good' : 'bad');
      pushFx(state, { kind: 'win', target: other(side), text: other(side) === 'player' ? '勝利' : '敗北' });
      return;
    }

    if (isFainted(getActive(state, side))) {
      const next = availableSwitches(state, side)[0];
      if (typeof next === 'number') resolveSwitch(state, side, next);
    }
  }
}

function modifiedStat(state: BattleState, side: BattleSide, stat: keyof Stats, options: { critical?: boolean; role?: 'attack' | 'defense' } = {}): number {
  const active = getActive(state, side);
  const creature = getActiveCreature(state, side);
  const rawBoost = active.boosts[stat] ?? 0;
  const boost =
    options.critical && options.role === 'attack' && rawBoost < 0 ? 0 :
    options.critical && options.role === 'defense' && rawBoost > 0 ? 0 :
    rawBoost;
  const factor = statStageMultiplier(boost);
  const paralysis = stat === 'spe' && active.statuses.some((status) => status.name === 'paralyze') ? 0.65 : 1;
  const burn = stat === 'atk' && active.statuses.some((status) => status.name === 'burn') ? 0.75 : 1;
  const baseStat = stat === 'hp' ? active.maxHp : battleStat(creature.stats[stat]);
  return Math.round(baseStat * factor * paralysis * burn);
}

export function statStageMultiplier(stage: number): number {
  const clamped = clamp(stage, MIN_BOOST_STAGE, MAX_BOOST_STAGE);
  return clamped >= 0 ? (2 + clamped) / 2 : 2 / (2 + Math.abs(clamped));
}

function resetBoosts(active: ActiveCreature): void {
  active.boosts = {};
}

function boostMessage(creatureName: string, stat: keyof Stats, delta: number): string {
  const label = statLabels[stat];
  if (delta >= 3) return `${creatureName}の${label}がぐぐーんと上がった！`;
  if (delta === 2) return `${creatureName}の${label}がぐーんと上がった！`;
  if (delta === 1) return `${creatureName}の${label}が上がった！`;
  if (delta <= -3) return `${creatureName}の${label}ががくーんと下がった！`;
  if (delta === -2) return `${creatureName}の${label}ががくっと下がった！`;
  return `${creatureName}の${label}が下がった！`;
}

function statShortLabel(stat: keyof Stats): string {
  const labels: Record<keyof Stats, string> = {
    hp: 'HP',
    atk: '攻',
    def: '防',
    spa: '特攻',
    spd: '特防',
    spe: '速',
  };
  return labels[stat];
}

function battleHp(baseHp: number): number {
  return Math.floor(((2 * baseHp + 31) * BATTLE_LEVEL) / 100) + BATTLE_LEVEL + 10;
}

function battleStat(baseStat: number): number {
  return Math.floor(((2 * baseStat + 31) * BATTLE_LEVEL) / 100) + 5;
}

function cloneState(state: BattleState): BattleState {
  return structuredClone(state);
}

function battleFinished(state: BattleState): boolean {
  return state.phase === 'finished';
}

function other(side: BattleSide): BattleSide {
  return side === 'player' ? 'foe' : 'player';
}

function pushLog(state: BattleState, text: string, tone: BattleLogEntry['tone'] = 'neutral'): void {
  state.log.push(log(text, tone));
  state.log = state.log.slice(-80);
}

function log(text: string, tone: BattleLogEntry['tone'] = 'neutral'): BattleLogEntry {
  return { id: nextLogId++, text, tone };
}

function pushFx(state: BattleState, event: Omit<BattleFxEvent, 'id' | 'state'>): void {
  state.fx.push(fx({ ...event, state: snapshotState(state) }));
}

function fx(event: Omit<BattleFxEvent, 'id'>): BattleFxEvent {
  return { id: nextFxId++, ...event };
}

function snapshotState(state: BattleState): BattleState {
  return structuredClone({ ...state, fx: [] });
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function statusName(status: string): string {
  const names: Record<string, string> = {
    burn: '火傷',
    paralyze: '麻痺',
    seed: '根縛り',
    trap: '潮縛り',
    taunt: '挑発',
    guard: '防御',
    focus: '集中',
  };
  return names[status] ?? status;
}

export function randomTeams(): { player: string[]; foe: string[] } {
  const shuffled = shuffle(creatures.map((creature) => creature.id));
  return { player: shuffled.slice(0, 3), foe: randomFoeTeam() };
}

export function randomFoeTeam(): string[] {
  return shuffle(creatures.map((creature) => creature.id)).slice(0, 3);
}

function shuffle<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5);
}

function normalizeTeamMember(member: TeamSelectionInput): { creatureId: string; moveIds?: string[] } {
  if (typeof member === 'string') return { creatureId: member };
  return member;
}
