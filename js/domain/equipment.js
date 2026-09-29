// Regras de equipamento. O catálogo vem de data/equipment.json (gameData.equipment);
// estas funções só interpretam esses dados.
import { attributeLabel, clamp, formatRequirement, requirementMet } from './rules.js';

const byId = (list, id) => (id ? list.find((item) => item.id === id) ?? null : null);

export const findWeapon = (eq, id) => byId(eq.weapons, id);
export const findWeaponGroup = (eq, id) => byId(eq.weaponGroups, id);
export const findShield = (eq, id) => byId(eq.shields, id);
export const findArmor = (eq, id) => byId(eq.armors, id);
export const findMaterial = (eq, id) => byId(eq.armorMaterials, id);

export function canUseWeapon(weapon, attributes) {
  return requirementMet(weapon.requirement, attributes);
}

// ---------- Redução de dano (RD) ----------
// Categorias em ordem: nenhuma < fixa (1) < d4 < d6 < d8...
const RD_ORDER = [0, null, 4, 6, 8, 10, 12];

function shiftRdCategory(rd, delta) {
  const current = rd.dice === 0 ? 0 : rd.sides;
  const index = clamp(RD_ORDER.indexOf(current) + delta, 0, RD_ORDER.length - 1);
  const sides = RD_ORDER[index];
  if (sides === 0) return { dice: 0, sides: null };
  return { dice: rd.dice || 1, sides };
}

export function formatRd(rd) {
  if (rd.dice === 0) return '0';
  return rd.sides ? `${rd.dice}d${rd.sides}` : String(rd.dice);
}

// Armadura + material + redução de penalidade da classe → valores finais
export function armorProfile(armor, material, penaltyReduction = 0) {
  let rd = { ...armor.rd };
  let penalty = armor.penalty;

  if (material?.rdMultiplier) rd = { ...rd, dice: rd.dice * material.rdMultiplier };
  if (material?.rdCategoryDelta) rd = shiftRdCategory(rd, material.rdCategoryDelta);
  if (material?.penaltyDelta) penalty += material.penaltyDelta;

  return {
    rd,
    penalty: Math.max(0, penalty - penaltyReduction),
    penaltyAttributes: armor.penaltyAttributes ?? [],
    slots: armor.slots,
    halvesDamage: Boolean(material?.halvesDamage),
  };
}

// ---------- Textos de resumo ----------
export function weaponSummary(eq, weapon) {
  const group = findWeaponGroup(eq, weapon.group);
  return [
    group ? attributeLabel(group.attribute) : null,
    weapon.hands === 2 ? '2 mãos' : '1 mão',
    `Dano ${weapon.direct ? 'direto ' : ''}${weapon.damage}`,
    weapon.range,
    weapon.requirement ? `Requer ${formatRequirement(weapon.requirement)}` : null,
    group?.note,
  ].filter(Boolean).join(' · ');
}

export function shieldSummary(shield) {
  return `RD ${formatRd(shield.rd)} · ${shield.slots} fissuras`;
}

export function armorSummary(profile) {
  const attrs = profile.penaltyAttributes.map(attributeLabel).join(' e ');
  return [
    `RD ${formatRd(profile.rd)}`,
    profile.penalty ? `−${profile.penalty} em testes de ${attrs}` : 'Sem penalidade',
    profile.halvesDamage ? 'Dano que passa é reduzido pela metade' : null,
    `${profile.slots} fissuras`,
  ].filter(Boolean).join(' · ');
}

// ---------- Consistência da ficha ----------
// Mantém o equipamento coerente: ids desconhecidos viram "nenhum", arma de 2 mãos
// ocupa a mão secundária, material só com armadura, fissuras dentro do limite.
// Devolve a MESMA ficha se nada mudou.
export function applyEquipmentRules(character, eq) {
  const main = findWeapon(eq, character.mainHand);
  const mainHand = main ? character.mainHand : null;

  const offWeapon = findWeapon(eq, character.offHand);
  const offShield = findShield(eq, character.offHand);
  let offHand = offWeapon || offShield ? character.offHand : null;
  if (main?.hands === 2 || offWeapon?.hands === 2) offHand = null;

  const armorDef = findArmor(eq, character.armor.id);
  const armor = {
    ...character.armor,
    id: armorDef ? character.armor.id : null,
    materialId: armorDef && findMaterial(eq, character.armor.materialId) ? character.armor.materialId : null,
    marked: armorDef ? clamp(character.armor.marked, 0, armorDef.slots) : character.armor.marked,
  };

  const shieldDef = findShield(eq, offHand);
  const shieldMarked = shieldDef ? clamp(character.shield.marked, 0, shieldDef.slots) : character.shield.marked;

  const unchanged = mainHand === character.mainHand
    && offHand === character.offHand
    && armor.id === character.armor.id
    && armor.materialId === character.armor.materialId
    && armor.marked === character.armor.marked
    && shieldMarked === character.shield.marked;
  if (unchanged) return character;

  return { ...character, mainHand, offHand, armor, shield: { ...character.shield, marked: shieldMarked } };
}
