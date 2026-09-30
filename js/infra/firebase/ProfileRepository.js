// Perfil do usuário no Firestore: users/{uid} → { nickname }
export class ProfileRepository {
  #client;

  /** @param {import('./FirebaseClient.js').FirebaseClient} client */
  constructor(client) {
    this.#client = client;
  }

  async get(uid) {
    const { db, fs } = await this.#client.load();
    const snapshot = await fs.getDoc(fs.doc(db, 'users', uid));
    return snapshot.exists() ? snapshot.data() : null;
  }

  async save(uid, profile) {
    const { db, fs } = await this.#client.load();
    await fs.setDoc(fs.doc(db, 'users', uid), profile, { merge: true });
  }
}
