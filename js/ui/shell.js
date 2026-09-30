// Casca do app: barra superior (voltar + título), navegação (inferior no
// celular, no topo no desktop) e ícones da casca.
//
// Cada rota informa, no main.js: { title, tab, back, hideNav }.
// Uma página pode ajustar depois: setShellTitle('Aria'), setShellBack('/campanha/x').
import { icon } from './icons.js';

const state = { back: null };
let router = null;
let els = null;

// Troca os <span data-icone="nome"> do HTML pelos SVGs
function hydrateIcons(root = document) {
  root.querySelectorAll('[data-icone]').forEach((el) => el.replaceWith(icon(el.dataset.icone)));
}

export function setupShell(appRouter) {
  router = appRouter;
  els = {
    back: document.getElementById('btn-voltar'),
    title: document.getElementById('titulo-tela'),
    tabs: document.querySelectorAll('[data-aba]'),
  };
  hydrateIcons();

  els.back.addEventListener('click', () => {
    if (state.back) router.navigate(state.back);
  });

  router.onChange((meta = {}) => {
    setShellTitle(meta.title ?? '');
    setShellBack(meta.back ?? null);
    document.body.classList.toggle('sem-nav', Boolean(meta.hideNav));
    els.tabs.forEach((tab) => {
      if (tab.dataset.aba === meta.tab) tab.setAttribute('aria-current', 'page');
      else tab.removeAttribute('aria-current');
    });
    window.scrollTo({ top: 0 });
  });
}

// Título da tela na barra superior (no celular). Vazio mostra a marca do app.
export function setShellTitle(title) {
  if (!els) return;
  els.title.textContent = title;
  document.body.classList.toggle('com-titulo', Boolean(title));
}

// Destino do botão voltar (null esconde o botão)
export function setShellBack(path) {
  if (!els) return;
  state.back = path;
  els.back.hidden = !path;
}
