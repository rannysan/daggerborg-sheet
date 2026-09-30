// Sessão de edição de UMA ficha: guarda o estado atual e salva sozinha
// (com debounce) a cada alteração. Usada pelo wizard e pela ficha de jogo.
import { Store } from '../core/store.js';
import { debounce } from '../core/utils.js';

const AUTOSAVE_DELAY_MS = 500;

const sameValue = (a, b) => a === b || JSON.stringify(a) === JSON.stringify(b);

export class EditSession {
  #characters;
  #store;
  #autosave;
  #unsubscribe;
  #onError;
  #normalize;
  #dirty = new Set(); // campos alterados aqui e ainda não salvos

  /**
   * @param {import('./CharacterService.js').CharacterService} characters
   * @param {object} character ficha já carregada
   * @param {{
   *   onError?: (erro: Error) => void,
   *   normalize?: (character: object) => object  // mantém valores derivados em dia
   * }} [options]
   */
  constructor(characters, character, { onError = () => {}, normalize = (c) => c } = {}) {
    this.#characters = characters;
    this.#onError = onError;
    this.#normalize = normalize;

    const normalized = normalize(character);
    this.#store = new Store(normalized);
    this.#autosave = debounce(() => this.#save(), AUTOSAVE_DELAY_MS);
    this.#unsubscribe = this.#store.subscribe(this.#autosave);
    document.addEventListener('visibilitychange', this.#onVisibilityChange);

    // Valores derivados mudaram ao abrir (ex.: dados da classe atualizados): salva
    if (normalized !== character) this.#autosave();
  }

  get character() {
    return this.#store.get();
  }

  // Mesmo formato do Store.update: objeto ou função (fichaAtual) => objeto
  update(patch) {
    this.#store.update((current) => {
      const changes = typeof patch === 'function' ? patch(current) : patch;
      const next = this.#normalize({ ...current, ...changes });
      for (const key of Object.keys(next)) {
        if (!sameValue(next[key], current[key])) this.#dirty.add(key);
      }
      return next;
    });
  }

  // Alteração que veio de outra pessoa/aparelho (tempo real): aplica sem salvar de
  // novo, preservando os campos mexidos aqui que ainda não foram salvos.
  applyRemote(remote) {
    const local = this.character;
    const merged = { ...remote };
    for (const key of this.#dirty) merged[key] = local[key];
    this.#store.set(this.#normalize(merged), { silent: true });
  }

  // Salva agora o que estiver pendente
  flush() {
    this.#autosave.flush();
  }

  // save: false descarta alterações pendentes (ex.: rascunho sendo excluído)
  dispose({ save = true } = {}) {
    this.#unsubscribe();
    if (save) this.flush();
    else this.#autosave.cancel();
    document.removeEventListener('visibilitychange', this.#onVisibilityChange);
  }

  // Salva na hora se o usuário minimizar ou fechar o app
  #onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') this.flush();
  };

  async #save() {
    this.#dirty.clear();
    try {
      await this.#characters.save(this.character);
    } catch (erro) {
      console.error('[EditSession] Falha ao salvar:', erro);
      this.#onError(erro);
    }
  }
}
