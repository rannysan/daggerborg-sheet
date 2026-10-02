// Resultados da rolagem de dualidade (teste de atributo) e seus efeitos na ficha.
// Regras do sistema: 2d12 (Esperança e Medo) + atributo, precisa de 13 ou mais.
import { ATTRIBUTES, DUALITY_TARGET, HOPE_MAX, clamp } from './rules.js';
import { cryptoRandomInt, rollDuality } from './dice.js';

// Vantagem/Desvantagem: cada fonte é 1d6; com várias, vale só o maior dado.
// Vantagens e Desvantagens se compensam (rola só o excedente).
export const EDGE_SIDES = 6;
export const EDGE_MAX_SOURCES = 3;

// Usar uma Experiência depois da rolagem custa 1 Esperança
export const EXPERIENCE_HOPE_COST = 1;

// effect: o que muda na FICHA do jogador (o que é do Mestre fica só no texto)
export const DUALITY_OUTCOMES = Object.freeze({
  critical: {
    title: 'Sucesso Crítico!',
    text: 'Você ganha 1 Esperança e pode recuperar 1 PV e 1 Estresse.',
    effect: { hope: 1, healHp: 1, healStress: 1 },
  },
  'success-hope': {
    title: 'Sucesso com Esperança',
    text: 'Você ganha 1 Esperança.',
    effect: { hope: 1 },
  },
  'success-fear': {
    title: 'Sucesso com Medo',
    text: 'Você consegue, mas o Mestre ganha 1 Medo e o Holofote.',
    effect: null,
  },
  'failure-hope': {
    title: 'Falha com Esperança',
    text: 'Você ganha 1 Esperança, mas o Mestre ganha o Holofote.',
    effect: { hope: 1 },
  },
  'failure-fear': {
    title: 'Falha com Medo',
    text: 'O Mestre ganha 1 Medo e o Holofote.',
    effect: null,
  },
});

// Defesa (Agilidade) é uma rolagem de Reação: não gera Esperança/Medo nem os
// efeitos do crítico — por isso o efeito é aplicado por botão, não automático.
export const REACTION_NOTE = 'Se for uma Reação (ex.: defesa), ignore Esperança, Medo e Holofote. '
  + 'No Sucesso Crítico de uma defesa, você também acerta um ataque livre no inimigo, com dano direto.';

// Modificador do teste: atributo menos a penalidade de armadura (se houver)
export function attributeTestModifier(character, attributeId, armorPenalty = 0) {
  return (character.attributes[attributeId] ?? 0) - armorPenalty;
}

// Teste de atributo completo.
//   edge: { advantage, disadvantage } — número de fontes de cada (0 a 3)
// Resultado: o da rolagem de dualidade + { edge, experiences } e total recalculado.
export function rollAttributeTest(modifier, { advantage = 0, disadvantage = 0 } = {}, random = cryptoRandomInt) {
  const base = rollDuality(modifier, { target: DUALITY_TARGET, random });
  const net = advantage - disadvantage;
  const rolls = Array.from({ length: Math.abs(net) }, () => random(EDGE_SIDES));
  const edge = net === 0 ? null : { net, rolls, value: Math.sign(net) * Math.max(...rolls) };
  return recompute({ ...base, edge, experiences: [] });
}

// Experiência usada depois da rolagem: soma o bônus e recalcula sucesso/falha.
// (Esperança ou Medo e o crítico dependem só dos dados: não mudam.)
export function addExperience(result, experience) {
  return recompute({
    ...result,
    experiences: [...result.experiences, { name: experience.name, bonus: experience.bonus }],
  });
}

// Bônus de habilidade de classe (ex.: Esquiva +1 / +1d6). detail: como saiu o valor.
export function addBonus(result, { name, value, detail = null }) {
  return recompute({ ...result, bonuses: [...(result.bonuses ?? []), { name, value, detail }] });
}

function recompute(result) {
  const experienceBonus = result.experiences.reduce((sum, e) => sum + e.bonus, 0);
  const classBonus = (result.bonuses ?? []).reduce((sum, b) => sum + b.value, 0);
  const total = result.hope + result.fear + result.modifier + (result.edge?.value ?? 0) + experienceBonus + classBonus;
  const success = result.critical || total >= result.target;
  return {
    ...result,
    total,
    success,
    outcome: result.critical ? 'critical' : `${success ? 'success' : 'failure'}-${result.withHope ? 'hope' : 'fear'}`,
  };
}

export function attributeName(id) {
  return ATTRIBUTES.find((a) => a.id === id)?.label ?? id;
}

// Aplica o efeito na ficha (Esperança até o máximo; cura dentro dos limites)
export function applyDualityEffect(character, effect) {
  if (!effect) return character;
  const next = { ...character };
  if (effect.hope) next.hope = Math.min(HOPE_MAX, character.hope + effect.hope);
  if (effect.healHp) {
    next.hp = { ...character.hp, current: clamp(character.hp.current + effect.healHp, 0, character.hp.max) };
  }
  if (effect.healStress) {
    next.stress = { ...character.stress, current: clamp(character.stress.current + effect.healStress, 0, character.stress.max) };
  }
  return next;
}

// O efeito mudaria algo nesta ficha? (ex.: Esperança já no máximo e nada a curar → não)
export function effectChangesCharacter(character, effect) {
  const next = applyDualityEffect(character, effect);
  return next.hope !== character.hope
    || next.hp?.current !== character.hp?.current
    || next.stress?.current !== character.stress?.current;
}
