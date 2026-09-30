// Popup de resultado de rolagem, com animação dos dados girando.
// Só um popup por vez: uma rolagem nova substitui a anterior.
//
//   showRoll(...)        → dano, redução de dano (1 tipo de dado)
//   showDualityRoll(...) → teste de atributo (dado de Esperança + dado de Medo)
//
// actions: [{ label, onClick }] — botões que aparecem depois do resultado
// (ex.: "Ganhar 1 Esperança", "Marcar 1 fissura"). Com ações, o popup não
// fecha sozinho, para dar tempo de decidir.
import { h } from '../dom.js';
import { describeDuality, describeRoll, DUALITY_SIDES } from '../../domain/dice.js';

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

const formatMod = (mod) => (mod > 0 ? `+${mod}` : String(mod));

// Botão de ação: vale um clique só (evita aplicar o efeito duas vezes).
// Se onClick devolver false (ex.: sem Esperança), o botão volta a ficar ativo.
function actionButton({ label, onClick, secondary = false }) {
  const button = h('button', {
    class: secondary ? 'botao botao--pequeno botao--secundario' : 'botao botao--pequeno',
    type: 'button',
    onclick: () => {
      button.disabled = true;
      if (onClick() === false) {
        button.disabled = false;
        return;
      }
      button.textContent = `✓ ${label}`;
    },
  }, label);
  return button;
}

/**
 * Monta e anima o painel.
 * dice: [{ sides, value, className?, caption?, highlightMax? }]
 * message: { title, text, note? } — mostrado junto com o resultado
 */
function openPanel({ title, label, variant = '', dice, before = null, after = null, total, detail, message = null, actions = [] }) {
  close();

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dieEls = dice.map((d) => h('span', { class: `dado dado--d${d.sides} ${d.className ?? ''}` }, '?'));
  const diceWithCaptions = dice.map((d, i) => (d.caption
    ? h('span', { class: 'dado-rotulado' }, dieEls[i], h('span', { class: 'dado-rotulado__legenda' }, d.caption))
    : dieEls[i]));

  const totalEl = h('span', { class: 'rolagem__total' }, '…');
  const detailEl = h('span', { class: 'rolagem__detalhe' });
  const messageEl = h('div', { class: 'rolagem__mensagem', hidden: true });
  const actionsEl = h('div', { class: 'grupo-botoes rolagem__acoes', hidden: true }, actions.map(actionButton));
  // Leitor de tela: anuncia só o resultado final, não os números girando
  const announcer = h('span', { class: 'sr-only', 'aria-live': 'polite' });

  const panel = h('div', { class: `rolagem ${variant}` },
    h('div', { class: 'rolagem__topo' },
      h('div', {},
        h('strong', { class: 'rolagem__titulo' }, title),
        h('span', { class: 'rolagem__rotulo' }, label),
      ),
      h('button', { class: 'rolagem__fechar', type: 'button', 'aria-label': 'Fechar resultado', onclick: close }, '×'),
    ),
    h('div', { class: 'rolagem__corpo' },
      h('div', { class: 'rolagem__dados', 'aria-hidden': 'true' },
        before ? h('span', { class: 'rolagem__bonus' }, before) : null,
        diceWithCaptions,
        after ? h('span', { class: 'rolagem__bonus' }, after) : null,
      ),
      totalEl,
    ),
    messageEl,
    detailEl,
    actionsEl,
    announcer,
  );

  active = { panel, timers: [], interval: null };
  document.body.append(panel);

  // Mostra (ou atualiza) total, cálculo e mensagem
  const showResult = (next) => {
    totalEl.textContent = next.total;
    detailEl.textContent = next.detail;
    if (next.message) {
      messageEl.replaceChildren(
        h('strong', {}, next.message.title),
        h('span', {}, next.message.text),
      );
      if (next.message.note) messageEl.append(h('small', {}, next.message.note));
      messageEl.hidden = false;
    }
    if (next.variant !== undefined) panel.className = `rolagem ${next.variant}`;
    announcer.textContent = [title, label, `Total ${next.total}`, next.message?.title, next.message?.text]
      .filter(Boolean).join('. ');
  };

  const reveal = () => {
    dieEls.forEach((el, i) => {
      el.textContent = dice[i].value;
      el.classList.remove('dado--rolando');
      el.classList.toggle('dado--maximo', Boolean(dice[i].highlightMax) && dice[i].value === dice[i].sides);
    });
    totalEl.classList.add('rolagem__total--revelado');
    showResult({ total, detail, message });
    actionsEl.hidden = actions.length === 0;
    if (!actions.length) active?.timers.push(setTimeout(close, AUTO_CLOSE_MS));
  };

  // Controle devolvido a quem abriu: atualiza o resultado (ex.: Experiência usada)
  const controller = {
    update(next) {
      showResult(next);
      totalEl.classList.remove('rolagem__total--revelado');
      void totalEl.offsetWidth; // reinicia a animação de "pulo" do total
      totalEl.classList.add('rolagem__total--revelado');
    },
  };

  if (reduceMotion) {
    reveal();
    return controller;
  }

  // Números aleatórios só para o efeito visual; o resultado já foi sorteado
  dieEls.forEach((el) => el.classList.add('dado--rolando'));
  active.interval = setInterval(() => {
    dieEls.forEach((el, i) => { el.textContent = 1 + Math.floor(Math.random() * dice[i].sides); });
  }, SPIN_TICK_MS);
  active.timers.push(setTimeout(() => {
    clearInterval(active.interval);
    reveal();
  }, SPIN_MS));
  return controller;
}

// title: ex. "Espada curta"; label: ex. "Dano d6"; result: de rollDice/rollCritical
export function showRoll({ title, label, result, message = null, actions = [] }) {
  openPanel({
    title,
    label,
    variant: result.critical ? 'rolagem--critico' : '',
    dice: result.rolls.map((value) => ({ sides: result.sides, value, highlightMax: true })),
    before: result.critical ? `${result.bonus} +` : null,
    after: result.modifier ? formatMod(result.modifier) : null,
    total: result.total,
    detail: describeRoll(result),
    message,
    actions,
  });
}

const dualityVariant = (result) => {
  const base = result.critical ? 'rolagem--critico' : result.withHope ? 'rolagem--esperanca' : 'rolagem--medo';
  return `${base}${result.success ? '' : ' rolagem--falha'}`;
};

// result: de rollAttributeTest; message: { title, text, note? } do resultado.
// Devolve { update(result, message) } para recalcular (ex.: Experiência usada).
export function showDualityRoll({ title, label, result, message, actions = [] }) {
  // d6 de Vantagem/Desvantagem aparecem ao lado dos dados de dualidade
  const edgeDice = (result.edge?.rolls ?? []).map((value) => ({
    sides: 6,
    value,
    className: result.edge.value > 0 ? 'dado--vantagem' : 'dado--desvantagem',
    caption: result.edge.value > 0 ? 'Vantagem' : 'Desvant.',
  }));

  const panel = openPanel({
    title,
    label,
    variant: dualityVariant(result),
    dice: [
      { sides: DUALITY_SIDES, value: result.hope, className: 'dado--esperanca', caption: 'Esperança' },
      { sides: DUALITY_SIDES, value: result.fear, className: 'dado--medo', caption: 'Medo' },
      ...edgeDice,
    ],
    after: result.modifier ? formatMod(result.modifier) : null,
    total: result.total,
    detail: describeDuality(result),
    message,
    actions,
  });

  return {
    update(next, nextMessage) {
      panel.update({
        total: next.total,
        detail: describeDuality(next),
        message: nextMessage,
        variant: dualityVariant(next),
      });
    },
  };
}
