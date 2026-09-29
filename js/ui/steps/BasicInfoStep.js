import { h, append } from '../dom.js';
import { textField } from '../components/fields.js';
import { portraitPicker } from '../components/portrait.js';
import { validateBasicInfo } from '../../domain/validation.js';

export const BasicInfoStep = {
  id: 'basico',
  title: 'Começando',

  render(container, { character, current, update, images, errors }) {
    append(container,
      h('h2', {}, 'Começando'),
      h('div', { class: 'grade-formulario' },
        h('div', { class: 'ocupa-tudo' },
          portraitPicker({
            value: character.portrait,
            getName: () => current().name,
            onPick: (file) => images.toPortrait(file),
            onChange: (portrait) => update({ portrait }),
          }),
        ),
        textField({
          label: 'Nome',
          value: character.name,
          placeholder: 'Ex.: Widdershin',
          error: errors.name,
          onInput: (name) => update({ name }),
        }),
        textField({
          label: 'Pronomes',
          value: character.pronouns,
          placeholder: 'Ex.: ela/dela',
          onInput: (pronouns) => update({ pronouns }),
        }),
        textField({
          label: 'Jogador(a)',
          value: character.player,
          onInput: (player) => update({ player }),
        }),
      ),
    );
  },

  validate: validateBasicInfo,
};
