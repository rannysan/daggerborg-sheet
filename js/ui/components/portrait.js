// Retrato do personagem: exibição, seletor (wizard) e botão de troca (ficha)
import { h, showToast } from '../dom.js';
import { icon } from '../icons.js';

// Imagem redonda, ou a inicial do nome quando não há imagem.
// size: 'pequeno' | 'medio' | 'grande'
export function portrait({ portrait: src, name }, { size = 'medio' } = {}) {
  if (src) {
    return h('img', { class: `retrato retrato--${size}`, src, alt: `Retrato de ${name || 'personagem'}` });
  }
  return h('div', { class: `retrato retrato--${size} retrato--vazio`, 'aria-hidden': 'true' },
    (name?.trim()[0] ?? '?').toUpperCase() || '?');
}

// Input de arquivo escondido + tratamento de erro/carregamento, usado pelos dois abaixo
function filePicker({ onPick, onChange, onBusy }) {
  return h('input', {
    type: 'file',
    accept: 'image/*',
    hidden: true,
    onchange: async (e) => {
      const [file] = e.target.files;
      e.target.value = ''; // permite escolher o mesmo arquivo de novo
      if (!file) return;
      onBusy(true);
      try {
        onChange(await onPick(file));
      } catch (erro) {
        showToast(erro.message);
      } finally {
        onBusy(false);
      }
    },
  });
}

// Seletor completo: prévia + "Escolher/Trocar imagem" + "Remover".
// getName(): nome atual (para a inicial quando não há imagem)
export function portraitPicker({ value, getName, onPick, onChange }) {
  let current = value;

  const preview = h('div', { class: 'seletor-retrato__previa' });
  const input = filePicker({
    onPick,
    onChange: (dataUrl) => { current = dataUrl; render(); onChange(current); },
    onBusy: (busy) => { pickButton.disabled = busy; pickButton.textContent = busy ? 'Carregando…' : label(); },
  });
  const label = () => (current ? 'Trocar imagem' : 'Escolher imagem');
  const pickButton = h('button', { class: 'botao botao--secundario botao--pequeno', type: 'button', onclick: () => input.click() });
  const removeButton = h('button', {
    class: 'botao botao--secundario botao--pequeno', type: 'button',
    onclick: () => { current = null; render(); onChange(null); },
  }, 'Remover');

  function render() {
    preview.replaceChildren(portrait({ portrait: current, name: getName() }, { size: 'grande' }));
    pickButton.textContent = label();
    removeButton.hidden = !current;
  }

  render();
  return h('div', { class: 'seletor-retrato' },
    preview,
    h('div', { class: 'seletor-retrato__acoes' },
      h('span', { class: 'campo__rotulo' }, 'Imagem do personagem (opcional)'),
      h('div', { class: 'grupo-botoes' }, pickButton, removeButton),
      input,
    ),
  );
}

// O próprio retrato é um botão: tocar troca a imagem (ficha de jogo)
export function portraitButton({ character, onPick, onChange }) {
  let current = character.portrait;

  const button = h('button', {
    class: 'retrato-botao',
    type: 'button',
    title: 'Trocar imagem',
    'aria-label': current ? 'Trocar imagem do personagem' : 'Adicionar imagem do personagem',
    onclick: () => input.click(),
  });
  const input = filePicker({
    onPick,
    onChange: (dataUrl) => { current = dataUrl; render(); onChange(current); },
    onBusy: (busy) => { button.disabled = busy; },
  });

  function render() {
    button.replaceChildren(
      portrait({ portrait: current, name: character.name }, { size: 'medio' }),
      h('span', { class: 'retrato-botao__selo', 'aria-hidden': 'true' }, icon(current ? 'pencil' : 'camera')),
    );
  }

  render();
  return h('div', {}, button, input);
}
