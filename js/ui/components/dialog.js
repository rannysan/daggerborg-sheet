// Diálogo modal (<dialog> nativo: foco, Esc e fundo escuro já vêm prontos).
//
// onConfirm pode ser async. Se devolver false ou lançar erro, o diálogo continua
// aberto (ex.: formulário com campo inválido). Enter num campo confirma.
// extraAction: botão opcional à esquerda, ex. { label: 'Sair da conta', onClick }.
// Devolve { close }.
import { h, showToast } from '../dom.js';

export function openDialog({ title, content = [], confirmLabel = 'Confirmar', onConfirm, extraAction = null, danger = false }) {
  const close = () => dialog.close();

  const confirmButton = h('button', { class: danger ? 'botao botao--perigo' : 'botao', type: 'submit' }, confirmLabel);
  const form = h('form', { class: 'dialogo__corpo' },
    h('h2', {}, title),
    content,
    h('div', { class: 'grupo-botoes dialogo__acoes' },
      extraAction
        ? h('button', {
            class: 'botao botao--secundario dialogo__extra',
            type: 'button',
            onclick: () => { close(); extraAction.onClick(); },
          }, extraAction.label)
        : null,
      h('button', { class: 'botao botao--secundario', type: 'button', onclick: close }, 'Cancelar'),
      confirmButton,
    ),
  );

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    confirmButton.disabled = true;
    try {
      const result = await onConfirm?.();
      if (result !== false) close();
    } catch (erro) {
      console.error('[Diálogo]', erro);
      showToast(erro.message || 'Algo deu errado.');
    } finally {
      confirmButton.disabled = false;
    }
  });

  const dialog = h('dialog', { class: 'dialogo' }, form);
  dialog.addEventListener('close', () => dialog.remove());

  document.body.append(dialog);
  dialog.showModal();
  return { close };
}
