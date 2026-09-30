// Copia fichas de um armazenamento para outro (ex.: deste aparelho para a nuvem
// no primeiro login). Mesmo id = mesma ficha: copiar de novo só atualiza, não duplica.
import { migrate } from '../domain/migrations.js';

export async function countCharacters(repository) {
  return (await repository.getAll()).length;
}

export async function copyCharacters(from, to) {
  const characters = (await from.getAll()).map(migrate);
  for (const character of characters) {
    await to.save(character);
  }
  return characters.length;
}
