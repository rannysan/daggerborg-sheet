// Guarda as fichas na nuvem (Firestore).
//
//   characters/{id} → ficha (sem o retrato), com ownerId e campaignId
//   portraits/{id}  → { ownerId, campaignId, portrait }
//
// O retrato fica separado porque o Firestore reenvia o documento INTEIRO a cada
// mudança: com ele junto, cada clique em Vida mandaria ~50 KB para cada pessoa
// assistindo em tempo real. As regras do Firestore controlam quem lê e edita.
import { CharacterRepository } from './CharacterRepository.js';
import { isValidPortrait } from '../../domain/character.js';

const CHARACTERS = 'characters';
const PORTRAITS = 'portraits';

const sameValue = (a, b) => a === b || JSON.stringify(a) === JSON.stringify(b);

export class FirestoreRepository extends CharacterRepository {
  #client;
  #uid;
  #onError;
  #synced = new Map(); // id → último estado conhecido do servidor (sem retrato)
  #portraits = new Map(); // id → retrato conhecido (data URL ou null)

  /**
   * @param {import('../firebase/FirebaseClient.js').FirebaseClient} client
   * @param {string} uid
   * @param {{ onError?: (erro: Error) => void }} [options]
   */
  constructor(client, uid, { onError = () => {} } = {}) {
    super();
    this.#client = client;
    this.#uid = uid;
    this.#onError = onError;
  }

  async #api() {
    const { db, fs } = await this.#client.load();
    return { db, fs };
  }

  #remember(snapshot) {
    const { portrait: _legacy, ...data } = snapshot.data(); // fichas antigas tinham o retrato junto
    this.#synced.set(data.id, data);
    return data;
  }

  async getPortrait(id) {
    if (this.#portraits.has(id)) return this.#portraits.get(id);
    const { db, fs } = await this.#api();
    try {
      const snapshot = await fs.getDoc(fs.doc(db, PORTRAITS, id));
      // Só imagem embutida: um retrato apontando para um site externo revelaria o
      // IP de quem abre a campanha (as regras também barram, isto é a 2ª camada)
      const raw = snapshot.exists() ? snapshot.data().portrait : null;
      const portrait = isValidPortrait(raw) ? raw : null;
      this.#portraits.set(id, portrait);
      return portrait;
    } catch {
      return null; // sem permissão/offline: segue sem retrato
    }
  }

  async #withPortrait(data) {
    return { ...data, portrait: await this.getPortrait(data.id) };
  }

  // Minhas fichas (as que eu criei)
  async getAll() {
    const { db, fs } = await this.#api();
    const snapshot = await fs.getDocs(fs.query(fs.collection(db, CHARACTERS), fs.where('ownerId', '==', this.#uid)));
    return Promise.all(snapshot.docs.map((d) => this.#withPortrait(this.#remember(d))));
  }

  // Qualquer ficha que eu possa ler (minha ou da minha campanha)
  async getById(id) {
    const { db, fs } = await this.#api();
    const ref = fs.doc(db, CHARACTERS, id);

    // Ficha que este aparelho já conhece (acabou de criar/abrir): lê do cache
    // local na hora. Sem isso, com a rede instável, a tela esperava o servidor
    // (até ~10 s) — e uma ficha recém-criada pode nem ter chegado lá ainda.
    // O tempo real (watch) mantém o cache atualizado com as mudanças de outros.
    if (this.#synced.has(id)) {
      const cached = await fs.getDocFromCache(ref).catch(() => null);
      if (cached?.exists()) return this.#withPortrait(this.#remember(cached));
    }

    let snapshot;
    try {
      snapshot = await fs.getDoc(ref);
    } catch (erro) {
      // Sem servidor (offline/erro): tenta a cópia local. Se nem lá existir, o erro é real.
      snapshot = await fs.getDocFromCache(ref).catch(() => { throw erro; });
    }
    return snapshot.exists() ? this.#withPortrait(this.#remember(snapshot)) : null;
  }

  // Envia só os campos que mudaram: se o Mestre e o jogador mexem ao mesmo tempo
  // em campos diferentes (ex.: Vida e Esperança), nenhum apaga o do outro.
  // Não espera o servidor: o Firestore aplica no cache local na hora e envia
  // quando puder (esperar travaria o app offline).
  async save(character) {
    for (const write of await this.#write(character)) write.catch(this.#onError);
    return character;
  }

  // Igual ao save, mas só termina quando o servidor CONFIRMA (lança erro se ele
  // recusar). Para operações que não podem falhar em silêncio, como a migração.
  async saveAndWait(character) {
    await Promise.all(await this.#write(character));
    return character;
  }

  // Dispara as gravações e devolve as promessas (ficha e, se mudou, retrato)
  async #write(character) {
    const { db, fs } = await this.#api();
    const { portrait = null, ...data } = { ...character, ownerId: character.ownerId ?? this.#uid };
    const ref = fs.doc(db, CHARACTERS, data.id);
    const known = this.#synced.get(data.id);
    const writes = [];

    if (!known) {
      writes.push(fs.setDoc(ref, data));
    } else {
      const changes = Object.fromEntries(Object.entries(data).filter(([key, value]) => !sameValue(value, known[key])));
      if (Object.keys(changes).length) writes.push(fs.updateDoc(ref, changes));
    }
    this.#synced.set(data.id, data);

    // Retrato: só grava quando muda. A campanha é copiada para as regras de leitura.
    const portraitChanged = (this.#portraits.get(data.id) ?? null) !== portrait;
    const campaignChanged = known && known.campaignId !== data.campaignId;
    const portraitRef = fs.doc(db, PORTRAITS, data.id);
    if (portrait && (portraitChanged || campaignChanged)) {
      writes.push(fs.setDoc(portraitRef, { ownerId: data.ownerId, campaignId: data.campaignId ?? null, portrait }));
    } else if (!portrait && portraitChanged) {
      writes.push(fs.deleteDoc(portraitRef));
    }
    this.#portraits.set(data.id, portrait);

    return writes;
  }

  async remove(id) {
    const { db, fs } = await this.#api();
    fs.deleteDoc(fs.doc(db, CHARACTERS, id)).catch(this.#onError);
    fs.deleteDoc(fs.doc(db, PORTRAITS, id)).catch(() => {}); // pode não existir
    this.#synced.delete(id);
    this.#portraits.delete(id);
  }

  // ---------- Campanhas e tempo real ----------

  async listByCampaign(campaignId) {
    const { db, fs } = await this.#api();
    const snapshot = await fs.getDocs(fs.query(fs.collection(db, CHARACTERS), fs.where('campaignId', '==', campaignId)));
    return snapshot.docs.map((d) => this.#remember(d));
  }

  // Avisa a cada mudança de OUTRA pessoa/aparelho numa ficha (ignora o eco das
  // próprias gravações). Devolve a função que para de ouvir.
  watch(id, onChange) {
    let unsubscribe = () => {};
    let stopped = false;
    this.#api().then(({ db, fs }) => {
      if (stopped) return;
      unsubscribe = fs.onSnapshot(fs.doc(db, CHARACTERS, id), async (snapshot) => {
        if (!snapshot.exists() || snapshot.metadata.hasPendingWrites) return;
        onChange(await this.#withPortrait(this.#remember(snapshot)));
      }, this.#onError);
    });
    return () => { stopped = true; unsubscribe(); };
  }

  // Todas as fichas de uma campanha, atualizadas em tempo real (sem retrato:
  // use getPortrait(id), que busca uma vez só)
  watchByCampaign(campaignId, onChange, onError = this.#onError) {
    let unsubscribe = () => {};
    let stopped = false;
    this.#api().then(({ db, fs }) => {
      if (stopped) return;
      const q = fs.query(fs.collection(db, CHARACTERS), fs.where('campaignId', '==', campaignId));
      unsubscribe = fs.onSnapshot(q, (snapshot) => {
        onChange(snapshot.docs.map((d) => this.#remember(d)));
      }, onError);
    });
    return () => { stopped = true; unsubscribe(); };
  }
}
