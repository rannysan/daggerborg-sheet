// Regras de descanso. Funções puras: recebem a ficha e devolvem uma ficha nova.
import { HOPE_MAX, HOPE_START, clamp, isValidPoolMax } from './rules.js';

export const SHORT_REST_SUPPLY_COST = 1;
export const SHORT_REST_MOVE_COUNT = 2;
const SHORT_REST_HOPE = 2;
const ARMOR_REPAIR = 3;
const SHIELD_REPAIR = 1;

// "arredonda tudo pra cima"
const halfUp = (max) => Math.ceil(max / 2);
const maxOf = (pool) => (isValidPoolMax(pool.max) ? pool.max : pool.current);

// Movimentos do descanso curto (pattern Strategy): cada um sabe se aplicar.
// Para criar um movimento novo, basta adicionar um item nesta lista.
export const SHORT_REST_MOVES = Object.freeze([
  {
    id: 'hp',
    label: 'Curar metade da Vida máxima',
    apply: (c) => ({
      ...c,
      hp: { ...c.hp, current: clamp(c.hp.current + halfUp(maxOf(c.hp)), 0, maxOf(c.hp)) },
    }),
  },
  {
    id: 'stress',
    label: 'Curar metade do Estresse máximo',
    apply: (c) => ({
      ...c,
      stress: { ...c.stress, current: Math.max(0, c.stress.current - halfUp(maxOf(c.stress))) },
    }),
  },
  {
    id: 'armor',
    label: `Consertar ${ARMOR_REPAIR} fissuras da armadura e ${SHIELD_REPAIR} do escudo`,
    apply: (c) => ({
      ...c,
      armor: { ...c.armor, marked: Math.max(0, c.armor.marked - ARMOR_REPAIR) },
      shield: { ...c.shield, marked: Math.max(0, c.shield.marked - SHIELD_REPAIR) },
    }),
  },
  {
    id: 'hope',
    label: `Ganhar ${SHORT_REST_HOPE} Esperanças`,
    apply: (c) => ({ ...c, hope: Math.min(HOPE_MAX, c.hope + SHORT_REST_HOPE) }),
  },
  {
    id: 'ally',
    label: 'Ajudar um aliado (não altera esta ficha)',
    apply: (c) => c,
  },
]);

export function canShortRest(character) {
  return character.supplies.current >= SHORT_REST_SUPPLY_COST;
}

// moveIds: ids escolhidos, pode repetir (ex.: ['hp', 'hp'])
export function shortRest(character, moveIds) {
  if (moveIds.length !== SHORT_REST_MOVE_COUNT) {
    throw new Error(`Escolha ${SHORT_REST_MOVE_COUNT} movimentos.`);
  }
  if (!canShortRest(character)) {
    throw new Error('Você precisa de 1 suprimento para descansar.');
  }

  const afterCost = {
    ...character,
    supplies: { ...character.supplies, current: character.supplies.current - SHORT_REST_SUPPLY_COST },
  };

  return moveIds.reduce((c, id) => {
    const move = SHORT_REST_MOVES.find((m) => m.id === id);
    if (!move) throw new Error(`Movimento desconhecido: ${id}`);
    return move.apply(c);
  }, afterCost);
}

// Entre missões, no Refúgio: cura tudo e fica com 2 Esperanças
export function longRest(character) {
  return {
    ...character,
    hp: { ...character.hp, current: maxOf(character.hp) },
    stress: { ...character.stress, current: 0 },
    armor: { ...character.armor, marked: 0 },
    shield: { ...character.shield, marked: 0 },
    hope: HOPE_START,
    vulnerable: false,
  };
}
