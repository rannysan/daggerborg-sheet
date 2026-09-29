// Helpers de DOM.
// h() cria elementos sem innerHTML: textos do usuário viram texto puro,
// o que evita injeção de HTML (XSS) vinda de fichas importadas.
//
//   h('button', { class: 'botao', onclick: salvar }, 'Salvar')
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  // filhos antes das props: <select> precisa das <option> para aceitar `value`
  append(el, ...children);

  for (const [key, value] of Object.entries(props ?? {})) {
    if (value == null || value === false) continue;
    if (key === 'class') {
      el.className = value;
    } else if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key in el) {
      el[key] = value;
    } else {
      el.setAttribute(key, value === true ? '' : value);
    }
  }
  return el;
}

// Igual ao element.append nativo, mas ignora null/false/undefined e achata arrays
// em qualquer profundidade. (O nativo transformaria null no texto "null" e um
// array no texto "[object HTMLDivElement],...".) Use sempre este.
export function append(el, ...children) {
  el.append(...children.flat(Infinity).filter((c) => c != null && c !== false));
  return el;
}

// Mensagem rápida no rodapé da tela
export function showToast(message, duration = 3000) {
  const toast = h('div', { class: 'toast', role: 'status' }, message);
  document.body.append(toast);
  setTimeout(() => toast.remove(), duration);
}
