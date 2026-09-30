// Regras do sistema DaggerBorg. Funções puras, sem DOM nem armazenamento.
import { formatModifier } from '../core/utils.js';

export const ATTRIBUTES = Object.freeze([
  { id: 'strength', label: 'Força', hint: 'Esmagar, Erguer, Golpear, Agarrar' },
  { id: 'agility', label: 'Agilidade', hint: 'Defender, Equilibrar, Fugir, Nadar' },
  { id: 'presence', label: 'Presença', hint: 'Perceber, Mirar, Intimidar, Conjurar' },
  { id: 'vigor', label: 'Vigor', hint: 'Suportar Toxinas, Frio, Calor e Queda' },
]);

// Todos os atributos começam em -3; o jogador distribui 13 pontos.
// Cada atributo vai até +3, e UM único atributo pode chegar a +4.
export const ATTRIBUTE_MIN = -3;
export const ATTRIBUTE_MAX = 3;
export const ATTRIBUTE_PEAK = 4;       // valor excepcional
export const ATTRIBUTE_PEAK_COUNT = 1; // quantos atributos podem passar de ATTRIBUTE_MAX
export const ATTRIBUTE_POINTS = 13;

// Rolagem de dualidade (2d12 + atributo): precisa deste total ou mais
export const DUALITY_TARGET = 13;

// Custos das habilidades de classe
export const COSTS = Object.freeze({
  hope: { icon: '⭐', label: 'Esperança' },
  stress: { icon: '💧', label: 'Estresse' },
  action: { icon: '⚡', label: 'Ação' },
});

// Estágio do personagem. Por enquanto só existe o 1º.
export const TIER_START = 1;

// Duas experiências: uma +1 e uma +2
export const EXPERIENCE_BONUSES = Object.freeze([1, 2]);

// Esperança: parte com 2, máximo 4
export const HOPE_START = 2;
export const HOPE_MAX = 4;

// Suprimentos: parte com 2; espaço da mochila começa em 3
export const SUPPLIES_START = 2;
export const BACKPACK_START = 3;

// Fissuras que armaduras e escudos aguentam vêm de data/equipment.json

// Vida e Estresse vêm da classe (classes.js); estes valores valem só sem classe
export const DEFAULT_HP_MAX = 6;
export const DEFAULT_STRESS_MAX = 6;
export const POOL_MAX_LIMIT = 99;

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

// Requisito de atributo (classes, armas mágicas): { attribute: 'presence', min: 1 }
export function requirementMet(requirement, attributes) {
  if (!requirement) return true;
  return (attributes[requirement.attribute] ?? -Infinity) >= requirement.min;
}

export function formatRequirement(requirement) {
  const label = ATTRIBUTES.find((a) => a.id === requirement.attribute)?.label ?? requirement.attribute;
  return `${label} ${formatModifier(requirement.min)} ou maior`;
}

export function attributeLabel(id) {
  return ATTRIBUTES.find((a) => a.id === id)?.label ?? id;
}

export function attributePointsSpent(attributes) {
  return ATTRIBUTES.reduce((sum, { id }) => sum + ((attributes[id] ?? ATTRIBUTE_MIN) - ATTRIBUTE_MIN), 0);
}

export function attributePointsLeft(attributes) {
  return ATTRIBUTE_POINTS - attributePointsSpent(attributes);
}

// Quantos atributos passaram de +3
export function attributesAbovePeakLimit(attributes) {
  return ATTRIBUTES.filter(({ id }) => (attributes[id] ?? ATTRIBUTE_MIN) > ATTRIBUTE_MAX).length;
}

// Maior valor que ESTE atributo pode ter agora: +4 se nenhum outro já passou de +3
export function attributeCap(attributes, id) {
  const others = attributesAbovePeakLimit({ ...attributes, [id]: ATTRIBUTE_MIN });
  return others < ATTRIBUTE_PEAK_COUNT ? ATTRIBUTE_PEAK : ATTRIBUTE_MAX;
}

export function isValidPoolMax(max) {
  return Number.isInteger(max) && max >= 1 && max <= POOL_MAX_LIMIT;
}

// Troca o máximo de um recurso { current, max } mantendo o atual dentro do limite.
// followWhenFull: se estava cheio, continua cheio (útil para Vida).
export function setPoolMax(pool, max, { followWhenFull = false } = {}) {
  if (!isValidPoolMax(max)) return { ...pool, max };
  const wasFull = pool.current >= pool.max || !isValidPoolMax(pool.max);
  const current = followWhenFull && wasFull ? max : clamp(pool.current, 0, max);
  return { current, max };
}

// Trilhas de marcação (fissuras, esperança): clicar na última marcada desmarca ela;
// clicar em outra marca até ela
export function toggleTrack(marked, index) {
  return marked === index + 1 ? index : index + 1;
}
