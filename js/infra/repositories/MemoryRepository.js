// Guarda em memória (some ao recarregar). Útil para testes e para depurar
// sem mexer nos dados reais: troque no main.js.
import { CharacterRepository } from './CharacterRepository.js';

export class MemoryRepository extends CharacterRepository {
  #items = new Map();

  async getAll() {
    return [...this.#items.values()].map((c) => structuredClone(c));
  }

  async getById(id) {
    const found = this.#items.get(id);
    return found ? structuredClone(found) : null;
  }

  async save(character) {
    this.#items.set(character.id, structuredClone(character));
    return character;
  }

  async remove(id) {
    this.#items.delete(id);
  }
}
