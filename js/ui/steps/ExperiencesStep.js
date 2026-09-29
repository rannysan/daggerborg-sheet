import { h, append } from '../dom.js';
import { textField } from '../components/fields.js';
import { validateExperiences } from '../../domain/validation.js';
import { formatModifier } from '../../core/utils.js';

const PLACEHOLDERS = ['Ex.: Caçador de recompensas', 'Ex.: Cresci nas ruas'];

export const ExperiencesStep = {
  id: 'experiencias',
  title: 'Experiências',

  render(container, { character, update, errors }) {
    append(container,
      h('h2', {}, 'Experiências'),
      h('p', {}, 'Uma palavra, frase curta ou conceito (não muito abstrato). Gaste 1 Esperança depois de uma rolagem para somar o bônus.'),
      h('div', { class: 'grade-formulario' },
        character.experiences.map((experience, i) => textField({
          label: `Experiência ${formatModifier(experience.bonus)}`,
          value: experience.name,
          placeholder: PLACEHOLDERS[i] ?? '',
          error: errors[`experience${i}`],
          onInput: (name) => update((c) => ({
            experiences: c.experiences.map((e, j) => (j === i ? { ...e, name } : e)),
          })),
        })),
      ),
    );
  },

  validate: validateExperiences,
};
