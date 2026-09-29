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

// Texto do cálculo, ex.: "Crítico: 6 (máximo) + 1d6 (3) = 9"
export function describeRoll(result) {
  const dice = `${result.count}d${result.sides} (${result.rolls.join(' + ')})`;
  const mod = result.modifier ? ` ${result.modifier > 0 ? '+' : '−'} ${Math.abs(result.modifier)}` : '';
  const base = result.critical ? `Crítico: ${result.bonus} (máximo) + ${dice}` : dice;
  return `${base}${mod} = ${result.total}`;
}
