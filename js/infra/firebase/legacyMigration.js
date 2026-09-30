// Migração única: fichas salvas no caminho antigo (users/{uid}/characters/{id})
// vão para a coleção nova (characters/{id}), que permite campanhas.
// Roda a cada login, mas depois da primeira vez não encontra nada (custo: 1 consulta).
//
// Segurança dos dados: a ficha antiga só é apagada DEPOIS que o servidor confirma
// a gravação da nova. Se algo falhar, ela fica onde está e a migração tenta de
// novo no próximo login.
import { migrate } from '../../domain/migrations.js';

/**
 * @param {import('./FirebaseClient.js').FirebaseClient} client
 * @param {string} uid
 * @param {import('../repositories/FirestoreRepository.js').FirestoreRepository} repository
 * @returns {Promise<number>} quantas fichas foram movidas
 */
export async function migrateLegacyCharacters(client, uid, repository) {
  const { db, fs } = await client.load();
  const snapshot = await fs.getDocs(fs.collection(db, 'users', uid, 'characters'));
  let moved = 0;

  for (const legacy of snapshot.docs) {
    try {
      // migrate() completa campos que o formato antigo não tinha (ex.: campaignId)
      const character = { ...migrate(legacy.data()), ownerId: uid, campaignId: null };
      await repository.saveAndWait(character);
      await fs.deleteDoc(legacy.ref);
      moved += 1;
    } catch (erro) {
      console.warn('[Migração] Ficha mantida no caminho antigo, tenta de novo depois:', legacy.id, erro);
    }
  }
  return moved;
}
