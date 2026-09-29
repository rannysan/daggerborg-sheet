// Mantém a ficha coerente com as regras e os dados do jogo (valores derivados,
// limites). Usado pela EditSession a cada alteração.
import { applyClassStats } from './classes.js';
import { applyEquipmentRules } from './equipment.js';

export function normalizeCharacter(character, gameData) {
  return applyEquipmentRules(applyClassStats(character, gameData.classes), gameData.equipment);
}
