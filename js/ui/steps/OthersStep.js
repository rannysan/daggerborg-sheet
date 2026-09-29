import { h, append } from '../dom.js';
import { numberField, textAreaField } from '../components/fields.js';
import { BACKPACK_START, POOL_MAX_LIMIT, setPoolMax } from '../../domain/rules.js';
import { validateOthers } from '../../domain/validation.js';

export const OthersStep = {
  id: 'outros',
  title: 'Outros',

  render(container, { character, update, errors }) {
    append(container,
      h('h2', {}, 'Outros'),
      h('div', { class: 'grade-formulario' },
        h('div', { class: 'ocupa-tudo' },
          textAreaField({
            label: 'Outros',
            hint: 'Itens, anotações, aparência, história...',
            rows: 6,
            value: character.other,
            onInput: (other) => update({ other }),
          }),
        ),
        numberField({
          label: 'Espaço da mochila (suprimentos)',
          hint: `Inicialmente ${BACKPACK_START}. Os suprimentos são marcados na ficha.`,
          value: character.supplies.max,
          min: 1,
          max: POOL_MAX_LIMIT,
          error: errors.backpack,
          onInput: (max) => update((c) => ({ supplies: setPoolMax(c.supplies, max) })),
        }),
      ),
    );
  },

  validate: validateOthers,
};
