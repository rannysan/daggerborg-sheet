// Conta na barra superior, ao lado do Instalar:
//   sem conta → botão "Entrar" (no celular, só o ícone)
//   com conta → avatar com a inicial do apelido, que abre o Perfil
import { h } from '../dom.js';
import { icon } from '../icons.js';
import { signInWithFeedback } from '../signIn.js';

/**
 * @param {HTMLElement} container
 * @param {{
 *   auth: import('../../infra/firebase/AuthService.js').AuthService,
 *   profile: import('../../services/ProfileService.js').ProfileService,
 *   onSignIn: (user: object) => Promise<void>,
 * }} deps
 */
export function mountHeaderAccount(container, { auth, profile, onSignIn }) {
  let busy = false;

  function render() {
    if (auth.user) {
      const name = profile.displayName;
      container.replaceChildren(h('a', {
        class: 'avatar-conta',
        href: '#/perfil',
        title: `Perfil: ${name}`,
        'aria-label': `Perfil de ${name}`,
      }, (name[0] ?? '?').toUpperCase()));
      return;
    }

    const button = h('button', {
      class: 'botao botao--pequeno botao--entrar',
      type: 'button',
      disabled: busy,
      title: 'Entrar com Google para salvar as fichas na nuvem e usar campanhas',
      'aria-label': 'Entrar com Google',
      onclick: async () => {
        busy = true;
        render();
        await signInWithFeedback(auth, onSignIn);
        busy = false;
        render();
      },
    }, icon('log-in'), h('span', { class: 'so-desktop' }, busy ? 'Entrando…' : 'Entrar'));
    container.replaceChildren(button);
  }

  auth.onChange(render);
  profile.onChange(render);
  render();
}
