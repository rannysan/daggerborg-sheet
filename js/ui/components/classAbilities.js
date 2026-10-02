// Lista as habilidades de classe e a passiva, com os ícones de custo
import { h } from '../dom.js';
import { icon } from '../icons.js';
import { COSTS } from '../../domain/rules.js';

// Ícone SVG de cada custo (a cor vem do CSS: .custo--hope etc.)
const COST_ICONS = { hope: 'star', stress: 'droplet', action: 'zap' };

// Ícone de um custo com a cor dele (também usado nos rótulos de Esperança e Estresse da ficha)
export const costIcon = (id) => (COST_ICONS[id]
  ? icon(COST_ICONS[id], { className: `custo__icone custo--${id}` })
  : h('span', {}, COSTS[id]?.icon ?? id));

// ['hope', 'hope', 'stress'] → ★★ 💧 (leitor de tela: "2 Esperança, 1 Estresse")
export function costIcons(cost) {
  const counts = new Map();
  cost.forEach((c) => counts.set(c, (counts.get(c) ?? 0) + 1));

  const label = [...counts].map(([c, n]) => `${n} ${COSTS[c]?.label ?? c}`).join(', ');
  return h('span', { class: 'custo', role: 'img', 'aria-label': label, title: label },
    [...counts].map(([c, n]) => Array.from({ length: n }, () => costIcon(c))),
  );
}

export function costLegend() {
  return h('p', { class: 'legenda' },
    Object.entries(COSTS).map(([id, c]) => h('span', { class: 'legenda__item' }, costIcon(id), c.label)),
  );
}

function abilityLine(ability) {
  return h('li', {},
    h('strong', {}, ability.name),
    h('span', { class: 'habilidade__texto' },
      costIcons(ability.cost),
      ability.trigger ? ` ${ability.trigger}` : '',
      `: ${ability.effect}`,
    ),
  );
}

const abilitiesUpTo = (cls, tier) => (tier ? cls.abilities.filter((a) => a.tier <= tier) : cls.abilities);

// Versão curta: só nomes e custos (para comparar classes lado a lado)
export function classAbilitiesSummary(cls, { tier } = {}) {
  return h('ul', { class: 'habilidades__resumo' },
    abilitiesUpTo(cls, tier).map((a) => h('li', {}, costIcons(a.cost), ` ${a.name}`)),
    h('li', {}, h('span', { class: 'habilidades__passiva' }, 'Passiva:'), ` ${cls.passive.name}`),
  );
}

export function classAbilities(cls, { tier } = {}) {
  const abilities = abilitiesUpTo(cls, tier);
  const { passive } = cls;

  return h('div', { class: 'habilidades' },
    h('h3', { class: 'rotulo' }, 'Habilidades de classe'),
    h('ul', { class: 'habilidades__lista' }, abilities.map(abilityLine)),
    h('h3', { class: 'rotulo' }, 'Habilidade passiva'),
    h('ul', { class: 'habilidades__lista' },
      h('li', {},
        h('strong', {}, passive.name),
        h('span', { class: 'habilidade__texto' }, passive.effect),
        passive.activation
          ? h('span', { class: 'habilidade__texto' },
              costIcons(passive.activation.cost), `: ${passive.activation.effect}`)
          : null,
      ),
    ),
  );
}
