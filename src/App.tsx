import { RotateCcw, Shuffle, Swords, Trophy, Volume2, VolumeX } from 'lucide-react';
import type { CSSProperties } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { gameAudio } from './audio/gameAudio';
import { BattleScreen } from './components/BattleScreen';
import { CreatureCard } from './components/CreatureCard';
import { creatures, defaultMoveIds, defaultPlayerTeam, getCreature, movePoolFor, typeColors, typeLabels } from './data/creatures';
import { createBattle, randomFoeTeam, randomTeams } from './game/battle';
import { bossBattles, canChallengeBoss, getBossBattle, type BossBattleDefinition, type BossBattleId } from './game/bosses';
import type { BattleFxEvent, BattleState, Move, TeamMemberSelection } from './game/types';

const MAX_TEAM_SIZE = 3;
type Loadouts = Record<string, string[]>;

export default function App() {
  const [selected, setSelected] = useState<string[]>(defaultPlayerTeam);
  const [loadouts, setLoadouts] = useState<Loadouts>(() => defaultLoadouts(defaultPlayerTeam));
  const [battle, setBattle] = useState<BattleState | null>(null);
  const [fxQueue, setFxQueue] = useState<BattleFxEvent[]>([]);
  const [queuedFinalBattle, setQueuedFinalBattle] = useState<BattleState | null>(null);
  const [view, setView] = useState<'battle' | 'roster'>('roster');
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.localStorage.getItem('pokemon-battle-sound') !== 'off';
  });

  const canStart = selected.length === MAX_TEAM_SIZE && selected.every((id) => selectedMoveIds(id, loadouts).length === 4);
  const currentFx = fxQueue[0];
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const blockedBoss = useMemo(() => bossBattles.find((boss) => canStart && !canChallengeBoss(selected, boss)), [canStart, selected]);

  useEffect(() => {
    gameAudio.setEnabled(soundEnabled);
    window.localStorage.setItem('pokemon-battle-sound', soundEnabled ? 'on' : 'off');
  }, [soundEnabled]);

  useEffect(() => {
    gameAudio.setScene(view === 'battle' && battle ? 'battle' : 'roster');
  }, [battle, view]);

  useEffect(() => {
    if (currentFx) gameAudio.playEvent(currentFx);
  }, [currentFx]);

  const activateAudio = useCallback((sound: 'tap' | 'confirm' | 'back' = 'tap') => {
    if (!soundEnabled) return;
    void gameAudio.unlock().then(() => gameAudio.playUi(sound));
  }, [soundEnabled]);

  const toggleCreature = (id: string) => {
    activateAudio('tap');
    setBattle(null);
    setView('roster');
    setLoadouts((current) => ensureLoadout(current, id));
    setSelected((current) => {
      if (current.includes(id)) return current.filter((entry) => entry !== id);
      if (current.length >= MAX_TEAM_SIZE) return [...current.slice(1), id];
      return [...current, id];
    });
  };

  const chooseMove = (creatureId: string, moveId: string) => {
    activateAudio('tap');
    setLoadouts((current) => {
      const currentIds = selectedMoveIds(creatureId, current);
      if (currentIds.includes(moveId)) {
        return { ...current, [creatureId]: currentIds.filter((id) => id !== moveId) };
      }
      if (currentIds.length >= 4) {
        return { ...current, [creatureId]: [...currentIds.slice(1), moveId] };
      }
      return { ...current, [creatureId]: [...currentIds, moveId] };
    });
  };

  const startBattle = (playerTeam = selected, opponentTeam?: string[], sourceLoadouts = loadouts) => {
    if (!canUseTeam(playerTeam, sourceLoadouts)) return;
    activateAudio('confirm');
    const next = createBattle(toTeamSelection(playerTeam, sourceLoadouts), opponentTeam ?? randomFoeTeam());
    playBattleTimeline(next);
    setView('battle');
  };

  const startBossBattle = (bossId: BossBattleId, playerTeam = selected, sourceLoadouts = loadouts) => {
    if (!canUseTeam(playerTeam, sourceLoadouts)) return;
    const boss = getBossBattle(bossId);
    if (!canChallengeBoss(playerTeam, boss)) {
      setView('roster');
      return;
    }
    activateAudio('confirm');
    const next = createBattle(toTeamSelection(playerTeam, sourceLoadouts), boss.team, {
      mode: 'boss',
      bossId: boss.id,
      bossTitle: boss.title,
      bossWinLabel: boss.winLabel,
      bossLoseLabel: boss.loseLabel,
      bossHpMultiplier: boss.hpMultiplier,
      bossHpScope: boss.hpScope,
    });
    playBattleTimeline(next);
    setView('battle');
  };

  const playBattleTimeline = useCallback((next: BattleState) => {
    const queue = next.fx;
    setQueuedFinalBattle(next);
    setFxQueue(queue);
    setBattle(queue[0]?.state ?? next);
  }, []);

  const advanceFx = useCallback(() => {
    setFxQueue((current) => {
      const remaining = current.slice(1);
      if (remaining[0]?.state) {
        setBattle(remaining[0].state);
      } else {
        setBattle(queuedFinalBattle);
        setQueuedFinalBattle(null);
      }
      return remaining;
    });
  }, [queuedFinalBattle]);

  const randomize = () => {
    const teams = randomTeams();
    const nextLoadouts = defaultLoadouts(teams.player);
    setSelected(teams.player);
    setLoadouts((current) => ({ ...current, ...nextLoadouts }));
    startBattle(teams.player, teams.foe, { ...loadouts, ...nextLoadouts });
  };

  const reset = () => {
    if (battle?.mode === 'boss') startBossBattle((battle.bossId as BossBattleId | undefined) ?? 'mewtwo-solo', selected);
    else startBattle(selected);
  };

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    gameAudio.setEnabled(next);
    if (next) {
      void gameAudio.unlock().then(() => gameAudio.playUi('confirm'));
    }
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <button
          className="brand-button"
          onClick={() => {
            activateAudio('tap');
            setView(view === 'battle' ? 'roster' : 'battle');
          }}
        >
          <Swords size={18} />
          <span>アークライト・クラッシュ</span>
        </button>
        <div className="topbar-actions">
          <button className="icon-button" onClick={toggleSound} title={soundEnabled ? '音をオフにする' : '音をオンにする'} aria-label={soundEnabled ? '音をオフにする' : '音をオンにする'}>
            {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
          <button className="icon-button" onClick={randomize} title="チームをランダムにする">
            <Shuffle size={18} />
          </button>
          <button className="icon-button" onClick={reset} disabled={!battle} title="バトルをやり直す">
            <RotateCcw size={18} />
          </button>
        </div>
      </header>

      {view === 'roster' || !battle ? (
        <section className="roster-page">
          <div className="roster-hero">
            <div className="roster-hero__shade" />
            <div className="pokemon-hero-lineup" aria-hidden="true">
              {creatures.map((creature) => (
                <img key={creature.id} src={creature.art.imageUrl} alt="" />
              ))}
            </div>
            <div className="roster-hero__content">
              <p>公式ポケモン ローカルバトル</p>
              <h1>3体を選択</h1>
              <div className="hero-actions">
                <button className="primary-button" disabled={!canStart} onClick={() => startBattle()}>
                  <Swords size={18} />
                  バトル開始
                </button>
                {bossBattles.map((boss) => (
                  <BossBattleButton key={boss.id} boss={boss} selected={selected} canStart={canStart} onStart={() => startBossBattle(boss.id)} />
                ))}
              </div>
              {blockedBoss && <p className="hero-warning">{blockedBoss.buttonLabel}は同じ3体構成では挑戦できません。</p>}
            </div>
          </div>

          <div className="selection-strip">
            {selected.map((id, index) => {
              const creature = creatures.find((entry) => entry.id === id)!;
              return (
                <span key={id} className="selection-pill">
                  {index + 1}. {creature.name}
                </span>
              );
            })}
            {Array.from({ length: MAX_TEAM_SIZE - selected.length }).map((_, index) => (
              <span key={`empty-${index}`} className="selection-pill selection-pill--empty">
                未選択
              </span>
            ))}
          </div>

          <section className="loadout-panel">
            <div className="panel-title">
              <span>技設定</span>
              <strong>各ポケモンの4技を選択</strong>
            </div>
            <div className="loadout-grid">
              {selected.map((id) => (
                <LoadoutEditor key={id} creatureId={id} selectedMoveIds={selectedMoveIds(id, loadouts)} onToggleMove={chooseMove} />
              ))}
            </div>
          </section>

          <div className="roster-grid">
            {creatures.map((creature) => (
              <CreatureCard
                key={creature.id}
                creature={creature}
                selected={selectedSet.has(creature.id)}
                onClick={() => toggleCreature(creature.id)}
              />
            ))}
          </div>
        </section>
      ) : (
        <BattleScreen
          battle={battle}
          currentFx={currentFx}
          busy={fxQueue.length > 0}
          onBattleChange={playBattleTimeline}
          onFxDone={advanceFx}
          onUserAction={() => activateAudio('tap')}
          onOpenRoster={() => {
            activateAudio('back');
            setView('roster');
          }}
          onRestart={reset}
        />
      )}
    </main>
  );
}

function BossBattleButton({ boss, selected, canStart, onStart }: { boss: BossBattleDefinition; selected: string[]; canStart: boolean; onStart: () => void }) {
  const blocked = canStart && !canChallengeBoss(selected, boss);
  return (
    <button
      className={`toolbar-button boss-button boss-button--${boss.id}`}
      disabled={!canStart || blocked}
      onClick={onStart}
      title={blocked ? '同じ3体構成では挑戦できません' : boss.title}
    >
      <Trophy size={18} />
      {boss.buttonLabel}
    </button>
  );
}

function LoadoutEditor({ creatureId, selectedMoveIds, onToggleMove }: { creatureId: string; selectedMoveIds: string[]; onToggleMove: (creatureId: string, moveId: string) => void }) {
  const creature = getCreature(creatureId);
  const movePool = movePoolFor(creature);
  return (
    <article className="loadout-card" style={{ '--card-primary': creature.palette.primary } as CSSProperties}>
      <div className="loadout-card__head">
        <div>
          <span>{creature.title}</span>
          <strong>{creature.name}</strong>
        </div>
        <em>{selectedMoveIds.length}/4</em>
      </div>
      <div className="loadout-move-grid">
        {movePool.map((move) => (
          <LoadoutMoveButton key={move.id} move={move} selected={selectedMoveIds.includes(move.id)} onClick={() => onToggleMove(creatureId, move.id)} />
        ))}
      </div>
    </article>
  );
}

function LoadoutMoveButton({ move, selected, onClick }: { move: Move; selected: boolean; onClick: () => void }) {
  return (
    <button className={`loadout-move ${selected ? 'is-selected' : ''}`} style={{ '--move-color': typeColors[move.type] } as CSSProperties} onClick={onClick} type="button">
      <span>{typeLabels[move.type]}</span>
      <strong>{move.name}</strong>
      <small>
        {move.category === 'status' ? '補助' : move.category === 'physical' ? '物理' : '特殊'} / {move.power || '-'} / PP {move.maxPp}
      </small>
    </button>
  );
}

function defaultLoadouts(ids: string[]): Loadouts {
  return Object.fromEntries(ids.map((id) => [id, defaultMoveIds(getCreature(id))]));
}

function ensureLoadout(loadouts: Loadouts, creatureId: string): Loadouts {
  if (loadouts[creatureId]?.length) return loadouts;
  return { ...loadouts, [creatureId]: defaultMoveIds(getCreature(creatureId)) };
}

function selectedMoveIds(creatureId: string, loadouts: Loadouts): string[] {
  const creature = getCreature(creatureId);
  return (loadouts[creatureId] ?? defaultMoveIds(creature)).slice(0, 4);
}

function toTeamSelection(ids: string[], loadouts: Loadouts): TeamMemberSelection[] {
  return ids.map((id) => ({ creatureId: id, moveIds: selectedMoveIds(id, loadouts) }));
}

function canUseTeam(ids: string[], loadouts: Loadouts): boolean {
  return ids.length === MAX_TEAM_SIZE && ids.every((id) => selectedMoveIds(id, loadouts).length === 4);
}
