// Rolagem de dados. Funções puras: o gerador aleatório é injetável (testes).
//
//   rollDice('d6')      → { rolls: [4], total: 4, ... }
//   rollDice('1d8+1')   → { rolls: [7], modifier: 1, total: 8, ... }
//   rollCritical('d6')  → dano máximo (6) + uma rolagem: { bonus: 6, rolls: [3], total: 9 }

const DICE_PATTERN = /^(\d*)d(\d+)([+-]\d+)?$/i;

export function parseDice(expression) {
  const match = String(expression).replace(/\s+/g, '').match(DICE_PATTERN);
  if (!match) throw new Error(`Expressão de dados inválida: ${expression}`);
  const count = Number(match[1] || 1);
  const sides = Number(match[2]);
  if (count < 1 || count > 100 || sides < 2 || sides > 1000) {
    throw new Error(`Expressão de dados fora do limite: ${expression}`);
  }
  return { count, sides, modifier: Number(match[3] || 0) };
}

export function formatDice({ count, sides, modifier = 0 }) {
  const mod = modifier > 0 ? `+${modifier}` : modifier < 0 ? String(modifier) : '';
  return `${count}d${sides}${mod}`;
}

// Inteiro de 1 a `sides`, uniforme, com o gerador criptográfico do navegador.
// A rejeição evita o viés do módulo (alguns números saindo mais que outros).
export function cryptoRandomInt(sides) {
  const limit = Math.floor(0x100000000 / sides) * sides;
  const buffer = new Uint32Array(1);
  do {
    crypto.getRandomValues(buffer);
  } while (buffer[0] >= limit);
  return (buffer[0] % sides) + 1;
}

export function rollDice(expression, random = cryptoRandomInt) {
  const dice = parseDice(expression);
  const rolls = Array.from({ length: dice.count }, () => random(dice.sides));
  const sum = rolls.reduce((a, b) => a + b, 0);
  return {
    expression: formatDice(dice),
    ...dice,
    rolls,
    bonus: 0,
    critical: false,
    total: sum + dice.modifier,
  };
}

// Sucesso Crítico: dano máximo da arma MAIS UMA ROLAGEM
export function rollCritical(expression, random = cryptoRandomInt) {
  const normal = rollDice(expression, random);
  const max = normal.count * normal.sides;
  return { ...normal, bonus: max, critical: true, total: normal.total + max };
}

// ---------- Dano: extras de habilidade e área ----------
// Extra somado ao dano (ex.: Escondido +1d6, Ataque Poderoso +Força)
export function addDamageExtra(result, { name, value, detail = null }) {
  return recomputeDamage({ ...result, extras: [...(result.extras ?? []), { name, value, detail }] });
}

// Ataque em área (ex.: Expandir): alvos extras e metade do dano (arredonda para cima)
export function withArea(result, { name, extraTargets, detail = null }) {
  return recomputeDamage({ ...result, area: { name, extraTargets, detail } });
}

function recomputeDamage(result) {
  const base = result.rolls.reduce((a, b) => a + b, 0) + result.modifier + result.bonus;
  const full = base + (result.extras ?? []).reduce((sum, e) => sum + e.value, 0);
  return { ...result, fullTotal: full, total: result.area ? Math.ceil(full / 2) : full };
}

// Texto do cálculo, ex.: "Crítico: 6 (máximo) + 1d6 (3) + Escondido 9 = 18"
export function describeRoll(result) {
  const dice = `${result.count}d${result.sides} (${result.rolls.join(' + ')})`;
  const mod = result.modifier ? ` ${result.modifier > 0 ? '+' : '−'} ${Math.abs(result.modifier)}` : '';
  const base = result.critical ? `Crítico: ${result.bonus} (máximo) + ${dice}` : dice;
  const extras = (result.extras ?? []).map((e) => ` ${e.value >= 0 ? '+' : '−'} ${e.name} ${Math.abs(e.value)}`).join('');
  if (result.area) {
    return `${base}${mod}${extras} = ${result.fullTotal} → metade (${result.area.name}): ${result.total}`;
  }
  return `${base}${mod}${extras} = ${result.total}`;
}

// ---------- Dualidade: 2d12 (um de Esperança, um de Medo) + modificador ----------
export const DUALITY_SIDES = 12;

// target: total mínimo para sucesso (regra do sistema: 13)
export function rollDuality(modifier, { target, random = cryptoRandomInt } = {}) {
  const hope = random(DUALITY_SIDES);
  const fear = random(DUALITY_SIDES);
  const total = hope + fear + modifier;
  const critical = hope === fear; // dados iguais: Sucesso Crítico, seja qual for o total
  const success = critical || total >= target;
  const withHope = hope > fear;
  return {
    hope, fear, modifier, total, target, critical, success, withHope,
    outcome: critical ? 'critical' : `${success ? 'success' : 'failure'}-${withHope ? 'hope' : 'fear'}`,
  };
}

// Ex.: "Esperança 8 + Medo 5 + 2 = 15 (precisa de 13)"
// Com Vantagem e Experiência: "Esperança 8 + Medo 5 + 2 + Vantagem 4 (d6: 4, 1) + Caçador 1 = 20 (precisa de 13)"
export function describeDuality(result) {
  const signed = (n) => ` ${n >= 0 ? '+' : '−'} ${Math.abs(n)}`;
  const parts = [`Esperança ${result.hope} + Medo ${result.fear}`];
  if (result.modifier) parts.push(signed(result.modifier));
  if (result.edge) {
    const name = result.edge.value > 0 ? 'Vantagem' : 'Desvantagem';
    const dice = result.edge.rolls.length > 1 ? ` (d6: ${result.edge.rolls.join(', ')})` : '';
    parts.push(`${result.edge.value > 0 ? ' +' : ' −'} ${name} ${Math.abs(result.edge.value)}${dice}`);
  }
  for (const e of result.experiences ?? []) parts.push(` + ${e.name} ${e.bonus}`);
  for (const b of result.bonuses ?? []) parts.push(` ${b.value >= 0 ? '+' : '−'} ${b.name} ${Math.abs(b.value)}`);
  return `${parts.join('')} = ${result.total} (precisa de ${result.target})`;
}
