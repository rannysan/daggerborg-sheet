// Lista as habilidades de classe e a passiva, com os ícones de custo
import { h } from '../dom.js';
import { COSTS } from '../../domain/rules.js';

// ['hope', 'hope', 'stress'] → "⭐⭐ 💧" (leitor de tela: "2 Esperança, 1 Estresse")
export function costIcons(cost) {
  const counts = new Map();
  cost.forEach((c) => counts.set(c, (counts.get(c) ?? 0) + 1));

  const label = [...counts].map(([c, n]) => `${n} ${COSTS[c]?.label ?? c}`).join(', ');
  const icons = [...counts].map(([c, n]) => (COSTS[c]?.icon ?? c).repeat(n)).join(' ');

  return h('span', { class: 'custo', role: 'img', 'aria-label': label, title: label }, icons);
}

export function costLegend() {
  return h('p', { class: 'legenda' },
    Object.values(COSTS).map((c) => `${c.icon} ${c.label}`).join('  ·  '));
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
