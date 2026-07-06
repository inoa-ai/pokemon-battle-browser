import type { ElementType } from './types';

const chart: Partial<Record<ElementType, Partial<Record<ElementType, number>>>> = {
  Normal: { Ghost: 0, Steel: 0.5 },
  Fire: { Grass: 2, Ice: 2, Steel: 2, Fire: 0.5, Water: 0.5, Dragon: 0.5, Fairy: 0.5 },
  Water: { Fire: 2, Ground: 2, Water: 0.5, Grass: 0.5, Dragon: 0.5 },
  Electric: { Water: 2, Flying: 2, Electric: 0.5, Grass: 0.5, Dragon: 0.5, Ground: 0 },
  Grass: { Water: 2, Ground: 2, Fire: 0.5, Grass: 0.5, Poison: 0.5, Flying: 0.5, Dragon: 0.5, Steel: 0.5 },
  Ice: { Grass: 2, Ground: 2, Flying: 2, Dragon: 2, Fire: 0.5, Water: 0.5, Ice: 0.5, Steel: 0.5 },
  Fighting: { Normal: 2, Ice: 2, Dark: 2, Steel: 2, Poison: 0.5, Flying: 0.5, Psychic: 0.5, Fairy: 0.5, Ghost: 0 },
  Poison: { Grass: 2, Fairy: 2, Poison: 0.5, Ground: 0.5, Ghost: 0.5, Steel: 0 },
  Ground: { Fire: 2, Electric: 2, Poison: 2, Steel: 2, Grass: 0.5, Flying: 0 },
  Flying: { Grass: 2, Fighting: 2, Electric: 0.5, Steel: 0.5 },
  Psychic: { Fighting: 2, Poison: 2, Psychic: 0.5, Steel: 0.5, Dark: 0 },
  Ghost: { Psychic: 2, Ghost: 2, Dark: 0.5, Normal: 0 },
  Dragon: { Dragon: 2, Steel: 0.5, Fairy: 0 },
  Dark: { Psychic: 2, Ghost: 2, Fighting: 0.5, Dark: 0.5, Fairy: 0.5 },
  Steel: { Ice: 2, Fairy: 2, Steel: 0.5, Fire: 0.5, Water: 0.5, Electric: 0.5 },
  Fairy: { Fighting: 2, Dragon: 2, Dark: 2, Fire: 0.5, Poison: 0.5, Steel: 0.5 },
};

export function effectiveness(attackType: ElementType, defenderTypes: ElementType[]): number {
  return defenderTypes.reduce((total, defenderType) => total * (chart[attackType]?.[defenderType] ?? 1), 1);
}

export function effectivenessTone(multiplier: number): 'super' | 'resist' | 'immune' | 'normal' {
  if (multiplier <= 0) return 'immune';
  if (multiplier >= 1.5) return 'super';
  if (multiplier <= 0.75) return 'resist';
  return 'normal';
}
