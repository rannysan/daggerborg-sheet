// Perfil (#/perfil): conta Google (apelido, sair), aparência (tema) e avisos.
// Entrar fica na barra superior (headerAccount). No celular é uma das abas da
// navegação inferior, como num app.
import { h, showToast } from '../dom.js';
import { icon } from '../icons.js';
import { openDialog } from '../components/dialog.js';
import { textField } from '../components/fields.js';
import { NICKNAME_MAX } from '../../services/ProfileService.js';
import { THEME_OPTIONS, getThemePreference, setThemePreference } from '../theme.js';

export class ProfilePage {
  #auth;
  #profile;
  #onSignIn;
  #onSignOut;
  #onProfileSaved;

  /**
   * @param {{
   *   auth: import('../../infra/firebase/AuthService.js').AuthService,
   *   profile: import('../../services/ProfileService.js').ProfileService,
   *   onSignIn: (user: object) => Promise<void>,
   *   onSignOut: () => Promise<void>,
   *   onProfileSaved: () => Promise<void>,
   * }} deps
   */
  constructor({ auth, profile, onSignIn, onSignOut, onProfileSaved }) {
    this.#auth = auth;
    this.#profile = profile;
    this.#onSignIn = onSignIn;
    this.#onSignOut = onSignOut;
    this.#onProfileSaved = onProfileSaved;
  }

  mount(outlet) {
    outlet.append(
      h('div', { class: 'cabecalho-pagina' }, h('h1', {}, 'Perfil')),
      this.#auth.user ? this.#account() : this.#signInCard(),
      this.#appearance(),
      this.#deviceInfo(),
      h('p', { class: 'campo__dica aviso-legal' },
        'A nuvem é protegida pelo reCAPTCHA do Google, que analisa o uso do site para barrar robôs. ',
        h('a', { href: 'https://policies.google.com/privacy', target: '_blank', rel: 'noopener noreferrer' }, 'Privacidade'),
        ' e ',
        h('a', { href: 'https://policies.google.com/terms', target: '_blank', rel: 'noopener noreferrer' }, 'Termos'),
        '.'),
    );
  }

  // ---------- Sem conta: convite para entrar ----------
  // O login fica na barra superior (botão Entrar); aqui só a explicação
  #signInCard() {
    return h('section', { class: 'card perfil-convite' },
      h('h2', {}, 'Sua conta'),
      h('p', {}, 'Sem conta, suas fichas ficam só neste aparelho. Entrando com o Google, elas ficam salvas na nuvem, '
        + 'sincronizam entre aparelhos e você pode participar de campanhas com seu grupo.'),
      h('p', { class: 'perfil-dica' }, icon('log-in'), 'Use o botão Entrar, no topo da tela.'),
    );
  }

  // ---------- Com conta: dados, apelido e sair ----------
  #account() {
    const { name, email } = this.#auth.user;
    let nickname = this.#profile.nickname;
    const initial = (this.#profile.displayName[0] ?? '?').toUpperCase();

    const saveButton = h('button', { class: 'botao', type: 'submit' }, icon('check'), 'Salvar apelido');
    const form = h('form', { class: 'perfil-apelido' },
      textField({
        label: 'Apelido',
        value: nickname,
        maxLength: NICKNAME_MAX,
        placeholder: name.split(' ')[0] || 'Como o grupo te chama',
        hint: 'Aparece no app e para os outros jogadores nas campanhas.',
        onInput: (v) => { nickname = v; },
      }),
      saveButton,
    );
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      saveButton.disabled = true;
      try {
        await this.#profile.save(nickname);
        await this.#onProfileSaved();
        showToast('Apelido salvo.');
      } catch (erro) {
        showToast(erro.message);
        saveButton.disabled = false;
      }
    });

    return h('section', { class: 'card' },
      h('div', { class: 'perfil-identidade' },
        h('div', { class: 'retrato retrato--medio retrato--vazio', 'aria-hidden': 'true' }, initial),
        h('div', {},
          h('strong', { class: 'perfil-identidade__nome' }, this.#profile.displayName),
          h('span', { class: 'campo__dica' }, email),
        ),
      ),
      form,
      h('p', { class: 'campo__dica' }, 'Suas fichas ficam salvas na nuvem. Ao sair, este aparelho volta a mostrar só as fichas salvas nele.'),
      h('button', {
        class: 'botao botao--secundario botao--perigo-texto',
        type: 'button',
        onclick: () => this.#confirmSignOut(),
      }, icon('log-out'), 'Sair da conta'),
    );
  }

  #confirmSignOut() {
    openDialog({
      title: 'Sair da conta?',
      confirmLabel: 'Sair',
      danger: true,
      content: [h('p', {}, 'Suas fichas continuam na nuvem. Neste aparelho, você volta a ver só as fichas salvas nele.')],
      onConfirm: async () => {
        await this.#onSignOut(); // lança erro se houver alterações não enviadas
        showToast('Você saiu da conta.');
      },
    });
  }

  // ---------- Diagnóstico: como o app enxerga este aparelho ----------
  // Ajuda a entender problemas de layout (ex.: celular que informa largura de
  // computador) e a confirmar qual versão está em uso.
  #deviceInfo() {
    const touch = matchMedia('(pointer: coarse)').matches;
    const installed = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    const line = h('p', { class: 'campo__dica aviso-legal' },
      `Este aparelho: ${innerWidth}px de largura · ${touch ? 'toque' : 'mouse'} · ${installed ? 'app instalado' : 'navegador'}`);

    // Versão = nome do cache do service worker (ex.: dagger-sheet-v34)
    if ('caches' in window) {
      caches.keys().then((keys) => {
        const version = keys.find((k) => k.startsWith('dagger-sheet-'));
        if (version) line.append(` · ${version.replace('dagger-sheet-', 'versão ')}`);
      }).catch(() => {});
    }
    return line;
  }

  // ---------- Aparência ----------
  #appearance() {
    const current = getThemePreference();
    return h('section', { class: 'card' },
      h('h2', {}, 'Aparência'),
      h('div', { class: 'segmentado', role: 'radiogroup', 'aria-label': 'Tema' },
        THEME_OPTIONS.map((option) => {
          const id = `tema-${option.value}`;
          return h('label', { class: 'segmentado__opcao', for: id },
            h('input', {
              id,
              type: 'radio',
              name: 'tema',
              value: option.value,
              checked: option.value === current,
              onchange: () => setThemePreference(option.value),
            }),
            h('span', {}, option.label),
          );
        }),
      ),
      h('p', { class: 'campo__dica' }, 'Vale só para este aparelho.'),
    );
  }
}
