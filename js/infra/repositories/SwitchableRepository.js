// Repositório que repassa para outro, trocável em tempo de execução (pattern Proxy).
// Deixa o app alternar entre local (IndexedDB) e nuvem (Firestore) ao entrar e
// sair da conta, sem que o CharacterService e as telas percebam.
//
// Recursos só da nuvem (campanhas, tempo real, retrato separado) devolvem null
// quando o repositório atual não os tem.
import { CharacterRepository } from './CharacterRepository.js';

export class SwitchableRepository extends CharacterRepository {
  #current;

  constructor(initial) {
    super();
    this.#current = initial;
  }

  use(repository) {
    this.#current = repository;
  }

  get supportsCampaigns() {
    return typeof this.#current.watchByCampaign === 'function';
  }

  getAll() { return this.#current.getAll(); }
  getById(id) { return this.#current.getById(id); }
  save(character) { return this.#current.save(character); }
  remove(id) { return this.#current.remove(id); }

  // ---------- Opcionais (nuvem) ----------
  watch(id, onChange) { return this.#current.watch?.(id, onChange) ?? null; }
  watchByCampaign(campaignId, onChange, onError) {
    return this.#current.watchByCampaign?.(campaignId, onChange, onError) ?? null;
  }
  listByCampaign(campaignId) { return this.#current.listByCampaign?.(campaignId) ?? Promise.resolve([]); }
  getPortrait(id) { return this.#current.getPortrait?.(id) ?? Promise.resolve(null); }
}
