import { h, append } from '../dom.js';
import { selectField } from '../components/fields.js';
import {
  armorProfile, armorSummary, canUseWeapon, findArmor, findMaterial, findShield,
  findWeapon, shieldSummary, weaponSummary,
} from '../../domain/equipment.js';
import { armorPenaltyReduction, findClass } from '../../domain/classes.js';
import { formatRequirement } from '../../domain/rules.js';
import { validateEquipment } from '../../domain/validation.js';

const NONE = { value: '', label: '— Nenhuma —' };
const toId = (value) => value || null;

export const EquipmentStep = {
  id: 'equipamento',
  title: 'Equipamento',

  render(container, { current, update, gameData, errors }) {
    const eq = gameData.equipment;
    const form = h('div', { class: 'grade-formulario' });

    // Redesenha o formulário (ex.: arma de 2 mãos bloqueia a mão secundária)
    // e devolve o foco para o campo que acabou de mudar
    const change = (name, patch) => {
      update(patch);
      renderForm();
      form.querySelector(`select[name="${name}"]`)?.focus();
    };

    function renderForm() {
      const c = current();
      const cls = findClass(gameData.classes, c.classId);
      const main = findWeapon(eq, c.mainHand);
      const offWeapon = findWeapon(eq, c.offHand);
      const offShield = findShield(eq, c.offHand);
      const armor = findArmor(eq, c.armor.id);
      const material = findMaterial(eq, c.armor.materialId);
      const twoHanded = main?.hands === 2;

      form.replaceChildren(
        selectField({
          name: 'mainHand',
          label: 'Mão principal',
          hint: main ? weaponSummary(eq, main) : 'Escolha uma arma.',
          value: c.mainHand,
          options: [NONE, ...weaponGroups(eq, c.attributes, () => true)],
          error: errors.mainHand,
          onChange: (v) => change('mainHand', { mainHand: toId(v) }),
        }),
        selectField({
          name: 'offHand',
          label: 'Mão secundária',
          hint: twoHanded
            ? `Ocupada: ${main.name} usa as 2 mãos.`
            : offWeapon ? weaponSummary(eq, offWeapon)
            : offShield ? shieldSummary(offShield)
            : 'Escudo ou arma de 1 mão.',
          value: twoHanded ? '' : c.offHand,
          disabled: twoHanded,
          options: [
            NONE,
            { group: 'Escudos', options: eq.shields.map((s) => ({ value: s.id, label: s.name })) },
            ...weaponGroups(eq, c.attributes, (w) => w.hands === 1),
          ],
          error: errors.offHand,
          onChange: (v) => change('offHand', { offHand: toId(v) }),
        }),
        selectField({
          name: 'armor',
          label: 'Armadura',
          hint: armor
            ? armorSummary(armorProfile(armor, material, armorPenaltyReduction(cls)))
            : 'Sem armadura.',
          value: c.armor.id,
          options: [NONE, ...eq.armors.map((a) => ({ value: a.id, label: a.name }))],
          onChange: (v) => change('armor', (s) => ({ armor: { ...s.armor, id: toId(v) } })),
        }),
        selectField({
          name: 'material',
          label: 'Material especial da armadura',
          hint: material ? material.description : 'Cada armadura pode ter só UM material especial.',
          value: c.armor.materialId,
          disabled: !armor,
          options: [{ value: '', label: '— Comum —' }, ...eq.armorMaterials.map((m) => ({ value: m.id, label: m.name }))],
          onChange: (v) => change('material', (s) => ({ armor: { ...s.armor, materialId: toId(v) } })),
        }),
      );
    }

    renderForm();
    append(container,
      h('h2', {}, 'Equipamento'),
      form,
    );
  },

  validate: (character, gameData) => validateEquipment(character, gameData.equipment),
};

// Armas agrupadas por categoria (<optgroup>). Armas cujo requisito não é
// atendido aparecem desabilitadas, com o que falta.
function weaponGroups(eq, attributes, filter) {
  return eq.weaponGroups
    .map((group) => ({
      group: group.name,
      options: eq.weapons
        .filter((w) => w.group === group.id && filter(w))
        .map((w) => {
          const usable = canUseWeapon(w, attributes);
          const hands = w.hands === 2 ? '2 mãos' : '1 mão';
          return {
            value: w.id,
            label: usable
              ? `${w.name} (${hands}, ${w.damage})`
              : `🔒 ${w.name} (${hands}, ${w.damage}) — requer ${formatRequirement(w.requirement)}`,
            disabled: !usable,
          };
        }),
    }))
    .filter((group) => group.options.length > 0);
}
