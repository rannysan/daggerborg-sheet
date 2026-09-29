// Contrato de armazenamento das fichas (pattern Repository).
// O app só conhece esta interface; trocar IndexedDB por Supabase/Firebase
// é criar outra classe que a implemente e mudar uma linha no main.js.
export class CharacterRepository {
  /** @returns {Promise<object[]>} */
  async getAll() { throw new Error('getAll() não implementado'); }

  /** @returns {Promise<object|null>} */
  // eslint-disable-next-line no-unused-vars
  async getById(id) { throw new Error('getById() não implementado'); }

  /** @returns {Promise<object>} a ficha salva */
  // eslint-disable-next-line no-unused-vars
  async save(character) { throw new Error('save() não implementado'); }

  /** @returns {Promise<void>} */
  // eslint-disable-next-line no-unused-vars
  async remove(id) { throw new Error('remove() não implementado'); }
}
