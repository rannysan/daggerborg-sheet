// Ficha de jogo: consulta rápida + marcar Vida, Estresse, Esperança, Suprimentos,
// fissuras e a condição Vulnerável, e fazer descansos. Tudo salvo sozinho (EditSession).
// Na nuvem, atualiza em tempo real; fichas de outros jogadores abrem só para leitura
// (o Mestre da campanha pode editar).
import { h, showToast } from '../dom.js';
import { emptyState } from '../components/emptyState.js';
import { poolCounter } from '../components/counter.js';
import { pipTrack } from '../components/pipTrack.js';
import { textBlock } from '../components/textBlock.js';
import { selectField } from '../components/fields.js';
import { openDialog } from '../components/dialog.js';
import { classAbilities } from '../components/classAbilities.js';
import { portrait, portraitButton } from '../components/portrait.js';
import { showRoll } from '../components/rollPopup.js';
import { rollCritical, rollDice } from '../../domain/dice.js';
import { EditSession } from '../../services/EditSession.js';
import { ATTRIBUTES, HOPE_MAX, HOPE_START } from '../../domain/rules.js';
import {
  SHORT_REST_MOVES, SHORT_REST_MOVE_COUNT, SHORT_REST_SUPPLY_COST,
  canShortRest, shortRest, longRest,
} from '../../domain/rest.js';
import { findClass, armorPenaltyReduction } from '../../domain/classes.js';
import {
  armorProfile, armorSummary, findArmor, findMaterial, findShield, findWeapon,
  shieldSummary, weaponSummary,
} from '../../domain/equipment.js';
import { normalizeCharacter } from '../../domain/normalize.js';
import { canEditCharacter } from '../../domain/campaign.js';
import { formatModifier } from '../../core/utils.js';

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
  // atualizam sozinhas; só o descanso, que muda vários valores, redesenha tudo.
  #render() {
    const c = this.#session.character;
    this.#outlet.replaceChildren(
      this.#header(c),
      h('div', { class: 'ficha-grade' },
        this.#attributes(c),
        h('div', { class: 'coluna' },
          this.#status(c),
          this.#readOnly ? null : this.#rest(),
          this.#equipment(c),
        ),
      ),
      this.#abilities(c),
      h('section', { class: 'card' },
        h('h2', {}, 'Outros'),
        textBlock('Outros', c.other),
      ),
    );
  }

  #header(c) {
    const className = findClass(this.#gameData.classes, c.classId)?.name ?? 'Sem classe';
    const meta = [className, c.pronouns, c.player && `Jogador(a): ${c.player}`]
      .filter(Boolean)
      .join(' · ');

    const campaign = this.#campaign;
    const mine = !c.ownerId || c.ownerId === this.#campaigns.uid;
    const back = mine || !campaign
      ? h('a', { class: 'botao botao--secundario', href: '#/' }, '← Fichas')
      : h('a', { class: 'botao botao--secundario', href: `#/campanha/${campaign.id}` }, '← Campanha');

    return h('div', { class: 'cabecalho-pagina' },
      h('div', { class: 'identidade' },
        this.#readOnly
          ? portrait(c, { size: 'medio' })
          : portraitButton({
              character: c,
              onPick: (file) => this.#images.toPortrait(file),
              onChange: (value) => this.#update({ portrait: value }),
            }),
        h('div', {},
          h('h1', {}, c.name || 'Sem nome'),
          meta ? h('span', { class: 'ficha-item__meta' }, meta) : null,
          h('div', { class: 'selos' },
            campaign ? h('a', { class: 'selo', href: `#/campanha/${campaign.id}` }, `🎲 ${campaign.name}`) : null,
            this.#readOnly ? h('span', { class: 'selo selo--aviso' }, 'Só leitura') : null,
            !this.#readOnly && !mine ? h('span', { class: 'selo' }, 'Editando como Mestre') : null,
          ),
        ),
      ),
      h('div', { class: 'grupo-botoes' },
        back,
        this.#readOnly ? null : h('a', { class: 'botao', href: `#/editar/${c.id}` }, 'Editar'),
      ),
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

    return h('section', { class: 'card' },
      h('h2', {}, 'Atributos'),
      h('div', { class: 'stats' },
        ATTRIBUTES.map((attr) => h('div', { class: 'stat' },
          h('span', { class: 'stat__rotulo' }, attr.label),
          h('span', { class: 'stat__valor' }, formatModifier(c.attributes[attr.id])),
          h('span', { class: 'stat__dica' }, attr.hint),
          penaltyFor(attr.id)
            ? h('span', { class: 'stat__penalidade' }, `${formatModifier(-penaltyFor(attr.id))} pela armadura`)
            : null,
        )),
      ),
    );
  }

  #status(c) {
    const pool = (key, label) => poolCounter({
      label,
      pool: c[key],
      readOnly: this.#readOnly,
      onChange: (current) => this.#update((s) => ({ [key]: { ...s[key], current } })),
    });

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
    }, 'Vulnerável');

    return h('section', { class: 'card' },
      h('h2', {}, 'Estado'),
      h('div', { class: 'contadores' },
        pool('hp', 'Vida'),
        pool('stress', 'Estresse'),
        pool('supplies', 'Suprimentos'),
      ),
      h('div', { class: 'linha-estado' },
        h('div', {},
          h('h3', { class: 'rotulo' }, `Esperança (máx. ${HOPE_MAX})`),
          pipTrack({
            label: 'Esperança',
            itemLabel: 'Esperança',
            slots: HOPE_MAX,
            marked: c.hope,
            readOnly: this.#readOnly,
            onChange: (hope) => this.#update({ hope }),
          }),
        ),
        h('div', {},
          h('h3', { class: 'rotulo' }, 'Condição'),
          vulnerable,
          h('span', { class: 'campo__dica' }, 'Ataca e se defende com Desvantagem.'),
        ),
      ),
    );
  }

  #rest() {
    return h('section', { class: 'card' },
      h('h2', {}, 'Descanso'),
      h('div', { class: 'grupo-botoes' },
        h('button', { class: 'botao botao--secundario', type: 'button', onclick: () => this.#openShortRest() },
          'Descanso curto'),
        h('button', { class: 'botao botao--secundario', type: 'button', onclick: () => this.#openLongRest() },
          'Descanso longo'),
      ),
    );
  }

  #openShortRest() {
    const character = this.#session.character;
    if (!canShortRest(character)) {
      showToast(`Você precisa de ${SHORT_REST_SUPPLY_COST} suprimento para o descanso curto.`);
      return;
    }

    const options = SHORT_REST_MOVES.map((m) => ({ value: m.id, label: m.label }));
    const chosen = SHORT_REST_MOVES.slice(0, SHORT_REST_MOVE_COUNT).map((m) => m.id);

    openDialog({
      title: 'Descanso curto',
      confirmLabel: 'Descansar',
      content: [
        h('p', {}, `Gasta ${SHORT_REST_SUPPLY_COST} suprimento (você tem ${character.supplies.current}). ` +
          `Escolha ${SHORT_REST_MOVE_COUNT} movimentos; pode repetir. Tudo arredonda para cima.`),
        chosen.map((id, i) => selectField({
          label: `Movimento ${i + 1}`,
          value: id,
          options,
          onChange: (value) => { chosen[i] = value; },
        })),
        h('p', { class: 'campo__dica' }, GM_FEAR_REMINDER),
      ],
      onConfirm: () => this.#applyRest(() => shortRest(this.#session.character, chosen), 'Descanso curto feito.'),
    });
  }

  #openLongRest() {
    openDialog({
      title: 'Descanso longo',
      confirmLabel: 'Descansar',
      content: [
        h('p', {}, 'Só no Refúgio, entre missões. Cura toda a Vida e o Estresse, conserta a armadura ' +
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

    return h('section', { class: 'card' },
      h('h2', {}, 'Equipamento'),
      textBlock('Mão principal', mainText),
      main ? this.#damageButtons(main) : null,
      textBlock('Mão secundária', offText),
      offWeapon && main?.hands !== 2 ? this.#damageButtons(offWeapon) : null,
      shield ? this.#fissures({ title: 'Fissuras do escudo', key: 'shield', slots: shield.slots }) : null,
      textBlock('Armadura', armorText),
      profile
        ? this.#fissures({ title: 'Fissuras da armadura', key: 'armor', slots: profile.slots, brokenLabel: 'Estragada' })
        : null,
    );
  }

  // Botões de rolagem de dano da arma: normal e Sucesso Crítico (máximo + rolagem)
  #damageButtons(weapon) {
    const label = `${weapon.direct ? 'Dano direto' : 'Dano'} ${weapon.damage}`;
    const roll = (critical) => showRoll({
      title: weapon.name,
      label: critical ? `Crítico · ${label}` : label,
      result: critical ? rollCritical(weapon.damage) : rollDice(weapon.damage),
    });

    return h('div', { class: 'grupo-botoes botoes-dano' },
      h('button', { class: 'botao botao--pequeno botao--dano', type: 'button', onclick: () => roll(false) },
        `🎲 ${label}`),
      h('button', {
        class: 'botao botao--pequeno botao--secundario',
        type: 'button',
        title: 'Sucesso Crítico: dano máximo da arma + uma rolagem',
        onclick: () => roll(true),
      }, 'Crítico'),
    );
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

    return h('section', { class: 'card' },
      h('h2', {}, cls ? `Habilidades · ${cls.name}` : 'Habilidades'),
      textBlock('Experiências', experiences),
      cls
        ? classAbilities(cls, { tier: c.tier })
        : h('p', { class: 'campo__dica' }, 'Escolha uma classe em Editar para ver as habilidades.'),
    );
  }
}
