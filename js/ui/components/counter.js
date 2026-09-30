// Contador − valor + (Vida, Estresse, Suprimentos, Atributos).
// Atualiza o próprio visual sem redesenhar a página (o foco do botão não se perde).
//
// Devolve { element, refresh }: refresh() reavalia os limites, útil quando
// canIncrease depende de outros campos (ex.: pontos de atributo restantes).
import { h } from '../dom.js';
import { clamp } from '../../domain/rules.js';

export function counter({
  label,
  hint,
  value,
  min = 0,
  max,
  format = String,
  canIncrease = () => true,
  onChange,
  readOnly = false,
}) {
  let current = value;

  const valueEl = h('span', { class: 'contador__valor', 'aria-live': 'polite' });
  const minus = h('button', {
    class: 'botao contador__botao', type: 'button', 'aria-label': `Diminuir ${label}`,
    onclick: () => change(current - 1),
  }, '−');
  const plus = h('button', {
    class: 'botao contador__botao', type: 'button', 'aria-label': `Aumentar ${label}`,
    onclick: () => change(current + 1),
  }, '+');

  function refresh() {
    valueEl.textContent = format(current);
    minus.disabled = readOnly || current <= min;
    plus.disabled = readOnly || current >= max || !canIncrease(current);
  }

  function change(next) {
    current = clamp(next, min, max);
    refresh();
    onChange(current);
  }

  refresh();
  const element = h('div', { class: 'contador' },
    h('span', { class: 'contador__rotulo' }, label),
    hint ? h('span', { class: 'contador__dica' }, hint) : null,
    h('div', { class: 'contador__controles' }, minus, valueEl, plus),
  );
  return { element, refresh };
}

// Atalho para recursos { current, max }: mostra "atual / máximo"
export function poolCounter({ label, pool, onChange, readOnly = false }) {
  const max = Number.isInteger(pool.max) ? pool.max : pool.current;
  return counter({
    label,
    value: pool.current,
    max,
    format: (v) => `${v} / ${max}`,
    onChange,
    readOnly,
  }).element;
}
