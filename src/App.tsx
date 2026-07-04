import { RotateCcw, Shuffle, Swords } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { BattleScreen } from './components/BattleScreen';
import { CreatureCard } from './components/CreatureCard';
import { creatures, defaultFoeTeam, defaultPlayerTeam } from './data/creatures';
import { createBattle, randomTeams } from './game/battle';
import type { BattleFxEvent, BattleState } from './game/types';

const MAX_TEAM_SIZE = 3;

export default function App() {
  const [selected, setSelected] = useState<string[]>(defaultPlayerTeam);
  const [foeTeam, setFoeTeam] = useState<string[]>(defaultFoeTeam);
  const [battle, setBattle] = useState<BattleState | null>(null);
  const [fxQueue, setFxQueue] = useState<BattleFxEvent[]>([]);
  const [queuedFinalBattle, setQueuedFinalBattle] = useState<BattleState | null>(null);
  const [view, setView] = useState<'battle' | 'roster'>('roster');

  const canStart = selected.length === MAX_TEAM_SIZE;
  const currentFx = fxQueue[0];
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const toggleCreature = (id: string) => {
    setBattle(null);
    setView('roster');
    setSelected((current) => {
      if (current.includes(id)) return current.filter((entry) => entry !== id);
      if (current.length >= MAX_TEAM_SIZE) return [...current.slice(1), id];
      return [...current, id];
    });
  };

  const startBattle = (playerTeam = selected, opponentTeam = foeTeam) => {
    if (playerTeam.length !== MAX_TEAM_SIZE) return;
    const next = createBattle(playerTeam, opponentTeam);
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
    setSelected(teams.player);
    setFoeTeam(teams.foe);
    startBattle(teams.player, teams.foe);
  };

  const reset = () => {
    startBattle(selected, foeTeam);
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand-button" onClick={() => setView(view === 'battle' ? 'roster' : 'battle')}>
          <Swords size={18} />
          <span>アークライト・クラッシュ</span>
        </button>
        <div className="topbar-actions">
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
              <button className="primary-button" disabled={!canStart} onClick={() => startBattle()}>
                <Swords size={18} />
                バトル開始
              </button>
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
          onOpenRoster={() => setView('roster')}
          onRestart={reset}
        />
      )}
    </main>
  );
}
