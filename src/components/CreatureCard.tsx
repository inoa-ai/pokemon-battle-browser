import { typeColors, typeLabels } from '../data/creatures';
import type { Creature } from '../game/types';
import type { CSSProperties } from 'react';

interface CreatureCardProps {
  creature: Creature;
  selected?: boolean;
  compact?: boolean;
  onClick?: () => void;
}

export function CreatureCard({ creature, selected = false, compact = false, onClick }: CreatureCardProps) {
  return (
    <button
      className={`creature-card ${selected ? 'is-selected' : ''} ${compact ? 'creature-card--compact' : ''}`}
      style={{ '--card-primary': creature.palette.primary, '--card-secondary': creature.palette.secondary } as CSSProperties}
      onClick={onClick}
      type="button"
    >
      <RosterPortrait creature={creature} />
      <div className="creature-card__body">
        <div className="creature-card__heading">
          <div>
            <span>{creature.title}</span>
            <strong>{creature.name}</strong>
          </div>
          <small>{creature.role}</small>
        </div>
        {!compact && <p>{creature.visual}</p>}
        <div className="type-row">
          {creature.types.map((type) => (
            <span key={type} className="type-chip" style={{ backgroundColor: typeColors[type] }}>
              {typeLabels[type]}
            </span>
          ))}
        </div>
      </div>
    </button>
  );
}

export function RosterPortrait({ creature, side = 'front' }: { creature: Creature; side?: 'front' | 'back' }) {
  return (
    <div
      className={`roster-portrait roster-portrait--${side}`}
      style={
        {
          '--portrait-primary': creature.palette.primary,
          '--portrait-secondary': creature.palette.secondary,
      } as CSSProperties
      }
      aria-hidden="true"
    >
      <img className="roster-portrait__image" src={creature.art.imageUrl} alt="" loading="lazy" />
      <div className="roster-portrait__glow" />
    </div>
  );
}
