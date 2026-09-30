// Trilha de marcadores clicáveis (fissuras da armadura, Esperança).
// shape: 'escudo' | 'circulo'
import { h } from '../dom.js';
import { toggleTrack } from '../../domain/rules.js';

export function pipTrack({ label, itemLabel, slots, marked, shape = 'circulo', onChange, readOnly = false }) {
  let current = marked;

  const buttons = Array.from({ length: slots }, (_, i) => h('button', {
    class: `marcador marcador--${shape}`,
    type: 'button',
    disabled: readOnly,
    'aria-label': `${itemLabel} ${i + 1}`,
    onclick: () => {
      current = toggleTrack(current, i);
      render();
      onChange(current);
    },
  }, h('span', { class: 'marcador__forma' })));

  function render() {
    buttons.forEach((button, i) => button.setAttribute('aria-pressed', String(i < current)));
  }

  render();
  return h('div', { class: 'marcadores', role: 'group', 'aria-label': label }, buttons);
}
