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

  // overrides: ex. { campaignId, player } ao criar direto numa campanha
  async create(overrides = {}) {
    return this.#repository.save(createCharacter(overrides));
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

  // Importa sempre como uma ficha NOVA e SUA (sem dono nem campanha de origem),
  // para não sobrescrever uma existente
  async import(file) {
    const character = migrate(await this.#files.readJson(file));
    const now = new Date().toISOString();
    return this.#repository.save({
      ...character, id: newId(), ownerId: null, campaignId: null, createdAt: now, updatedAt: now,
    });
  }

  // ---------- Nuvem: campanhas e tempo real ----------

  get supportsCampaigns() {
    return Boolean(this.#repository.supportsCampaigns);
  }

  // Ouve mudanças feitas por outra pessoa/aparelho. Devolve a função que para
  // de ouvir, ou null se o armazenamento atual não tem tempo real (modo local).
  watch(id, onChange) {
    return this.#repository.watch?.(id, (raw) => onChange(migrate(raw))) ?? null;
  }

  watchCampaign(campaignId, onChange, onError) {
    return this.#repository.watchByCampaign?.(
      campaignId, (list) => onChange(list.map(migrate)), onError,
    ) ?? null;
  }

  getPortrait(id) {
    return this.#repository.getPortrait?.(id) ?? Promise.resolve(null);
  }

  // Vincula (campaignId) ou desvincula (null) uma ficha
  async setCampaign(id, campaignId) {
    const character = await this.get(id);
    if (!character) throw new Error('Ficha não encontrada.');
    return this.save({ ...character, campaignId });
  }

  // Desvincula as fichas de uma campanha (todas, ou só as de um dono)
  async unlinkFromCampaign(campaignId, { ownerId = null } = {}) {
    const linked = (await this.#repository.listByCampaign(campaignId))
      .filter((c) => !ownerId || c.ownerId === ownerId);
    for (const character of linked) await this.setCampaign(character.id, null);
    return linked.length;
  }
}
