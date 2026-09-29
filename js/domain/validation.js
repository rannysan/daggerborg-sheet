// Validações por etapa. Cada função devolve um objeto { campo: 'mensagem' };
// objeto vazio significa que está tudo certo.
import {
  ATTRIBUTES, ATTRIBUTE_MIN, ATTRIBUTE_MAX, ATTRIBUTE_POINTS, POOL_MAX_LIMIT,
  attributePointsLeft, formatRequirement, isValidPoolMax,
} from './rules.js';
import { findClass, meetsRequirement, requirementLabel } from './classes.js';
import { canUseWeapon, findWeapon } from './equipment.js';

export function validateBasicInfo(character) {
  const errors = {};
  if (!character.name.trim()) {
    errors.name = 'Dê um nome ao personagem.';
  }
  return errors;
}

export function validateAttributes(character) {
  const errors = {};
  for (const { id } of ATTRIBUTES) {
    const value = character.attributes[id];
    if (!Number.isInteger(value) || value < ATTRIBUTE_MIN || value > ATTRIBUTE_MAX) {
      errors[id] = `Use um valor entre ${ATTRIBUTE_MIN} e +${ATTRIBUTE_MAX}.`;
    }
  }

  const left = attributePointsLeft(character.attributes);
  if (left > 0) errors.points = `Ainda faltam ${left} de ${ATTRIBUTE_POINTS} pontos para distribuir.`;
  if (left < 0) errors.points = `Você passou ${-left} ponto(s) do limite de ${ATTRIBUTE_POINTS}.`;

  return errors;
}

export function validateClass(character, classes) {
  if (!character.classId) return { classId: 'Escolha uma classe.' };

  const cls = findClass(classes, character.classId);
  if (!cls) return { classId: 'Classe não encontrada. Escolha uma da lista.' };

  if (!meetsRequirement(cls, character.attributes)) {
    return { classId: `${cls.name} exige ${requirementLabel(cls)}. Ajuste os atributos ou escolha outra classe.` };
  }
  return {};
}

export function validateEquipment(character, equipment) {
  const errors = {};
  for (const hand of ['mainHand', 'offHand']) {
    const weapon = findWeapon(equipment, character[hand]);
    if (weapon && !canUseWeapon(weapon, character.attributes)) {
      errors[hand] = `${weapon.name} exige ${formatRequirement(weapon.requirement)}; sem isso não funciona.`;
    }
  }
  return errors;
}

export function validateExperiences(character) {
  const errors = {};
  character.experiences.forEach((experience, i) => {
    if (!experience.name.trim()) errors[`experience${i}`] = 'Dê um nome à experiência.';
  });
  return errors;
}

export function validateOthers(character) {
  const errors = {};
  if (!isValidPoolMax(character.supplies.max)) {
    errors.backpack = `Informe um número inteiro entre 1 e ${POOL_MAX_LIMIT}.`;
  }
  return errors;
}

export function hasErrors(errors) {
  return Object.keys(errors).length > 0;
}
