import { h, append } from '../dom.js';
import { counter } from '../components/counter.js';
import {
  ATTRIBUTES, ATTRIBUTE_MIN, ATTRIBUTE_MAX, ATTRIBUTE_POINTS, attributePointsLeft,
} from '../../domain/rules.js';
import { validateAttributes } from '../../domain/validation.js';
import { formatModifier } from '../../core/utils.js';

export const AttributesStep = {
  id: 'atributos',
  title: 'Atributos',

  render(container, { character, update, errors }) {
    // Cópia local: esta etapa é a única que altera os atributos enquanto está aberta
    let attributes = { ...character.attributes };

    const pointsEl = h('p', { class: 'pontos', 'aria-live': 'polite' });

    const counters = ATTRIBUTES.map((attr) => counter({
      label: attr.label,
      hint: attr.hint,
      value: attributes[attr.id],
      min: ATTRIBUTE_MIN,
      max: ATTRIBUTE_MAX,
      format: formatModifier,
      canIncrease: () => attributePointsLeft(attributes) > 0,
      onChange: (value) => {
        attributes = { ...attributes, [attr.id]: value };
        update({ attributes });
        refreshAll();
      },
    }));

    function refreshAll() {
      const left = attributePointsLeft(attributes);
      pointsEl.textContent = `Pontos restantes: ${left} de ${ATTRIBUTE_POINTS}`;
      pointsEl.classList.toggle('pontos--completo', left === 0);
      counters.forEach((c) => c.refresh());
    }

    const errorMessage = errors.points ?? ATTRIBUTES.map((a) => errors[a.id]).find(Boolean);

    refreshAll();
    append(container,
      h('h2', {}, 'Atributos'),
      h('p', {}, `Todos começam em ${ATTRIBUTE_MIN}. Distribua ${ATTRIBUTE_POINTS} pontos; cada atributo vai no máximo a +${ATTRIBUTE_MAX}.`),
      pointsEl,
      errorMessage ? h('p', { class: 'campo__erro', role: 'alert' }, errorMessage) : null,
      h('div', { class: 'contadores' }, counters.map((c) => c.element)),
    );
  },

  validate: validateAttributes,
};
