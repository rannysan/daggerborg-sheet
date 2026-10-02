// Ações de classe nas rolagens (ex.: Esquiva, Ataque Poderoso, Expandir).
// Cada classe declara as suas em data/classes.json → rollActions:
//
//   { id, roll: 'attribute' | 'damage', attribute?, weaponAttribute?,
//     name, label, cost?: ['hope', ...], effect: { type, ... } }
//
//   roll 'attribute' + attribute  → aparece no teste daquele atributo
//   roll 'damage' + weaponAttribute → aparece no dano de armas daquele atributo
//                                     (sem weaponAttribute: qualquer arma)
//
// Tipos de efeito:
//   flat      { value }                    soma um número fixo
//   attribute { attribute }                soma o valor de um atributo
//   dice      { dice, maximizeOnCritical? } soma uma rolagem (no crítico: máximo + nova rolagem)
//   area      { extraTargets }             atinge alvos extras com metade do dano
import { COSTS } from './rules.js';
import { cryptoRandomInt, describeRoll, rollCritical, rollDice } from './dice.js';

// Ações disponíveis para uma rolagem. attribute: o do teste ou o da arma.
export function rollActionsFor(cls, { roll, attribute }) {
  return (cls?.rollActions ?? []).filter((action) => {
    if (action.roll !== roll) return false;
    if (roll === 'attribute') return action.attribute === attribute;
    return !action.weaponAttribute || action.weaponAttribute === attribute;
  });
}

const costCounts = (cost = []) => cost.reduce((acc, id) => ({ ...acc, [id]: (acc[id] ?? 0) + 1 }), {});

// "3 Esperança", "1 Estresse" — vazio se não tem custo
export function costText(cost = []) {
  return Object.entries(costCounts(cost)).map(([id, n]) => `${n} ${COSTS[id]?.label ?? id}`).join(' e ');
}

// Tem Esperança/Estresse suficiente? (Estresse agora é recurso: gasta do atual)
export function canAfford(character, cost = []) {
  const { hope = 0, stress = 0 } = costCounts(cost);
  return character.hope >= hope && character.stress.current >= stress;
}

export function payCost(character, cost = []) {
  const { hope = 0, stress = 0 } = costCounts(cost);
  return {
    ...character,
    hope: character.hope - hope,
    stress: { ...character.stress, current: character.stress.current - stress },
  };
}

/**
 * Resolve o efeito de uma ação.
 * @returns {{ value: number, detail: string, area?: { extraTargets: number, detail: string } }}
 */
export function resolveEffect(effect, { character, critical = false, random = cryptoRandomInt }) {
  switch (effect.type) {
    case 'flat':
      return { value: effect.value, detail: `+${effect.value}` };
    case 'attribute': {
      const value = character.attributes[effect.attribute] ?? 0;
      return { value, detail: `${value >= 0 ? '+' : ''}${value}` };
    }
    case 'dice': {
      const roll = effect.maximizeOnCritical && critical
        ? rollCritical(effect.dice, random)
        : rollDice(effect.dice, random);
      return { value: roll.total, detail: describeRoll(roll) };
    }
    case 'area': {
      const roll = rollDice(effect.extraTargets, random);
      return { value: 0, detail: describeRoll(roll), area: { extraTargets: roll.total, detail: describeRoll(roll) } };
    }
    default:
      throw new Error(`Efeito desconhecido: ${effect.type}`);
  }
}
