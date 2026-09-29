// Store: guarda um estado e avisa os inscritos quando ele muda (pattern Observer).
export class Store {
  #state;
  #listeners = new Set();

  constructor(initialState = null) {
    this.#state = initialState;
  }

  get() {
    return this.#state;
  }

  set(nextState) {
    this.#state = nextState;
    this.#listeners.forEach((listener) => listener(nextState));
  }

  // Mescla só os campos informados (atualização rasa).
  // Aceita um objeto ou uma função (estadoAtual) => objeto, para campos aninhados:
  //   store.update((c) => ({ hp: { ...c.hp, current: 3 } }))
  update(patch) {
    const changes = typeof patch === 'function' ? patch(this.#state) : patch;
    this.set({ ...this.#state, ...changes });
  }

  // Retorna uma função que cancela a inscrição
  subscribe(listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }
}
