// Guarda as fichas no IndexedDB do navegador (funciona offline, fica no aparelho).
import { CharacterRepository } from './CharacterRepository.js';

const DB_NAME = 'dagger-sheet';
const DB_VERSION = 1;
const STORE = 'characters';

export class IndexedDbRepository extends CharacterRepository {
  #dbPromise = null;

  #openDb() {
    this.#dbPromise ??= new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return this.#dbPromise;
  }

  // Executa uma operação e só resolve quando a transação termina
  async #run(mode, operation) {
    const db = await this.#openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = operation(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  getAll() {
    return this.#run('readonly', (store) => store.getAll());
  }

  async getById(id) {
    return (await this.#run('readonly', (store) => store.get(id))) ?? null;
  }

  async save(character) {
    await this.#run('readwrite', (store) => store.put(character));
    return character;
  }

  async remove(id) {
    await this.#run('readwrite', (store) => store.delete(id));
  }
}
