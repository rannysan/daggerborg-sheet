// Migração única: fichas salvas no caminho antigo (users/{uid}/characters/{id})
// vão para a coleção nova (characters/{id}), que permite campanhas.
// Roda a cada login, mas depois da primeira vez não encontra nada (custo: 1 consulta).

/**
 * @param {import('./FirebaseClient.js').FirebaseClient} client
 * @param {string} uid
 * @param {import('../repositories/FirestoreRepository.js').FirestoreRepository} repository
 * @returns {Promise<number>} quantas fichas foram movidas
 */
export async function migrateLegacyCharacters(client, uid, repository) {
  const { db, fs } = await client.load();
  const snapshot = await fs.getDocs(fs.collection(db, 'users', uid, 'characters'));
  for (const legacy of snapshot.docs) {
    await repository.save({ ...legacy.data(), ownerId: uid });
    fs.deleteDoc(legacy.ref).catch(() => {});
  }
  return snapshot.size;
}
