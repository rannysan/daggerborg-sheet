// Carrega o SDK do Firebase sob demanda (só quem usa a nuvem baixa) e inicializa
// app, Auth e Firestore uma única vez.
export class FirebaseClient {
  #config;
  #sdkUrl;
  #loading = null;

  constructor(config, sdkUrl) {
    this.#config = config;
    this.#sdkUrl = sdkUrl;
  }

  // → { app, auth, db, appApi, authApi, fs }
  load() {
    this.#loading ??= this.#init();
    // Se falhar (ex.: offline sem o SDK em cache), permite tentar de novo depois
    this.#loading.catch(() => { this.#loading = null; });
    return this.#loading;
  }

  async #init() {
    const [appApi, authApi, fs] = await Promise.all([
      import(`${this.#sdkUrl}/firebase-app.js`),
      import(`${this.#sdkUrl}/firebase-auth.js`),
      import(`${this.#sdkUrl}/firebase-firestore.js`),
    ]);

    const app = appApi.initializeApp(this.#config);
    const auth = authApi.getAuth(app);
    // Cache persistente: a ficha abre e salva mesmo sem internet;
    // o Firestore envia as alterações quando a conexão voltar
    const db = fs.initializeFirestore(app, {
      localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }),
    });

    return { app, auth, db, appApi, authApi, fs };
  }

  // Espera as alterações pendentes chegarem ao servidor. Lança erro se não
  // der tempo (ex.: offline), para não perder nada ao sair da conta.
  async flushPendingWrites(timeoutMs = 5000) {
    if (!this.#loading) return;
    const { db, fs } = await this.#loading;
    const sent = await Promise.race([
      fs.waitForPendingWrites(db).then(() => true),
      new Promise((resolve) => setTimeout(() => resolve(false), timeoutMs)),
    ]);
    if (!sent) {
      throw new Error('Há alterações ainda não enviadas para a nuvem. Conecte-se à internet antes de sair.');
    }
  }

  // Depois de sair: apaga o cache local do Firestore (privacidade em aparelho
  // compartilhado) e desliga o app. O próximo load() começa do zero.
  async shutdown() {
    if (!this.#loading) return;
    const { app, db, appApi, fs } = await this.#loading;
    await fs.terminate(db);
    await fs.clearIndexedDbPersistence(db);
    await appApi.deleteApp(app);
    this.#loading = null;
  }
}
