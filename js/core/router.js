// Router por hash (#/rota). Funciona no GitHub Pages sem configurar o servidor.
//
// Contrato de uma página:
//   mount(outlet, params)  → desenha a página (pode ser async)
//   unmount()              → opcional: limpa inscrições, salva pendências
//   update(params)         → opcional: reaproveita a página na mesma rota;
//                            retorna true se tratou a mudança
//   beforeLeave()          → opcional: chamado antes de sair da página (links,
//                            abas, botão voltar). Devolve true/false (ou Promise):
//                            false cancela a navegação e mantém a página.
const LOADING_DELAY_MS = 250;

export class Router {
  #container;
  #routes = [];
  #current = null; // { route, page }
  #currentPath = null;
  #leaving = false; // um beforeLeave (ex.: diálogo) está esperando resposta
  #listeners = new Set();

  constructor(container) {
    this.#container = container;
  }

  // pattern: '/ficha/:id' — factory: () => página
  // meta: dados da rota para a casca do app (ex.: { title, tab, back, hideNav })
  add(pattern, factory, meta = {}) {
    const keys = [];
    const source = pattern.replace(/:(\w+)/g, (_, key) => {
      keys.push(key);
      return '([^/]+)';
    });
    this.#routes.push({ regex: new RegExp(`^${source}$`), keys, factory, meta });
    return this;
  }

  // Avisa a cada troca de tela: listener(meta, params, path)
  onChange(listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #emit(route, params, path) {
    this.#listeners.forEach((listener) => listener(route.meta, params, path));
  }

  start() {
    window.addEventListener('hashchange', () => this.#resolve());
    this.#resolve();
  }

  // Desmonta a página atual (que salva pendências), roda `between` e monta de novo.
  // Ex.: trocar o armazenamento ao entrar/sair da conta.
  async reload(between) {
    this.#current?.page.unmount?.();
    this.#current = null;
    await between?.();
    await this.#resolve();
  }

  navigate(path, { replace = false } = {}) {
    if (replace) {
      history.replaceState(null, '', `#${path}`);
      this.#resolve();
    } else {
      location.hash = path;
    }
  }

  #match(path) {
    for (const route of this.#routes) {
      const found = path.match(route.regex);
      if (found) {
        const params = Object.fromEntries(
          route.keys.map((key, i) => [key, decodeURIComponent(found[i + 1])])
        );
        return { route, params };
      }
    }
    return null;
  }

  async #resolve() {
    const path = location.hash.slice(1) || '/';
    const match = this.#match(path);

    if (!match) {
      this.navigate('/', { replace: true });
      return;
    }

    // Mesma rota: deixa a página atual tratar, se ela souber (evita recarregar)
    if (this.#current?.route === match.route && this.#current.page.update?.(match.params)) {
      this.#currentPath = path;
      this.#emit(match.route, match.params, path);
      return;
    }

    // A página atual pode segurar a saída (ex.: ficha nova ainda não concluída).
    // Se ela recusar, a URL volta para a página atual.
    if (this.#current?.page.beforeLeave && path !== this.#currentPath) {
      if (this.#leaving) {
        history.replaceState(null, '', `#${this.#currentPath}`);
        return;
      }
      this.#leaving = true;
      let allowed;
      try {
        allowed = await this.#current.page.beforeLeave();
      } finally {
        this.#leaving = false;
      }
      if (!allowed) {
        history.replaceState(null, '', `#${this.#currentPath}`);
        return;
      }
    }

    this.#current?.page.unmount?.();

    // Cada página ganha um "outlet" novo. Se o usuário trocar de rota antes de
    // uma página assíncrona terminar, ela desenha num elemento já descartado.
    const outlet = document.createElement('div');
    outlet.className = 'pagina';
    this.#container.replaceChildren(outlet);

    const page = match.route.factory();
    this.#current = { route: match.route, page };
    this.#currentPath = path;
    this.#emit(match.route, match.params, path); // antes do mount: a página pode ajustar a casca

    // Página que demora (ex.: esperando a nuvem): mostra "Carregando…" em vez de
    // tela em branco. Só aparece depois de um instante, para não piscar.
    const loading = document.createElement('p');
    loading.className = 'carregando';
    loading.setAttribute('role', 'status');
    loading.textContent = 'Carregando…';
    const loadingTimer = setTimeout(() => {
      if (outlet.isConnected && !outlet.hasChildNodes()) outlet.before(loading);
    }, LOADING_DELAY_MS);

    try {
      await page.mount(outlet, match.params);
    } catch (erro) {
      console.error('[Router] Erro ao abrir a página:', erro);
      outlet.textContent = navigator.onLine
        ? 'Algo deu errado ao abrir esta página.'
        : 'Sem conexão: não foi possível abrir esta página.';
    } finally {
      clearTimeout(loadingTimer);
      loading.remove();
    }
  }
}
