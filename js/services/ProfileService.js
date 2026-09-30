// Perfil do usuário logado: apelido exibido no app e nas campanhas.
// Sem apelido, usa o primeiro nome da conta Google (ou o início do e-mail).
export const NICKNAME_MAX = 30;

export class ProfileService {
  #repository;
  #auth;
  #nickname = '';
  #listeners = new Set();

  /**
   * @param {import('../infra/firebase/ProfileRepository.js').ProfileRepository} repository
   * @param {import('../infra/firebase/AuthService.js').AuthService} auth
   */
  constructor(repository, auth) {
    this.#repository = repository;
    this.#auth = auth;
  }

  get uid() {
    return this.#auth.user?.uid ?? null;
  }

  get nickname() {
    return this.#nickname;
  }

  // Nome mostrado no app: apelido > primeiro nome do Google > começo do e-mail
  get displayName() {
    const user = this.#auth.user;
    if (!user) return '';
    return this.#nickname || user.name.split(' ')[0] || user.email.split('@')[0];
  }

  onChange(listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  // Ao entrar/restaurar a sessão. Falha (ex.: offline) não impede o uso do app.
  async load() {
    this.#nickname = '';
    if (this.uid) {
      try {
        this.#nickname = (await this.#repository.get(this.uid))?.nickname ?? '';
      } catch (erro) {
        console.warn('[Perfil] Não foi possível carregar:', erro);
      }
    }
    this.#listeners.forEach((l) => l());
  }

  async save(nickname) {
    const value = nickname.trim();
    if (value.length > NICKNAME_MAX) throw new Error(`O apelido pode ter até ${NICKNAME_MAX} caracteres.`);
    await this.#repository.save(this.uid, { nickname: value });
    this.#nickname = value;
    this.#listeners.forEach((l) => l());
  }
}
