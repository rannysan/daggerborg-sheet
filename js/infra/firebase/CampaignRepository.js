// Campanhas no Firestore: campaigns/{id}
//   { id, name, description, ownerId, memberIds: [uid], members: { uid: { name } }, createdAt }
//
// Ao contrário das fichas, estas operações esperam o servidor: entrar, sair ou
// criar campanha só faz sentido com conexão, e o erro precisa aparecer na hora.
const CAMPAIGNS = 'campaigns';

export class CampaignRepository {
  #client;
  #getUid;

  /**
   * @param {import('./FirebaseClient.js').FirebaseClient} client
   * @param {() => string|null} getUid
   */
  constructor(client, getUid) {
    this.#client = client;
    this.#getUid = getUid;
  }

  async #api() {
    const uid = this.#getUid();
    if (!uid) throw new Error('Entre na sua conta para usar campanhas.');
    const { db, fs } = await this.#client.load();
    return { db, fs, uid, col: fs.collection(db, CAMPAIGNS) };
  }

  async create({ name, description, ownerName }) {
    const { fs, uid, col } = await this.#api();
    const ref = fs.doc(col); // id aleatório (20 caracteres): é o "segredo" do convite
    const campaign = {
      id: ref.id,
      name,
      description,
      ownerId: uid,
      memberIds: [uid],
      members: { [uid]: { name: ownerName } },
      createdAt: new Date().toISOString(),
    };
    await fs.setDoc(ref, campaign);
    return campaign;
  }

  async listMine() {
    const { fs, uid, col } = await this.#api();
    const snapshot = await fs.getDocs(fs.query(col, fs.where('memberIds', 'array-contains', uid)));
    return snapshot.docs.map((d) => d.data());
  }

  async get(id) {
    const { fs, col } = await this.#api();
    const snapshot = await fs.getDoc(fs.doc(col, id));
    return snapshot.exists() ? snapshot.data() : null;
  }

  async update(id, { name, description }) {
    const { fs, col } = await this.#api();
    await fs.updateDoc(fs.doc(col, id), { name, description });
  }

  async join(id, name) {
    const { fs, uid, col } = await this.#api();
    await fs.updateDoc(fs.doc(col, id), {
      memberIds: fs.arrayUnion(uid),
      [`members.${uid}`]: { name },
    });
  }

  // Sair (memberUid = eu) ou o Mestre remover alguém
  async removeMember(id, memberUid) {
    const { fs, col } = await this.#api();
    await fs.updateDoc(fs.doc(col, id), {
      memberIds: fs.arrayRemove(memberUid),
      [`members.${memberUid}`]: fs.deleteField(),
    });
  }

  async renameMember(id, name) {
    const { fs, uid, col } = await this.#api();
    await fs.updateDoc(fs.doc(col, id), { [`members.${uid}.name`]: name });
  }

  async remove(id) {
    const { fs, col } = await this.#api();
    await fs.deleteDoc(fs.doc(col, id));
  }

  // Tempo real: nome, membros... Chama onChange(null) se a campanha for excluída.
  watch(id, onChange, onError) {
    let unsubscribe = () => {};
    let stopped = false;
    this.#api().then(({ fs, col }) => {
      if (stopped) return;
      unsubscribe = fs.onSnapshot(fs.doc(col, id), (snapshot) => {
        onChange(snapshot.exists() ? snapshot.data() : null);
      }, onError);
    }, onError);
    return () => { stopped = true; unsubscribe(); };
  }
}
