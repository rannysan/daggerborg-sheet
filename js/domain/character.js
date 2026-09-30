// Modelo da ficha DaggerBorg. Guarda só os dados do jogador;
// regras e limites ficam em rules.js.
import {
  ATTRIBUTES, ATTRIBUTE_MIN, EXPERIENCE_BONUSES, HOPE_START,
  SUPPLIES_START, BACKPACK_START, DEFAULT_HP_MAX, DEFAULT_STRESS_MAX, TIER_START,
} from './rules.js';

// Aumente quando mudar o formato de campos existentes e crie a migração em
// migrations.js. Campos NOVOS não precisam: a migração completa com o padrão.
export const SCHEMA_VERSION = 5;

export function newId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  // fallback para contextos sem HTTPS (ex.: acesso por IP na rede local)
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// Retrato: só imagem embutida (data URL). Recusa links externos vindos de
// arquivos importados (evita carregar/rastrear endereços de terceiros).
const PORTRAIT_PATTERN = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/;
// O app gera ~30-50 KB; o limite folgado barra abusos (mesmo valor nas regras do Firestore)
export const PORTRAIT_MAX_LENGTH = 300000;

export function isValidPortrait(value) {
  return typeof value === 'string' && value.length <= PORTRAIT_MAX_LENGTH && PORTRAIT_PATTERN.test(value);
}

// Factory: sempre devolve uma ficha completa e válida
export function createCharacter(overrides = {}) {
  const now = new Date().toISOString();
  return {
    schemaVersion: SCHEMA_VERSION,
    id: newId(),
    createdAt: now,
    updatedAt: now,

    // Nuvem: dono (uid) e campanha (id) — null no modo local / sem campanha
    ownerId: null,
    campaignId: null,

    player: '',
    name: '',
    pronouns: '',
    classId: null, // id de data/classes.json
    tier: TIER_START,
    portrait: null, // data URL da imagem (opcional)

    attributes: Object.fromEntries(ATTRIBUTES.map((a) => [a.id, ATTRIBUTE_MIN])),

    hp: { current: DEFAULT_HP_MAX, max: DEFAULT_HP_MAX },
    stress: { current: 0, max: DEFAULT_STRESS_MAX },
    hope: HOPE_START,
    vulnerable: false,

    // ids de data/equipment.json (null = nada)
    mainHand: null, // arma
    offHand: null, // arma de 1 mão ou escudo
    armor: { id: null, materialId: null, marked: 0 }, // marked = fissuras
    shield: { marked: 0 }, // fissuras do escudo na mão secundária

    experiences: EXPERIENCE_BONUSES.map((bonus) => ({ name: '', bonus })),

    other: '',
    supplies: { current: SUPPLIES_START, max: BACKPACK_START },
    ...overrides,
  };
}
