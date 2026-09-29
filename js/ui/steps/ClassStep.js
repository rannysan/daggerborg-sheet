import { h, append } from '../dom.js';
import { classAbilities, classAbilitiesSummary, costLegend } from '../components/classAbilities.js';
import {
  computeVitalsMax, formulaLabel, meetsRequirement, requirementLabel,
} from '../../domain/classes.js';
import { validateClass } from '../../domain/validation.js';
import { formatModifier } from '../../core/utils.js';

// Todas as classes aparecem sempre. As que o personagem ainda não pode escolher
// ficam bloqueadas, mostrando o que falta. A escolhida mostra as habilidades completas.
export const ClassStep = {
  id: 'classe',
  title: 'Classe',

  render(container, { character, update, gameData, errors }) {
    const { attributes, tier } = character;
    let selectedId = character.classId;

    const list = h('div', { class: 'lista-classes', role: 'radiogroup', 'aria-label': 'Classes' });

    const select = (id) => {
      selectedId = id;
      update({ classId: id });
      renderList();
      list.querySelector(`#classe-${id}`)?.focus();
    };

    function renderList() {
      list.replaceChildren(...gameData.classes.map((cls) => classOption(cls, {
        attributes, tier, selected: cls.id === selectedId, onSelect: select,
      })));
    }

    renderList();
    append(container,
      h('h2', {}, 'Classe'),
      h('p', {}, 'Cada classe tem um requisito de atributo. Vida e Estresse são calculados a partir da classe e do seu Vigor.'),
      costLegend(),
      errors.classId ? h('p', { class: 'campo__erro', role: 'alert' }, errors.classId) : null,
      list,
    );
  },

  validate: (character, gameData) => validateClass(character, gameData.classes),
};

function classOption(cls, { attributes, tier, selected, onSelect }) {
  const allowed = meetsRequirement(cls, attributes);
  const vitals = computeVitalsMax(cls, attributes, tier);
  const current = attributes[cls.requirement.attribute];
  const inputId = `classe-${cls.id}`;

  const classes = ['classe-opcao'];
  if (!allowed) classes.push('classe-opcao--bloqueada');

  return h('div', { class: classes.join(' ') },
    h('label', { class: 'classe-opcao__topo', for: inputId },
      h('input', {
        id: inputId,
        type: 'radio',
        name: 'classe',
        value: cls.id,
        checked: selected,
        disabled: !allowed,
        onchange: () => onSelect(cls.id),
      }),
      h('span', { class: 'classe-opcao__nome' }, cls.name),
      h('span', { class: 'classe-opcao__req' }, `Requisito: ${requirementLabel(cls)}`),
    ),
    allowed
      ? null
      : h('p', { class: 'classe-opcao__aviso' },
          `🔒 Para liberar: ${requirementLabel(cls)} (você tem ${formatModifier(current)}).`),
    h('div', { class: 'classe-opcao__vitais' },
      h('span', { title: `PV = ${formulaLabel(cls.hp)}` }, `Vida ${vitals.hp}`),
      h('span', { title: `Estresse = ${formulaLabel(cls.stress)}` }, `Estresse ${vitals.stress}`),
    ),
    selected
      ? classAbilities(cls, { tier })
      : [
          classAbilitiesSummary(cls, { tier }),
          h('details', { class: 'classe-opcao__detalhes' },
            h('summary', {}, 'Ver habilidades completas'),
            classAbilities(cls, { tier }),
          ),
        ],
  );
}
