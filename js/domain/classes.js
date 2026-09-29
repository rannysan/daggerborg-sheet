// Regras das classes. A lista de classes vem de data/classes.json (gameData.classes);
// estas funções só interpretam esses dados.
import { formatRequirement, attributeLabel, requirementMet, setPoolMax } from './rules.js';
import { formatModifier } from '../core/utils.js';

export function findClass(classes, classId) {
  return classes.find((cls) => cls.id === classId) ?? null;
}

export function meetsRequirement(cls, attributes) {
  return requirementMet(cls.requirement, attributes);
}

export function requirementLabel(cls) {
  return formatRequirement(cls.requirement);
}

// Redução de penalidade de armadura dada pela classe (ex.: Treinamento com Armadura)
export function armorPenaltyReduction(cls) {
  return cls?.passive?.modifiers?.armorPenaltyReduction ?? 0;
}

// Ex.: PV = Vigor +2 (mínimo 1) +1 por estágio
function applyFormula(formula, attributes, tier) {
  const fromAttribute = Math.max(formula.min, (attributes[formula.attribute] ?? 0) + formula.base);
  return fromAttribute + formula.perTier * tier;
}

export function computeVitalsMax(cls, attributes, tier) {
  return {
    hp: applyFormula(cls.hp, attributes, tier),
    stress: applyFormula(cls.stress, attributes, tier),
  };
}

export function formulaLabel(formula) {
  const attr = attributeLabel(formula.attribute);
  const perTier = formula.perTier ? ` +${formula.perTier} por estágio` : '';
  return `${attr} ${formatModifier(formula.base)} (mínimo ${formula.min})${perTier}`;
}

// Mantém Vida e Estresse máximos de acordo com a classe, os atributos e o estágio.
// Sem classe (ou classe desconhecida), a ficha fica como está.
export function applyClassStats(character, classes) {
  const cls = findClass(classes, character.classId);
  if (!cls) return character;

  const { hp, stress } = computeVitalsMax(cls, character.attributes, character.tier);
  if (hp === character.hp.max && stress === character.stress.max) return character;

  return {
    ...character,
    hp: setPoolMax(character.hp, hp, { followWhenFull: true }),
    stress: setPoolMax(character.stress, stress),
  };
}
