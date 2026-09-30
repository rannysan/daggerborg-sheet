// Botão de conta no cabeçalho: "Entrar" (Google) ou o apelido de quem está conectado.
// Tocar no apelido abre o perfil: editar apelido ou sair da conta.
import { h, showToast } from '../dom.js';
import { openDialog } from './dialog.js';
import { textField } from './fields.js';
import { NICKNAME_MAX } from '../../services/ProfileService.js';

// Erros do popup que não são falha de verdade (a pessoa só fechou/cancelou)
const CANCELLED = new Set(['auth/popup-closed-by-user', 'auth/cancelled-popup-request']);

/**
 * @param {HTMLElement} container
 * @param {{
 *   auth: import('../../infra/firebase/AuthService.js').AuthService,
 *   profile: import('../../services/ProfileService.js').ProfileService,
 *   onSignIn: (user: object) => Promise<void>,
 *   onSignOut: () => Promise<void>,
 *   onProfileSaved: () => Promise<void>,
 * }} deps
 */
export function mountAccountButton(container, { auth, profile, onSignIn, onSignOut, onProfileSaved }) {
  let busy = false;

  const signIn = async () => {
    busy = true;
    render();
    try {
      const user = await auth.signIn();
      await onSignIn(user);
    } catch (erro) {
      if (erro.code === 'auth/popup-blocked') {
        showToast('O navegador bloqueou a janela de login. Permita pop-ups para este site.');
      } else if (!CANCELLED.has(erro.code)) {
        console.error('[Conta] Falha ao entrar:', erro);
        showToast('Não foi possível entrar. Verifique a conexão e tente de novo.');
      }
    } finally {
      busy = false;
      render();
    }
  };

  const signOut = async () => {
    try {
      await onSignOut();
      showToast('Você saiu da conta.');
    } catch (erro) {
      showToast(erro.message);
    }
  };

  const openProfile = () => {
    const { name, email } = auth.user;
    let nickname = profile.nickname;

    openDialog({
      title: 'Seu perfil',
      confirmLabel: 'Salvar',
      extraAction: { label: 'Sair da conta', onClick: signOut },
      content: [
        textField({
          label: 'Apelido',
          value: nickname,
          maxLength: NICKNAME_MAX,
          placeholder: name.split(' ')[0] || 'Como o grupo te chama',
          hint: 'Aparece no app e para os outros jogadores nas campanhas.',
          onInput: (v) => { nickname = v; },
        }),
        h('p', { class: 'campo__dica' }, `Conta Google: ${email}`),
        h('p', { class: 'campo__dica' },
          'Suas fichas ficam salvas na nuvem. Ao sair, este aparelho volta a mostrar só as fichas salvas nele.'),
      ],
      onConfirm: async () => {
        await profile.save(nickname);
        await onProfileSaved();
        showToast('Perfil atualizado.');
      },
    });
  };

  function render() {
    const user = auth.user;
    container.replaceChildren(user
      ? h('button', {
          class: 'botao botao--pequeno botao--claro conta',
          type: 'button',
          title: `Perfil: ${user.email}`,
          onclick: openProfile,
        }, `☁ ${profile.displayName}`)
      : h('button', {
          class: 'botao botao--pequeno botao--claro conta',
          type: 'button',
          disabled: busy,
          title: 'Entrar com Google para salvar as fichas na nuvem e usar campanhas',
          onclick: signIn,
        }, busy ? 'Entrando…' : 'Entrar'));
  }

  auth.onChange(render);
  profile.onChange(render);
  render();
}
