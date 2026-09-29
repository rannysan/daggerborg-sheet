// Sessão de edição de UMA ficha: guarda o estado atual e salva sozinha
// (com debounce) a cada alteração. Usada pelo wizard e pela ficha de jogo.
import { Store } from '../core/store.js';
import { debounce } from '../core/utils.js';

const AUTOSAVE_DELAY_MS = 500;

export class EditSession {
  #characters;
  #store;
  #autosave;
  #unsubscribe;
  #onError;
  #normalize;

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
      return this.#normalize({ ...current, ...changes });
    });
  }

  // Salva agora o que estiver pendente
  flush() {
    this.#autosave.flush();
  }

  dispose() {
    this.#unsubscribe();
    this.flush();
    document.removeEventListener('visibilitychange', this.#onVisibilityChange);
  }

  // Salva na hora se o usuário minimizar ou fechar o app
  #onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') this.flush();
  };

  async #save() {
    try {
      await this.#characters.save(this.character);
    } catch (erro) {
      console.error('[EditSession] Falha ao salvar:', erro);
      this.#onError(erro);
    }
  }
}
