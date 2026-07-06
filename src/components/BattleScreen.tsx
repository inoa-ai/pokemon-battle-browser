import { ArrowLeftRight, RotateCcw, Users } from 'lucide-react';
import type { CSSProperties } from 'react';
import { useEffect, useMemo } from 'react';
import { RosterPortrait } from './CreatureCard';
import { getCreature, typeColors, typeLabels } from '../data/creatures';
import { availableSwitches, getActive, getActiveCreature, getActiveMoves, performTurn, validMoves } from '../game/battle';
import type { ActiveCreature, BattleChoice, BattleFxEvent, BattleSide, BattleState, Creature, Move, StatusName } from '../game/types';

interface BattleScreenProps {
  battle: BattleState;
  currentFx?: BattleFxEvent;
  busy: boolean;
  onBattleChange: (battle: BattleState) => void;
  onFxDone: () => void;
  onUserAction: () => void;
  onOpenRoster: () => void;
  onRestart: () => void;
}

export function BattleScreen({ battle, currentFx, busy, onBattleChange, onFxDone, onUserAction, onOpenRoster, onRestart }: BattleScreenProps) {
  const player = getActive(battle, 'player');
  const foe = getActive(battle, 'foe');
  const playerCreature = getActiveCreature(battle, 'player');
  const foeCreature = getActiveCreature(battle, 'foe');
  const playerMoves = getActiveMoves(battle, 'player');
  const moves = validMoves(battle, 'player');
  const switches = availableSwitches(battle, 'player');
  const latestLogs = battle.log.slice(-8).reverse();

  useEffect(() => {
    if (!currentFx) return;
    const duration = fxDuration(currentFx.kind);
    const timer = window.setTimeout(onFxDone, duration);
    return () => window.clearTimeout(timer);
  }, [currentFx, onFxDone]);

  const stageClass = useMemo(() => {
    const classes = ['battle-stage'];
    if (currentFx?.moveType) classes.push(`fx-type-${currentFx.moveType.toLowerCase()}`);
    if (currentFx?.kind) classes.push(`fx-kind-${currentFx.kind}`);
    if (currentFx?.critical) classes.push('fx-critical');
    if (currentFx?.effectiveness) classes.push(`fx-${currentFx.effectiveness}`);
    return classes.join(' ');
  }, [currentFx]);

  const choose = (choice: BattleChoice) => {
    if (busy || battle.phase === 'finished') return;
    onUserAction();
    onBattleChange(performTurn(battle, choice));
  };

  return (
    <section className="battle-layout">
      <div className="battle-header">
        <div>
          <span>ターン {battle.turn}</span>
          <h1>{playerCreature.name} 対 {foeCreature.name}</h1>
          {battle.mode === 'boss' && <p className="battle-subtitle">ボス戦: ミュウツー撃破</p>}
        </div>
        <div className="battle-header__actions">
          <button className="toolbar-button" onClick={onOpenRoster}>
            <Users size={16} />
            編成
          </button>
          <button className="toolbar-button" onClick={onRestart}>
            <RotateCcw size={16} />
            やり直し
          </button>
        </div>
      </div>

      <div className={stageClass}>
        <div className="battle-bg">
          <div className="arena-ring" />
          <div className="arena-grid" />
        </div>
        <FxLayer event={currentFx} />
        <Battler side="foe" active={foe} creature={foeCreature} currentFx={currentFx} />
        <Battler side="player" active={player} creature={playerCreature} currentFx={currentFx} />
      </div>

      <div className="battle-console">
        <section className="command-panel">
          <div className="panel-title">
            <span>技</span>
            <strong>{busy ? '処理中...' : battle.phase === 'finished' ? 'バトル終了' : '行動を選択'}</strong>
          </div>
          <div className="move-grid">
            {playerMoves.map((move) => (
              <MoveButton
                key={move.id}
                move={move}
                available={moves.some((entry) => entry.id === move.id)}
                pp={player.pp[move.id] ?? 0}
                disabled={busy || battle.phase === 'finished'}
                onClick={() => choose({ kind: 'move', moveId: move.id })}
              />
            ))}
          </div>
          <div className="switch-row">
            {switches.map((index) => {
              const active = battle.playerTeam[index];
              const creature = getCreature(active.creatureId);
              return (
                <button key={active.uid} className="switch-button" disabled={busy} onClick={() => choose({ kind: 'switch', targetIndex: index })}>
                  <ArrowLeftRight size={15} />
                  <span>{creature.name}</span>
                  <small>{Math.ceil((active.hp / active.maxHp) * 100)}%</small>
                </button>
              );
            })}
          </div>
        </section>

        <section className="log-panel">
          <div className="panel-title">
            <span>バトルログ</span>
            <strong>{battle.winner ? (battle.winner === 'player' ? '勝利' : '敗北') : currentFx?.moveName ?? '進行中'}</strong>
          </div>
          <div className="battle-log">
            {latestLogs.map((entry) => (
              <p key={entry.id} className={`log-line log-line--${entry.tone ?? 'neutral'}`}>
                {entry.text}
              </p>
            ))}
          </div>
        </section>
      </div>

      {battle.phase === 'finished' && (
        <div className="result-overlay">
          <div>
            <span>{resultLabel(battle)}</span>
            <h2>{battle.winner === 'player' ? '勝利' : '敗北'}</h2>
            <button className="primary-button" onClick={onRestart}>
              <RotateCcw size={18} />
              再戦
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function resultLabel(battle: BattleState): string {
  if (battle.mode === 'boss') return battle.winner === 'player' ? 'ミュウツー撃破' : 'ボスに敗北';
  return battle.winner === 'player' ? 'アリーナ制覇' : 'チーム全滅';
}

function Battler({ side, active, creature, currentFx }: { side: BattleSide; active: ActiveCreature; creature: Creature; currentFx?: BattleFxEvent }) {
  const isTarget = currentFx?.target === side;
  const isSource = currentFx?.source === side;
  const hpPercent = Math.max(0, Math.round((active.hp / active.maxHp) * 100));
  const battlerClass = [
    'battler',
    `battler--${side}`,
    isSource && currentFx?.kind === 'move-start' ? 'is-acting' : '',
    isTarget && currentFx?.kind === 'hit' ? 'is-hit' : '',
    isTarget && currentFx?.kind === 'faint' ? 'is-fainting' : '',
    active.hp <= 0 ? 'is-down' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={battlerClass}>
      <HpCard side={side} active={active} creature={creature} hpPercent={hpPercent} />
      <div className="sprite-wrap">
        <div className="sprite-shadow" />
        <RosterPortrait creature={creature} side={side === 'player' ? 'back' : 'front'} />
        <StatusOrbit statuses={active.statuses.map((status) => status.name)} />
      </div>
    </div>
  );
}

function HpCard({ side, active, creature, hpPercent }: { side: BattleSide; active: ActiveCreature; creature: Creature; hpPercent: number }) {
  return (
    <div className={`hp-card hp-card--${side}`}>
      <div className="hp-card__top">
        <strong>{creature.name}</strong>
        <span>{creature.role}</span>
      </div>
      <div className="type-row">
        {creature.types.map((type) => (
          <span key={type} className="type-chip type-chip--mini" style={{ backgroundColor: typeColors[type] }}>
            {typeLabels[type]}
          </span>
        ))}
      </div>
      <div className="hp-track">
        <div className={`hp-fill ${hpPercent <= 25 ? 'hp-fill--danger' : hpPercent <= 50 ? 'hp-fill--warn' : ''}`} style={{ width: `${hpPercent}%` }} />
      </div>
      <div className="hp-card__bottom">
        <span>{active.hp}/{active.maxHp}</span>
        <StatusText statuses={active.statuses.map((status) => status.name)} />
      </div>
    </div>
  );
}

function MoveButton({ move, pp, available, disabled, onClick }: { move: Move; pp: number; available: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <button
      className="move-button"
      style={{ '--move-color': typeColors[move.type] } as CSSProperties}
      disabled={disabled || !available || pp <= 0}
      onClick={onClick}
    >
      <span className="move-button__type">{typeLabels[move.type]}</span>
      <strong>{move.name}</strong>
      <small>
        {moveCategoryLabel(move.category)} / {move.power || '-'} / PP {pp}
      </small>
      <em>{move.description}</em>
    </button>
  );
}

function FxLayer({ event }: { event?: BattleFxEvent }) {
  if (!event) return <div className="battle-fx-layer" />;
  const showCast = event.kind === 'move-start';
  const showImpact = event.kind === 'hit';
  const showParticles = showImpact || event.kind === 'miss';
  return (
    <div className="battle-fx-layer" aria-hidden="true">
      {(showCast || showImpact) && <div className={`fx-burst fx-burst--${event.moveType?.toLowerCase() ?? 'neutral'} fx-burst--${event.kind}`} />}
      {showImpact && <div className="fx-rings" />}
      {showImpact && <div className="fx-speedlines" />}
      {showParticles && (
        <div className="fx-particles">
          {Array.from({ length: 18 }).map((_, index) => (
            <span key={index} style={{ '--i': index } as CSSProperties} />
          ))}
        </div>
      )}
      {event.text && <div className={`fx-callout fx-callout--${event.kind}`}>{event.text}</div>}
      {event.moveName && <div className="fx-move-name">{event.moveName}</div>}
    </div>
  );
}

function fxDuration(kind: BattleFxEvent['kind']): number {
  const durations: Record<BattleFxEvent['kind'], number> = {
    turn: 260,
    'move-start': 520,
    hit: 620,
    miss: 560,
    switch: 520,
    faint: 720,
    status: 520,
    boost: 520,
    heal: 560,
    win: 1200,
  };
  return durations[kind];
}

function StatusOrbit({ statuses }: { statuses: StatusName[] }) {
  if (!statuses.length) return null;
  return (
    <div className="status-orbit">
      {statuses.slice(0, 3).map((status) => (
        <span key={status} className={`status-dot status-dot--${status}`} />
      ))}
    </div>
  );
}

function StatusText({ statuses }: { statuses: StatusName[] }) {
  if (!statuses.length) return <span>正常</span>;
  return <span>{statuses.map(statusLabel).join(' / ')}</span>;
}

function moveCategoryLabel(category: Move['category']): string {
  const labels: Record<Move['category'], string> = {
    physical: '物理',
    special: '特殊',
    status: '補助',
  };
  return labels[category];
}

function statusLabel(status: StatusName): string {
  const labels: Record<StatusName, string> = {
    burn: '火傷',
    paralyze: '麻痺',
    seed: '根縛り',
    trap: '潮縛り',
    taunt: '挑発',
    guard: '防御',
    focus: '集中',
  };
  return labels[status];
}
