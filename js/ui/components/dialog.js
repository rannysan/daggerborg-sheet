// Diálogo modal de confirmação (<dialog> nativo: foco, Esc e fundo escuro já vêm prontos).
// onConfirm só é chamado se o usuário clicar no botão de confirmar.
import { h } from '../dom.js';

export function openDialog({ title, content = [], confirmLabel = 'Confirmar', onConfirm }) {
  const dialog = h('dialog', { class: 'dialogo' },
    h('form', { method: 'dialog', class: 'dialogo__corpo' },
      h('h2', {}, title),
      content,
      h('div', { class: 'grupo-botoes dialogo__acoes' },
        h('button', { class: 'botao botao--secundario', value: 'cancel' }, 'Cancelar'),
        h('button', { class: 'botao', value: 'confirm' }, confirmLabel),
      ),
    ),
  );

  dialog.addEventListener('close', () => {
    if (dialog.returnValue === 'confirm') onConfirm();
    dialog.remove();
  });

  document.body.append(dialog);
  dialog.showModal();
}
