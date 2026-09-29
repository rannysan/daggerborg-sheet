// Casos de uso das fichas. As páginas falam com este serviço, nunca direto
// com o repositório. Ele recebe as dependências prontas (injeção de dependência).
import { createCharacter, newId } from '../domain/character.js';
import { migrate } from '../domain/migrations.js';
import { slugify } from '../core/utils.js';

export class CharacterService {
  #repository;
  #files;

  /**
   * @param {import('../infra/repositories/CharacterRepository.js').CharacterRepository} repository
   * @param {import('../infra/FileService.js').FileService} files
   */
  constructor(repository, files) {
    this.#repository = repository;
    this.#files = files;
  }

  // Mais recentes primeiro
  async list() {
    const all = (await this.#repository.getAll()).map(migrate);
    return all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async get(id) {
    const raw = await this.#repository.getById(id);
    return raw ? migrate(raw) : null;
  }

  async create() {
    return this.#repository.save(createCharacter());
  }

  async save(character) {
    return this.#repository.save({ ...character, updatedAt: new Date().toISOString() });
  }

  remove(id) {
    return this.#repository.remove(id);
  }

  export(character) {
    const name = slugify(character.name) || 'ficha';
    this.#files.downloadJson(`${name}.json`, character);
  }

  // Importa sempre como uma ficha NOVA, para não sobrescrever uma existente
  async import(file) {
    const character = migrate(await this.#files.readJson(file));
    const now = new Date().toISOString();
    return this.#repository.save({ ...character, id: newId(), createdAt: now, updatedAt: now });
  }
}
