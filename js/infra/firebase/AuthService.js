// Login com Google (opcional). Sem login, o app funciona 100% local.
//
// Para não baixar o Firebase de quem nunca entrou, guardamos um "sinalizador"
// no aparelho: só com ele o app carrega o SDK ao abrir para restaurar a sessão.
const CLOUD_FLAG = 'dagger-sheet:cloud';

function readFlag() {
  try { return localStorage.getItem(CLOUD_FLAG) === '1'; } catch { return false; }
}

function writeFlag(on) {
  try {
    if (on) localStorage.setItem(CLOUD_FLAG, '1');
    else localStorage.removeItem(CLOUD_FLAG);
  } catch { /* armazenamento bloqueado: só não lembra entre visitas */ }
}

// Só o que o app usa do usuário do Firebase
const toUser = (u) => (u ? { uid: u.uid, name: u.displayName ?? '', email: u.email ?? '', photo: u.photoURL ?? null } : null);

export class AuthService {
  #client;
  #user = null;
  #listeners = new Set();

  /** @param {import('./FirebaseClient.js').FirebaseClient} client */
  constructor(client) {
    this.#client = client;
  }

  get user() {
    return this.#user;
  }

  onChange(listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #setUser(user) {
    this.#user = user;
    writeFlag(Boolean(user));
    this.#listeners.forEach((l) => l(user));
  }

  // Ao abrir o app: restaura a sessão de quem já tinha entrado.
  // Devolve o usuário ou null. Lança erro se não conseguir carregar o Firebase
  // (ex.: offline e SDK fora do cache): quem chama decide seguir no modo local.
  async restore() {
    if (!readFlag()) return null;
    const { auth } = await this.#client.load();
    await auth.authStateReady();
    this.#user = toUser(auth.currentUser);
    if (!this.#user) writeFlag(false);
    return this.#user;
  }

  // Popup (e não redirecionamento): funciona em sites fora do Firebase Hosting,
  // como o GitHub Pages, mesmo em navegadores que bloqueiam cookies de terceiros.
  async signIn() {
    const { auth, authApi } = await this.#client.load();
    const credential = await authApi.signInWithPopup(auth, new authApi.GoogleAuthProvider());
    this.#setUser(toUser(credential.user));
    return this.#user;
  }

  // Ordem importa: 1) enviar o que falta (ainda autenticado, senão as regras
  // recusam), 2) sair, 3) limpar o cache local da nuvem.
  async signOut() {
    const { auth, authApi } = await this.#client.load();
    await this.#client.flushPendingWrites(); // lança erro se estiver offline com pendências
    await authApi.signOut(auth);
    await this.#client.shutdown();
    this.#setUser(null);
  }
}
