import { h } from '../dom.js';

// Título + texto livre (mantém as quebras de linha). Vazio vira "—".
export function textBlock(title, text) {
  return h('div', { class: 'bloco-texto' },
    h('h3', {}, title),
    h('p', {}, text?.trim() || '—'),
  );
}
