// Router por hash (#/rota). Funciona no GitHub Pages sem configurar o servidor.
//
// Contrato de uma página:
//   mount(outlet, params)  → desenha a página (pode ser async)
//   unmount()              → opcional: limpa inscrições, salva pendências
//   update(params)         → opcional: reaproveita a página na mesma rota;
//                            retorna true se tratou a mudança
export class Router {
  #container;
  #routes = [];
  #current = null; // { route, page }

  constructor(container) {
    this.#container = container;
  }

  // pattern: '/ficha/:id' — factory: () => página
  add(pattern, factory) {
    const keys = [];
    const source = pattern.replace(/:(\w+)/g, (_, key) => {
      keys.push(key);
      return '([^/]+)';
    });
    this.#routes.push({ regex: new RegExp(`^${source}$`), keys, factory });
    return this;
  }

  start() {
    window.addEventListener('hashchange', () => this.#resolve());
    this.#resolve();
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
      return;
    }

    this.#current?.page.unmount?.();

    // Cada página ganha um "outlet" novo. Se o usuário trocar de rota antes de
    // uma página assíncrona terminar, ela desenha num elemento já descartado.
    const outlet = document.createElement('div');
    outlet.className = 'pagina';
    this.#container.replaceChildren(outlet);

    const page = match.route.factory();
    this.#current = { route: match.route, page };

    try {
      await page.mount(outlet, match.params);
    } catch (erro) {
      console.error('[Router] Erro ao abrir a página:', erro);
      outlet.textContent = 'Algo deu errado ao abrir esta página.';
    }
  }
}
