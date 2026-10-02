// Ficha de jogo: consulta rápida + marcar Vida, Estresse, Esperança, Suprimentos,
// fissuras e a condição Vulnerável, e fazer descansos. Tudo salvo sozinho (EditSession).
// Na nuvem, atualiza em tempo real; fichas de outros jogadores abrem só para leitura
// (o Mestre da campanha pode editar).
import { h, append, showToast } from '../dom.js';
import { icon } from '../icons.js';
import { setShellBack, setShellTitle } from '../shell.js';
import { emptyState } from '../components/emptyState.js';
import { poolCounter } from '../components/counter.js';
import { pipTrack } from '../components/pipTrack.js';
import { textBlock } from '../components/textBlock.js';
import { openDialog } from '../components/dialog.js';
import { classAbilities, costIcon, costLegend } from '../components/classAbilities.js';
import { portrait, portraitButton } from '../components/portrait.js';
import { showDualityRoll, showRoll } from '../components/rollPopup.js';
import { counter } from '../components/counter.js';
import { addDamageExtra, rollCritical, rollDice, withArea } from '../../domain/dice.js';
import { canAfford, costText, payCost, resolveEffect, rollActionsFor } from '../../domain/classActions.js';
import {
  DUALITY_OUTCOMES, EDGE_MAX_SOURCES, EXPERIENCE_HOPE_COST, REACTION_NOTE, addBonus, addExperience,
  applyDualityEffect, attributeTestModifier, effectChangesCharacter, rollAttributeTest,
} from '../../domain/duality.js';
import { EditSession } from '../../services/EditSession.js';
import { ATTRIBUTES, HOPE_MAX, HOPE_START } from '../../domain/rules.js';
import {
  SHORT_REST_MOVES, SHORT_REST_MOVE_COUNT, SHORT_REST_MOVE_MIN, SHORT_REST_SUPPLY_COST,
  canShortRest, shortRest, longRest,
} from '../../domain/rest.js';
import { findClass, armorPenaltyReduction } from '../../domain/classes.js';
import {
  armorProfile, armorSummary, findArmor, findMaterial, findShield, findWeapon, findWeaponGroup, formatRd,
  shieldSummary, weaponSummary,
} from '../../domain/equipment.js';
import { normalizeCharacter } from '../../domain/normalize.js';
import { canEditCharacter } from '../../domain/campaign.js';
import { formatModifier } from '../../core/utils.js';

// Abas da ficha no celular (no desktop as seções ficam lado a lado)
const SHEET_TABS = Object.freeze([
  { id: 'atributos', label: 'Atributos', icon: 'dices' },
  { id: 'estado', label: 'Estado', icon: 'heart' },
  { id: 'equipamento', label: 'Equipamento', icon: 'sword' },
  { id: 'habilidades', label: 'Habilidades', icon: 'book-open' },
]);

const GM_FEAR_REMINDER = 'Lembrete: o Mestre ganha 1 Medo por personagem que descansa.';

export class SheetPage {
  #characters;
  #campaigns;
  #gameData;
  #images;
  #session = null;
  #outlet = null;
  #destroyed = false;
  #readOnly = false;
  #campaign = null;
  #unwatch = null;
  #tab = SHEET_TABS[0].id; // aba aberta (mantida ao redesenhar)

  constructor({ characters, campaigns, gameData, images }) {
    this.#characters = characters;
    this.#campaigns = campaigns;
    this.#gameData = gameData;
    this.#images = images;
  }

  async mount(outlet, { id }) {
    this.#outlet = outlet;
    const character = await this.#characters.get(id);
    if (this.#destroyed) return;

    if (!character) {
      outlet.append(emptyState('Ficha não encontrada.', { href: '#/', label: 'Voltar para as fichas' }));
      return;
    }

    // Campanha da ficha: para o selo e para saber se sou o Mestre dela
    if (character.campaignId && this.#campaigns.available) {
      this.#campaign = await this.#campaigns.get(character.campaignId).catch(() => null);
      if (this.#destroyed) return;
    }
    this.#readOnly = !canEditCharacter(character, { uid: this.#campaigns.uid, campaign: this.#campaign });

    this.#session = new EditSession(this.#characters, character, {
      onError: () => showToast('Não foi possível salvar a ficha.'),
      normalize: (c) => normalizeCharacter(c, this.#gameData),
    });
    this.#render();

    // Tempo real: mudanças do Mestre/jogador em outro aparelho aparecem aqui
    this.#unwatch = this.#characters.watch(id, (remote) => {
      const before = JSON.stringify(this.#session.character);
      this.#session.applyRemote(remote);
      if (JSON.stringify(this.#session.character) !== before) this.#render();
    });
  }

  unmount() {
    this.#destroyed = true;
    this.#unwatch?.();
    // Só leitura: nada a salvar (e evita gravar sem permissão)
    if (this.#readOnly) return;
    this.#session?.dispose();
  }

  #update(patch) {
    this.#session.update(patch);
  }

  // Desenha a ficha inteira. Marcações do dia a dia (contadores, trilhas) se
  // atualizam sozinhas; só o descanso e o tempo real redesenham tudo.
  //
  // Celular: topo "herói" (retrato + Vida/Estresse/Esperança sempre à vista) e
  // as seções em abas. Desktop: as quatro seções lado a lado, sem abas.
  #render() {
    const c = this.#session.character;
    const mine = !c.ownerId || c.ownerId === this.#campaigns.uid;

    // Barra superior: nome da ficha; ficha de outra pessoa volta para a campanha
    setShellTitle(c.name || 'Ficha');
    setShellBack(!mine && this.#campaign ? `/campanha/${this.#campaign.id}` : '/');

    this.#outlet.replaceChildren();
    append(this.#outlet,
      this.#hero(c, mine),
      this.#tabBar(),
      h('div', { class: 'ficha-paineis' },
        this.#panel('atributos', 'Atributos', this.#attributes(c)),
        this.#panel('estado', 'Estado', this.#status(c)),
        this.#panel('equipamento', 'Equipamento', this.#equipment(c)),
        this.#panel('habilidades', 'Habilidades', this.#abilities(c)),
      ),
    );
  }

  // Topo: retrato, nome, classe, selos e os recursos mais usados na mesa
  #hero(c, mine) {
    const className = findClass(this.#gameData.classes, c.classId)?.name ?? 'Sem classe';
    const meta = [className, c.pronouns, c.player && `Jogador(a): ${c.player}`].filter(Boolean).join(' · ');
    const campaign = this.#campaign;

    const pool = (key, label, labelIcon = null) => poolCounter({
      label,
      labelIcon,
      pool: c[key],
      readOnly: this.#readOnly,
      onChange: (current) => this.#update((s) => ({ [key]: { ...s[key], current } })),
    });

    return h('section', { class: 'card ficha-heroi' },
      h('div', { class: 'ficha-heroi__topo' },
        this.#readOnly
          ? portrait(c, { size: 'medio' })
          : portraitButton({
              character: c,
              onPick: (file) => this.#images.toPortrait(file),
              onChange: (value) => this.#update({ portrait: value }),
            }),
        h('div', { class: 'ficha-heroi__identidade' },
          h('h1', {}, c.name || 'Sem nome'),
          meta ? h('span', { class: 'ficha-item__meta' }, meta) : null,
          h('div', { class: 'selos' },
            campaign ? h('a', { class: 'selo', href: `#/campanha/${campaign.id}` }, icon('users'), campaign.name) : null,
            this.#readOnly ? h('span', { class: 'selo selo--aviso' }, icon('lock'), 'Só leitura') : null,
            !this.#readOnly && !mine ? h('span', { class: 'selo' }, 'Editando como Mestre') : null,
          ),
        ),
        this.#readOnly
          ? null
          : h('a', { class: 'botao-icone ficha-heroi__editar', href: `#/editar/${c.id}`, 'aria-label': 'Editar ficha', title: 'Editar ficha' },
              icon('pencil')),
      ),
      h('div', { class: 'ficha-vitais' },
        pool('hp', 'Vida'),
        pool('stress', 'Estresse', costIcon('stress')),
        h('div', { class: 'ficha-vitais__esperanca' },
          h('span', { class: 'contador__rotulo' }, costIcon('hope'), 'Esperança'),
          pipTrack({
            label: 'Esperança',
            itemLabel: 'Esperança',
            slots: HOPE_MAX,
            marked: c.hope,
            readOnly: this.#readOnly,
            onChange: (hope) => this.#update({ hope }),
          }),
        ),
      ),
    );
  }

  // Abas (só aparecem no celular). Trocar de aba não redesenha: só mostra/esconde.
  #tabBar() {
    const bar = h('div', { class: 'abas-ficha', role: 'tablist', 'aria-label': 'Seções da ficha' },
      SHEET_TABS.map((tab) => h('button', {
        class: 'abas-ficha__item',
        type: 'button',
        role: 'tab',
        id: `aba-${tab.id}`,
        'aria-controls': `painel-${tab.id}`,
        'aria-selected': String(tab.id === this.#tab),
        onclick: () => this.#selectTab(tab.id),
      }, icon(tab.icon), h('span', {}, tab.label))),
    );
    return bar;
  }

  #selectTab(id) {
    this.#tab = id;
    this.#outlet.querySelectorAll('.abas-ficha__item').forEach((el) => {
      el.setAttribute('aria-selected', String(el.id === `aba-${id}`));
    });
    this.#outlet.querySelectorAll('.ficha-painel').forEach((el) => {
      el.classList.toggle('ficha-painel--ativo', el.id === `painel-${id}`);
    });
  }

  #panel(id, title, ...content) {
    return h('section', {
      class: id === this.#tab ? 'card ficha-painel ficha-painel--ativo' : 'card ficha-painel',
      id: `painel-${id}`,
      role: 'tabpanel',
      'aria-labelledby': `aba-${id}`,
    },
      h('h2', { class: 'ficha-painel__titulo' }, title),
      content,
    );
  }

  // Armadura equipada com material e redução da classe, ou null
  #armorProfile(c) {
    const { equipment, classes } = this.#gameData;
    const armor = findArmor(equipment, c.armor.id);
    if (!armor) return null;
    const material = findMaterial(equipment, c.armor.materialId);
    return armorProfile(armor, material, armorPenaltyReduction(findClass(classes, c.classId)));
  }

  #attributes(c) {
    const profile = this.#armorProfile(c);
    const penaltyFor = (id) => (profile?.penaltyAttributes.includes(id) ? profile.penalty : 0);

    // Grade 2×2: valor grande e o botão de rolar ocupando a largura do cartão
    return h('div', { class: 'atributos' },
      ATTRIBUTES.map((attr) => h('div', { class: 'atributo' },
        h('span', { class: 'atributo__rotulo' }, attr.label),
        h('span', { class: 'atributo__valor' }, formatModifier(c.attributes[attr.id])),
        penaltyFor(attr.id)
          ? h('span', { class: 'stat__penalidade' }, `${formatModifier(-penaltyFor(attr.id))} pela armadura`)
          : null,
        h('span', { class: 'atributo__dica' }, attr.hint),
        h('button', {
          class: 'botao atributo__rolar',
          type: 'button',
          'aria-label': `Rolar teste de ${attr.label}`,
          onclick: () => this.#openRollOptions(attr, penaltyFor(attr.id)),
        }, icon('dices'), 'Rolar'),
      )),
    );
  }

  // Antes de rolar: fontes de Vantagem/Desvantagem
  #openRollOptions(attr, penalty) {
    const c = this.#session.character;
    const edge = { advantage: 0, disadvantage: c.vulnerable ? 1 : 0 };

    const pick = (key, label) => counter({
      label,
      value: edge[key],
      min: 0,
      max: EDGE_MAX_SOURCES,
      onChange: (value) => { edge[key] = value; },
    }).element;

    openDialog({
      title: `Teste de ${attr.label}`,
      confirmLabel: [icon('dices'), 'Rolar'],
      focusConfirm: true, // rolagem simples: clicar em Rolar e apertar Enter
      content: [
        h('div', { class: 'opcoes-teste' },
          h('h3', { class: 'rotulo' }, 'Vantagem e Desvantagem'),
          h('p', { class: 'campo__dica' }, 'Cada fonte é 1d6 somado (Vantagem) ou subtraído (Desvantagem). '
            + 'Com várias, vale só o maior dado; Vantagens e Desvantagens se compensam.'),
          c.vulnerable
            ? h('p', { class: 'campo__dica' }, 'Você está Vulnerável: ataques e defesas já vêm com 1 Desvantagem.')
            : null,
          h('div', { class: 'contadores' }, pick('advantage', 'Vantagem (+d6)'), pick('disadvantage', 'Desvantagem (−d6)')),
        ),
      ],
      onConfirm: () => this.#rollAttribute(attr, penalty, edge),
    });
  }

  // Teste de atributo: dualidade (Esperança x Medo) + atributo − penalidade da armadura,
  // com Vantagem/Desvantagem opcional. Depois da rolagem, o popup oferece as
  // Experiências (1 Esperança cada, recalcula o resultado) e o efeito do resultado
  // (ganhar Esperança, crítico) — como botões, porque numa Reação não se aplicam.
  #rollAttribute(attr, penalty, edge = {}) {
    const c = this.#session.character;
    let result = rollAttributeTest(attributeTestModifier(c, attr.id, penalty), edge);

    const messageFor = (r) => {
      const outcome = DUALITY_OUTCOMES[r.outcome];
      const notes = [];
      if (c.vulnerable && !edge.disadvantage) notes.push('Você está Vulnerável: ataques e defesas têm Desvantagem (marque ao rolar).');
      if (attr.id === 'agility') notes.push(REACTION_NOTE);
      return { title: outcome.title, text: outcome.text, note: notes.join(' ') || null };
    };

    const actions = [];
    const outcome = DUALITY_OUTCOMES[result.outcome];
    if (!this.#readOnly && outcome.effect) {
      actions.push({
        label: result.critical ? 'Aplicar o crítico na ficha' : 'Ganhar 1 Esperança',
        onClick: () => {
          const current = this.#session.character;
          if (!effectChangesCharacter(current, outcome.effect)) {
            showToast('Nada a aplicar: Esperança no máximo e nada para curar.');
            return false;
          }
          this.#update((s) => applyDualityEffect(s, outcome.effect));
          this.#render();
          return true;
        },
      });
    }

    // Habilidades da classe neste teste (ex.: Esquiva do Especialista na Agilidade)
    const cls = findClass(this.#gameData.classes, c.classId);
    for (const action of rollActionsFor(cls, { roll: 'attribute', attribute: attr.id })) {
      if (this.#readOnly && action.cost?.length) continue; // só leitura: nada que gaste recurso
      actions.push(this.#classAction(action, {
        onResolved: (effect) => {
          result = addBonus(result, { name: action.name, value: effect.value, detail: effect.detail });
          popup.update(result, messageFor(result));
        },
      }));
    }

    // Experiências, depois da rolagem: gasta 1 Esperança, soma o bônus e recalcula
    if (!this.#readOnly) {
      for (const experience of c.experiences.filter((e) => e.name.trim())) {
        actions.push({
          label: `Usar ${experience.name} (${formatModifier(experience.bonus)}) · ${EXPERIENCE_HOPE_COST} Esperança`,
          secondary: true,
          onClick: () => {
            if (this.#session.character.hope < EXPERIENCE_HOPE_COST) {
              showToast('Sem Esperança para usar a Experiência.');
              return false;
            }
            this.#update((s) => ({ hope: s.hope - EXPERIENCE_HOPE_COST }));
            result = addExperience(result, experience);
            popup.update(result, messageFor(result));
            this.#render();
            return true;
          },
        });
      }
    }

    const base = c.attributes[attr.id];
    const parts = [`${attr.label} ${formatModifier(base)}`];
    if (penalty) parts.push(`armadura −${penalty}`);
    if (result.edge) parts.push(result.edge.value > 0 ? 'com Vantagem' : 'com Desvantagem');

    const popup = showDualityRoll({
      title: `Teste de ${attr.label}`,
      label: parts.join(', '),
      result,
      message: messageFor(result),
      actions,
    });
  }

  // Estado: suprimentos, condição e descansos (Vida, Estresse e Esperança ficam no topo)
  #status(c) {
    const vulnerable = h('button', {
      class: 'botao botao--secundario alternar',
      type: 'button',
      disabled: this.#readOnly,
      'aria-pressed': String(c.vulnerable),
      onclick: () => {
        const next = vulnerable.getAttribute('aria-pressed') !== 'true';
        vulnerable.setAttribute('aria-pressed', String(next));
        this.#update({ vulnerable: next });
      },
    }, icon('flame'), 'Vulnerável');

    return [
      h('div', { class: 'contadores' },
        poolCounter({
          label: 'Suprimentos',
          pool: c.supplies,
          readOnly: this.#readOnly,
          onChange: (current) => this.#update((s) => ({ supplies: { ...s.supplies, current } })),
        }),
      ),
      h('div', { class: 'bloco-estado' },
        h('h3', { class: 'rotulo' }, 'Condição'),
        vulnerable,
        h('span', { class: 'campo__dica' }, 'Vulnerável: ataca e se defende com Desvantagem.'),
      ),
      this.#readOnly ? null : h('div', { class: 'bloco-estado' },
        h('h3', { class: 'rotulo' }, 'Descanso'),
        h('div', { class: 'grupo-botoes grupo-botoes--cheio' },
          h('button', { class: 'botao botao--secundario', type: 'button', onclick: () => this.#openShortRest() },
            icon('sparkles'), 'Descanso curto'),
          h('button', { class: 'botao botao--secundario', type: 'button', onclick: () => this.#openLongRest() },
            icon('moon'), 'Descanso longo'),
        ),
      ),
    ];
  }

  #openShortRest() {
    const character = this.#session.character;
    if (!canShortRest(character)) {
      showToast(`Você precisa de ${SHORT_REST_SUPPLY_COST} suprimento para o descanso curto.`);
      return;
    }

    // Todos os movimentos à vista, cada um com − e + (pode repetir o mesmo)
    const counts = Object.fromEntries(SHORT_REST_MOVES.map((m) => [m.id, 0]));
    const chosenCount = () => Object.values(counts).reduce((a, b) => a + b, 0);
    const status = h('p', { class: 'pontos', 'aria-live': 'polite' });

    const pickers = SHORT_REST_MOVES.map((move) => counter({
      label: move.label,
      value: 0,
      min: 0,
      max: SHORT_REST_MOVE_COUNT,
      canIncrease: () => chosenCount() < SHORT_REST_MOVE_COUNT,
      onChange: (value) => {
        counts[move.id] = value;
        refresh();
      },
    }));

    function refresh() {
      const n = chosenCount();
      status.textContent = `Escolhidos: ${n} de até ${SHORT_REST_MOVE_COUNT}`;
      status.classList.toggle('pontos--completo', n >= SHORT_REST_MOVE_MIN);
      pickers.forEach((p) => p.refresh());
    }
    refresh();

    openDialog({
      title: 'Descanso curto',
      confirmLabel: 'Descansar',
      content: [
        h('p', {}, `Gasta ${SHORT_REST_SUPPLY_COST} suprimento (você tem ${character.supplies.current}). ` +
          `Escolha até ${SHORT_REST_MOVE_COUNT} movimentos (pode fazer só 1, ou repetir o mesmo). Tudo arredonda para cima.`),
        status,
        h('div', { class: 'movimentos' }, pickers.map((p) => p.element)),
        h('p', { class: 'campo__dica' }, GM_FEAR_REMINDER),
      ],
      onConfirm: () => {
        const chosen = SHORT_REST_MOVES.flatMap((m) => Array(counts[m.id]).fill(m.id));
        if (chosen.length < SHORT_REST_MOVE_MIN) {
          showToast('Escolha pelo menos 1 movimento.');
          return false; // mantém o diálogo aberto
        }
        this.#applyRest(() => shortRest(this.#session.character, chosen), 'Descanso curto feito.');
        return true;
      },
    });
  }

  #openLongRest() {
    openDialog({
      title: 'Descanso longo',
      confirmLabel: 'Descansar',
      content: [
        h('p', {}, 'Só no Refúgio, entre missões. Recupera toda a Vida e todo o Estresse, conserta a armadura ' +
          `e o escudo, remove Vulnerável e deixa a Esperança em ${HOPE_START}.`),
        h('p', { class: 'campo__dica' }, GM_FEAR_REMINDER),
      ],
      onConfirm: () => this.#applyRest(() => longRest(this.#session.character), 'Descanso longo feito.'),
    });
  }

  #applyRest(rest, message) {
    try {
      this.#session.update(rest());
      this.#render();
      showToast(message);
    } catch (erro) {
      showToast(erro.message);
    }
  }

  #equipment(c) {
    const eq = this.#gameData.equipment;
    const main = findWeapon(eq, c.mainHand);
    const offWeapon = findWeapon(eq, c.offHand);
    const shield = findShield(eq, c.offHand);
    const armor = findArmor(eq, c.armor.id);
    const material = findMaterial(eq, c.armor.materialId);
    const profile = this.#armorProfile(c);

    const mainText = main ? `${main.name}\n${weaponSummary(eq, main)}` : '';
    const offText = main?.hands === 2 ? '(ocupada pela arma de 2 mãos)'
      : offWeapon ? `${offWeapon.name}\n${weaponSummary(eq, offWeapon)}`
      : shield ? `${shield.name}\n${shieldSummary(shield)}`
      : '';
    const armorText = armor
      ? `${armor.name}${material ? ` · ${material.name}` : ''}\n${armorSummary(profile)}`
      : '';

    // Um bloco por item (texto + botões + marcadores), separados por uma linha
    return [
      subsection(
        textBlock('Mão principal', mainText),
        main ? this.#damageButtons(main) : null,
      ),
      subsection(
        textBlock('Mão secundária', offText),
        offWeapon && main?.hands !== 2 ? this.#damageButtons(offWeapon) : null,
        shield ? this.#fissures({ title: 'Fissuras do escudo', key: 'shield', slots: shield.slots }) : null,
      ),
      subsection(
        textBlock('Armadura', armorText),
        profile?.rd.sides ? this.#armorRollButton(armor, profile) : null,
        profile
          ? this.#fissures({ title: 'Fissuras da armadura', key: 'armor', slots: profile.slots, brokenLabel: 'Estragada' })
          : null,
      ),
    ];
  }

  // Armadura com redução de dano em dados (ex.: 1d4, 2d6). RD fixa não precisa rolar.
  #armorRollButton(armor, profile) {
    const broken = this.#session.character.armor.marked >= profile.slots;
    return h('div', { class: 'grupo-botoes botoes-dano' },
      h('button', {
        class: 'botao botao--pequeno botao--secundario',
        type: 'button',
        disabled: broken,
        title: broken ? 'Armadura estragada: precisa ser restaurada antes de usar' : 'Rolar a redução de dano da armadura',
        onclick: () => this.#rollArmor(armor, profile),
      }, icon('shield'), broken ? 'Armadura estragada' : `Reduzir dano ${formatRd(profile.rd)}`),
    );
  }

  #rollArmor(armor, profile) {
    const c = this.#session.character;
    const rd = formatRd(profile.rd);

    // Regra: depois de usar a armadura, ela recebe uma fissura
    const actions = !this.#readOnly && c.armor.marked < profile.slots
      ? [{
          label: 'Marcar 1 fissura',
          onClick: () => {
            this.#update((s) => ({ armor: { ...s.armor, marked: Math.min(profile.slots, s.armor.marked + 1) } }));
            this.#render();
          },
        }]
      : [];

    showRoll({
      title: armor.name,
      label: `Redução de dano ${rd}`,
      result: rollDice(rd),
      message: {
        title: 'Subtraia do dano recebido',
        text: profile.halvesDamage ? 'Armadura Mágica: o dano que passar ainda é reduzido pela metade.' : '',
        note: 'Depois de usar a armadura, ela recebe uma fissura.',
      },
      actions,
    });
  }

  // Botões de rolagem de dano da arma: normal e Sucesso Crítico (máximo + rolagem)
  #damageButtons(weapon) {
    const label = `${weapon.direct ? 'Dano direto' : 'Dano'} ${weapon.damage}`;
    const weaponAttribute = findWeaponGroup(this.#gameData.equipment, weapon.group)?.attribute;

    const roll = (critical) => {
      let result = critical ? rollCritical(weapon.damage) : rollDice(weapon.damage);

      // Habilidades da classe no dano (ex.: Escondido +1d6, Ataque Poderoso, Expandir)
      const cls = findClass(this.#gameData.classes, this.#session.character.classId);
      const actions = rollActionsFor(cls, { roll: 'damage', attribute: weaponAttribute })
        .filter((action) => !(this.#readOnly && action.cost?.length))
        .map((action) => this.#classAction(action, {
          critical,
          onResolved: (effect) => {
            if (effect.area) {
              const { extraTargets, detail } = effect.area;
              result = withArea(result, { name: action.name, extraTargets, detail });
              popup.update(result, {
                title: `${action.name}: ${1 + extraTargets} alvos`,
                text: `O alvo + ${extraTargets} adicionais (${detail}). Cada um recebe metade do dano.`,
              });
            } else {
              result = addDamageExtra(result, { name: action.name, value: effect.value, detail: effect.detail });
              popup.update(result, { title: `${action.name}: +${effect.value}`, text: effect.detail });
            }
          },
        }));

      const popup = showRoll({
        title: weapon.name,
        label: critical ? `Crítico · ${label}` : label,
        result,
        actions,
      });
    };

    return h('div', { class: 'grupo-botoes botoes-dano' },
      h('button', { class: 'botao botao--pequeno botao--dano', type: 'button', onclick: () => roll(false) },
        icon('swords'), label),
      h('button', {
        class: 'botao botao--pequeno botao--secundario',
        type: 'button',
        title: 'Sucesso Crítico: dano máximo da arma + uma rolagem',
        onclick: () => roll(true),
      }, 'Crítico'),
    );
  }

  // Ação de classe como botão do popup: confere e paga o custo, resolve o efeito
  // e entrega o resultado para quem chamou recalcular a rolagem.
  #classAction(action, { critical = false, onResolved }) {
    const cost = action.cost ?? [];
    return {
      label: cost.length ? `${action.label} · ${costText(cost)}` : action.label,
      secondary: true,
      onClick: () => {
        const current = this.#session.character;
        if (cost.length && !canAfford(current, cost)) {
          showToast(`Sem ${costText(cost)} para usar ${action.name}.`);
          return false; // o botão volta a ficar ativo
        }
        const effect = resolveEffect(action.effect, { character: current, critical });
        if (cost.length) {
          this.#update((s) => payCost(s, cost));
          this.#render();
        }
        onResolved(effect);
        return true;
      },
    };
  }

  #fissures({ title, key, slots, brokenLabel = null }) {
    const marked = this.#session.character[key].marked;
    const brokenEl = brokenLabel
      ? h('span', { class: 'aviso', hidden: marked < slots }, brokenLabel)
      : null;

    return h('div', { class: 'trilha' },
      h('div', { class: 'linha-rotulo' },
        h('h3', { class: 'rotulo' }, title),
        brokenEl,
      ),
      pipTrack({
        label: title,
        itemLabel: 'Fissura',
        slots,
        marked,
        shape: 'escudo',
        readOnly: this.#readOnly,
        onChange: (next) => {
          if (brokenEl) brokenEl.hidden = next < slots;
          this.#update((s) => ({ [key]: { ...s[key], marked: next } }));
        },
      }),
    );
  }

  #abilities(c) {
    const experiences = c.experiences
      .filter((e) => e.name.trim())
      .map((e) => `${e.name} (${formatModifier(e.bonus)})`)
      .join('\n');

    const cls = findClass(this.#gameData.classes, c.classId);

    // Experiências │ Habilidades de classe (com a legenda) │ Passiva │ Outros
    return [
      subsection(textBlock('Experiências', experiences)),
      cls
        ? subsection(costLegend(), classAbilities(cls, { tier: c.tier }))
        : subsection(h('p', { class: 'campo__dica' }, 'Escolha uma classe em Editar para ver as habilidades.')),
      subsection(textBlock('Outros', c.other)),
    ];
  }
}

// Bloco de uma seção da ficha; blocos seguidos ganham uma linha divisória
function subsection(...children) {
  return h('div', { class: 'subsecao' }, children);
}
