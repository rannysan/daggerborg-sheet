// Migrações: atualizam fichas salvas em formatos antigos para o atual.
// Assim fichas antigas (no aparelho ou em .json exportado) continuam abrindo.
import { SCHEMA_VERSION, createCharacter, isValidPortrait } from './character.js';
import { ATTRIBUTE_MIN, ATTRIBUTE_MAX, clamp } from './rules.js';
import { slugify } from '../core/utils.js';

// Chave = versão de origem. Cada função leva para a versão seguinte.
const MIGRATIONS = {
  // v1 → v2: formato DaggerBorg. Sai "level" e os atributos genéricos; "notes" vira "other".
  // eslint-disable-next-line no-unused-vars
  1: ({ level, notes, attributes, ...rest }) => ({ ...rest, schemaVersion: 2, other: notes ?? '' }),

  // v2 → v3: regras do resumo. Experiências viram duas (+1/+2), suprimentos viram
  // contador (o texto antigo vai para "Outros") e atributos ficam entre -3 e +3.
  2: ({ experiences, supplies, attributes, ...rest }) => ({
    ...rest,
    schemaVersion: 3,
    experiences: [
      { name: String(experiences ?? '').trim(), bonus: 1 },
      { name: '', bonus: 2 },
    ],
    other: [rest.other, supplies && `Suprimentos: ${supplies}`].filter(Boolean).join('\n'),
    attributes: Object.fromEntries(
      Object.entries(attributes ?? {}).map(([id, v]) => [id, clamp(Number(v) || 0, ATTRIBUTE_MIN, ATTRIBUTE_MAX)])
    ),
  }),

  // v3 → v4: classes selecionáveis. O texto da classe vira um id ("Vanguarda" → "vanguarda");
  // as habilidades digitadas à mão (agora vêm da classe) vão para "Outros".
  3: ({ className, classAbilities, passiveAbility, ...rest }) => ({
    ...rest,
    schemaVersion: 4,
    classId: slugify(String(className ?? '')) || null,
    other: [
      rest.other,
      classAbilities && `Habilidades de classe (anotação antiga): ${classAbilities}`,
      passiveAbility && `Habilidade passiva (anotação antiga): ${passiveAbility}`,
    ].filter(Boolean).join('\n'),
  }),

  // v4 → v5: equipamentos selecionáveis. O texto digitado vai para "Outros" para o
  // jogador escolher de novo da lista; as fissuras marcadas são mantidas.
  4: ({ mainHand, offHand, armor, shield, ...rest }) => ({
    ...rest,
    schemaVersion: 5,
    mainHand: null,
    offHand: null,
    armor: { id: null, materialId: null, marked: armor?.marked ?? 0 },
    shield: { marked: shield?.marked ?? 0 },
    other: [
      rest.other,
      mainHand && `Mão principal (anotação antiga): ${mainHand}`,
      offHand && `Mão secundária (anotação antiga): ${offHand}`,
      armor?.name && `Armadura (anotação antiga): ${armor.name}`,
    ].filter(Boolean).join('\n'),
  }),

  // v5 → v6: a mochila passou a começar com 3 espaços. Quem estava no padrão
  // antigo (2) ganha o espaço extra; quem tinha ajustado à mão fica como está.
  5: ({ supplies, ...rest }) => ({
    ...rest,
    schemaVersion: 6,
    ...(supplies ? { supplies: supplies.max === 2 ? { ...supplies, max: 3 } : supplies } : {}),
  }),

  // v6 → v7: o Estresse virou recurso (começa cheio e é gasto). Antes o número
  // salvo era o Estresse MARCADO; agora é o que resta: 1 marcado de 5 → 4/5.
  6: ({ stress, ...rest }) => ({
    ...rest,
    schemaVersion: 7,
    ...(stress && Number.isInteger(stress.max) && Number.isInteger(stress.current)
      ? { stress: { ...stress, current: Math.min(stress.max, Math.max(0, stress.max - stress.current)) } }
      : {}),
  }),
};

export function migrate(raw) {
  if (!raw || typeof raw !== 'object' || !Number.isInteger(raw.schemaVersion)) {
    throw new Error('Este arquivo não é uma ficha do Dagger Sheet.');
  }
  if (raw.schemaVersion > SCHEMA_VERSION) {
    throw new Error('Esta ficha foi criada por uma versão mais nova do app. Atualize a página.');
  }

  let character = raw;
  while (character.schemaVersion < SCHEMA_VERSION) {
    const step = MIGRATIONS[character.schemaVersion];
    if (!step) throw new Error(`Falta a migração da versão ${character.schemaVersion}.`);
    character = step(character);
  }

  return withDefaults(character);
}

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

// Tipo "primitivo" esperado: um texto no lugar de um número (ou vice-versa) é trocado
// pelo padrão. null no padrão aceita qualquer texto (ex.: classId, campaignId).
const sameKind = (value, fallback) =>
  fallback === null ? value === null || typeof value === 'string' : typeof value === typeof fallback;

// Uma experiência válida: { name: texto, bonus: inteiro }
const isExperience = (e) => isPlainObject(e) && typeof e.name === 'string' && Number.isInteger(e.bonus);

// Completa campos que faltarem com os valores padrão e troca os de tipo errado
// (inclui um nível de aninhamento, ex.: attributes, hp). Protege contra fichas
// malformadas vindas de arquivos importados ou de outros jogadores da campanha:
// sem isso, um campo estranho poderia travar a ficha na tela de quem a abre.
function withDefaults(character) {
  const defaults = createCharacter();
  const result = { ...defaults, ...character };

  for (const [key, fallback] of Object.entries(defaults)) {
    const current = character[key];
    if (isPlainObject(fallback)) {
      const merged = isPlainObject(current) ? { ...fallback, ...current } : { ...fallback };
      for (const [inner, innerFallback] of Object.entries(fallback)) {
        if (!sameKind(merged[inner], innerFallback)) merged[inner] = innerFallback;
      }
      result[key] = merged;
    } else if (Array.isArray(fallback)) {
      if (!Array.isArray(current)) result[key] = fallback;
    } else if (!sameKind(current, fallback)) {
      result[key] = fallback;
    }
  }

  if (!result.experiences.every(isExperience)) result.experiences = defaults.experiences;
  if (!isValidPortrait(result.portrait)) result.portrait = null;
  return result;
}
