// Popup de resultado de rolagem, com animação dos dados girando.
// Só um popup por vez: uma rolagem nova substitui a anterior.
import { h } from '../dom.js';
import { describeRoll } from '../../domain/dice.js';

const SPIN_MS = 700;
const SPIN_TICK_MS = 70;
const AUTO_CLOSE_MS = 10000;

let active = null; // { panel, timers: [], interval }

function close() {
  if (!active) return;
  active.timers.forEach(clearTimeout);
  clearInterval(active.interval);
  active.panel.remove();
  active = null;
}

// title: ex. "Espada curta"; label: ex. "Dano d6"; result: de rollDice/rollCritical
export function showRoll({ title, label, result }) {
  close();

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dice = result.rolls.map(() => h('span', { class: `dado dado--d${result.sides}` }, '?'));
  const total = h('span', { class: 'rolagem__total' }, '…');
  const detail = h('span', { class: 'rolagem__detalhe' });
  // Leitor de tela: anuncia só o resultado final, não os números girando
  const announcer = h('span', { class: 'sr-only', 'aria-live': 'polite' });

  const panel = h('div', { class: result.critical ? 'rolagem rolagem--critico' : 'rolagem' },
    h('div', { class: 'rolagem__topo' },
      h('div', {},
        h('strong', { class: 'rolagem__titulo' }, title),
        h('span', { class: 'rolagem__rotulo' }, label),
      ),
      h('button', { class: 'rolagem__fechar', type: 'button', 'aria-label': 'Fechar resultado', onclick: close }, '×'),
    ),
    h('div', { class: 'rolagem__corpo' },
      h('div', { class: 'rolagem__dados', 'aria-hidden': 'true' },
        result.critical ? h('span', { class: 'rolagem__bonus' }, `${result.bonus} +`) : null,
        dice,
        result.modifier ? h('span', { class: 'rolagem__bonus' }, result.modifier > 0 ? `+${result.modifier}` : String(result.modifier)) : null,
      ),
      total,
    ),
    detail,
    announcer,
  );

  active = { panel, timers: [], interval: null };
  document.body.append(panel);

  const reveal = () => {
    dice.forEach((die, i) => {
      die.textContent = result.rolls[i];
      die.classList.remove('dado--rolando');
      die.classList.toggle('dado--maximo', result.rolls[i] === result.sides);
    });
    total.textContent = result.total;
    total.classList.add('rolagem__total--revelado');
    detail.textContent = describeRoll(result);
    announcer.textContent = `${title}, ${label}: ${result.total}. ${describeRoll(result)}`;
    active?.timers.push(setTimeout(close, AUTO_CLOSE_MS));
  };

  if (reduceMotion) {
    reveal();
    return;
  }

  // Números aleatórios só para o efeito visual; o resultado já foi sorteado
  dice.forEach((die) => die.classList.add('dado--rolando'));
  active.interval = setInterval(() => {
    dice.forEach((die) => { die.textContent = 1 + Math.floor(Math.random() * result.sides); });
  }, SPIN_TICK_MS);
  active.timers.push(setTimeout(() => {
    clearInterval(active.interval);
    reveal();
  }, SPIN_MS));
}
