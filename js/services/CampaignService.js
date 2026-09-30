// Casos de uso das campanhas. Junta o repositório de campanhas com as fichas
// (ex.: ao sair de uma campanha, as suas fichas são desvinculadas antes).
import { validateCampaign } from '../domain/campaign.js';
import { hasErrors as hasErrorsIn } from '../domain/validation.js';

export class CampaignService {
  #repository;
  #characters;
  #profile;

  /**
   * @param {import('../infra/firebase/CampaignRepository.js').CampaignRepository} repository
   * @param {import('./CharacterService.js').CharacterService} characters
   * @param {import('./ProfileService.js').ProfileService} profile
   */
  constructor(repository, characters, profile) {
    this.#repository = repository;
    this.#characters = characters;
    this.#profile = profile;
  }

  // Campanhas exigem conta (e o armazenamento na nuvem)
  get available() {
    return Boolean(this.#profile.uid) && this.#characters.supportsCampaigns;
  }

  get uid() {
    return this.#profile.uid;
  }

  inviteUrl(id) {
    return `${location.origin}${location.pathname}#/entrar/${id}`;
  }

  async listMine() {
    const list = await this.#repository.listMine();
    return list.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }

  get(id) {
    return this.#repository.get(id);
  }

  watch(id, onChange, onError) {
    return this.#repository.watch(id, onChange, onError);
  }

  async create({ name, description = '' }) {
    const errors = validateCampaign({ name, description });
    if (hasErrorsIn(errors)) throw Object.assign(new Error(Object.values(errors)[0]), { errors });
    return this.#repository.create({
      name: name.trim(),
      description: description.trim(),
      ownerName: this.#profile.displayName,
    });
  }

  async update(id, { name, description = '' }) {
    const errors = validateCampaign({ name, description });
    if (hasErrorsIn(errors)) throw Object.assign(new Error(Object.values(errors)[0]), { errors });
    await this.#repository.update(id, { name: name.trim(), description: description.trim() });
  }

  join(id) {
    return this.#repository.join(id, this.#profile.displayName);
  }

  // Sair: primeiro desvincula as MINHAS fichas (ainda como membro, para as regras deixarem)
  async leave(campaign) {
    await this.#characters.unlinkFromCampaign(campaign.id, { ownerId: this.uid });
    await this.#repository.removeMember(campaign.id, this.uid);
  }

  // Mestre remove alguém: as fichas dessa pessoa saem da campanha, mas continuam com ela
  async removeMember(campaign, memberUid) {
    await this.#characters.unlinkFromCampaign(campaign.id, { ownerId: memberUid });
    await this.#repository.removeMember(campaign.id, memberUid);
  }

  // Mestre exclui: todas as fichas voltam a ficar sem campanha; ninguém perde nada
  async remove(campaign) {
    await this.#characters.unlinkFromCampaign(campaign.id);
    await this.#repository.remove(campaign.id);
  }

  // Ao trocar o apelido: atualiza o nome mostrado em todas as minhas campanhas
  async syncMyName() {
    const campaigns = await this.#repository.listMine();
    await Promise.all(campaigns.map((c) => this.#repository.renameMember(c.id, this.#profile.displayName)));
  }
}
