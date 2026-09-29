// Carrega o CONTEÚDO do sistema (classes, itens...) dos arquivos em /data.
// Para adicionar uma tabela: crie data/<nome>.json e inclua o nome abaixo
// (e no ARQUIVOS do sw.js, para funcionar offline desde o primeiro acesso).
const DATA_FILES = ['classes', 'equipment'];

export class GameDataLoader {
  #basePath;

  constructor(basePath = 'data/') {
    this.#basePath = basePath;
  }

  // Devolve { classes: [...], ... } congelado (só leitura)
  async load() {
    const entries = await Promise.all(
      DATA_FILES.map(async (name) => [name, await this.#fetchJson(name)])
    );
    return Object.freeze(Object.fromEntries(entries));
  }

  async #fetchJson(name) {
    const response = await fetch(`${this.#basePath}${name}.json`);
    if (!response.ok) {
      throw new Error(`Falha ao carregar ${name}.json (${response.status})`);
    }
    return response.json();
  }
}
