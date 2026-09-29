// Campos de formulário padronizados (rótulo + dica + input + mensagem de erro)
import { h } from '../dom.js';

let sequence = 0;
const nextId = () => `campo-${++sequence}`;

function wrap(id, { label, hint, error }, control) {
  const describedBy = [];
  if (hint) describedBy.push(`${id}-dica`);
  if (error) {
    describedBy.push(`${id}-erro`);
    control.setAttribute('aria-invalid', 'true');
  }
  if (describedBy.length) control.setAttribute('aria-describedby', describedBy.join(' '));

  return h('div', { class: 'campo' },
    h('label', { for: id }, label),
    hint ? h('span', { id: `${id}-dica`, class: 'campo__dica' }, hint) : null,
    control,
    error ? h('span', { id: `${id}-erro`, class: 'campo__erro' }, error) : null,
  );
}

export function textField({ label, hint, error, value = '', placeholder = '', onInput, maxLength = 100 }) {
  const id = nextId();
  const input = h('input', {
    id, type: 'text', value, placeholder, maxLength,
    oninput: (e) => onInput(e.target.value),
  });
  return wrap(id, { label, hint, error }, input);
}

export function textAreaField({ label, hint, error, value = '', placeholder = '', onInput, rows = 4 }) {
  const id = nextId();
  const textarea = h('textarea', {
    id, value, placeholder, rows,
    oninput: (e) => onInput(e.target.value),
  });
  return wrap(id, { label, hint, error }, textarea);
}

// onInput recebe um número, ou null se o campo estiver vazio
export function numberField({ label, hint, error, value, min, max, onInput }) {
  const id = nextId();
  const input = h('input', {
    id, type: 'number', inputMode: 'numeric', step: 1, min, max,
    value: value ?? '',
    oninput: (e) => onInput(e.target.value === '' ? null : Number(e.target.value)),
  });
  return wrap(id, { label, hint, error }, input);
}

export function checkboxField({ label, hint, checked = false, onChange }) {
  const id = nextId();
  const input = h('input', {
    id, type: 'checkbox', checked,
    onchange: (e) => onChange(e.target.checked),
  });
  if (hint) input.setAttribute('aria-describedby', `${id}-dica`);

  return h('div', { class: 'campo campo--check' },
    h('label', { for: id }, input, label),
    hint ? h('span', { id: `${id}-dica`, class: 'campo__dica' }, hint) : null,
  );
}

// options: [{ value, label, disabled? }] ou grupos [{ group: 'Título', options: [...] }]
// name: opcional, para achar o campo depois (ex.: devolver o foco após redesenhar)
export function selectField({ label, hint, error, value, options, onChange, name, disabled = false }) {
  const id = nextId();
  const option = (o) => h('option', { value: String(o.value), disabled: Boolean(o.disabled) }, o.label);

  const select = h('select', {
    id,
    name,
    disabled,
    value: String(value ?? ''),
    onchange: (e) => onChange(e.target.value),
  }, options.map((o) => (o.group
    ? h('optgroup', { label: o.group }, o.options.map(option))
    : option(o))));
  return wrap(id, { label, hint, error }, select);
}
