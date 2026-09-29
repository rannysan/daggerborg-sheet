import { h } from '../dom.js';

// Mensagem de "nada aqui" com ação opcional
export function emptyState(message, action = null) {
  return h('div', { class: 'card vazio' },
    h('p', {}, message),
    action ? h('a', { class: 'botao', href: action.href }, action.label) : null,
  );
}
