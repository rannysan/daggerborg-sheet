// Campanha: #/campanha/:id — informações, membros, convite e os personagens de
// todos, atualizados em tempo real (o Mestre vê na hora quem tomou dano).
import { h, showToast } from '../dom.js';
import { emptyState } from '../components/emptyState.js';
import { openDialog } from '../components/dialog.js';
import { openCampaignDialog } from '../components/campaignDialog.js';
import { selectField } from '../components/fields.js';
import { portrait } from '../components/portrait.js';
import { isMaster, isMember, memberName } from '../../domain/campaign.js';
import { findClass } from '../../domain/classes.js';
import { HOPE_MAX } from '../../domain/rules.js';

export class CampaignPage {
  #campaigns;
  #characters;
  #profile;
  #router;
  #gameData;

  #campaign = null;
  #roster = []; // fichas da campanha
  #portraits = new Map(); // id → Promise<data URL|null> (busca uma vez só)
  #infoEl = h('div');
  #rosterEl = h('div');
  #stops = [];
  #destroyed = false;

  constructor({ campaigns, characters, profile, router, gameData }) {
    this.#campaigns = campaigns;
    this.#characters = characters;
    this.#profile = profile;
    this.#router = router;
    this.#gameData = gameData;
  }

  get #uid() {
    return this.#campaigns.uid;
  }

  get #master() {
    return isMaster(this.#campaign, this.#uid);
  }

  async mount(outlet, { id }) {
    if (!this.#campaigns.available) {
      outlet.append(emptyState('Entre com sua conta Google para ver campanhas.'));
      return;
    }

    try {
      this.#campaign = await this.#campaigns.get(id);
    } catch (erro) {
      console.error('[Campanha]', erro);
      outlet.append(emptyState('Não foi possível abrir a campanha. Verifique a conexão.'));
      return;
    }
    if (this.#destroyed) return;

    if (!this.#campaign) {
      outlet.append(emptyState('Campanha não encontrada.', { href: '#/campanhas', label: 'Ver minhas campanhas' }));
      return;
    }
    if (!isMember(this.#campaign, this.#uid)) {
      this.#router.navigate(`/entrar/${id}`, { replace: true });
      return;
    }

    outlet.append(this.#infoEl, this.#rosterEl);
    this.#renderInfo();
    this.#renderRoster();

    const onError = (erro) => {
      console.error('[Campanha] Tempo real:', erro);
      showToast('Conexão com a campanha interrompida.');
    };

    // Tempo real: dados da campanha (nome, membros) e fichas vinculadas
    this.#stops.push(this.#campaigns.watch(id, (campaign) => {
      if (!campaign || !isMember(campaign, this.#uid)) {
        showToast(campaign ? 'Você não participa mais desta campanha.' : 'Esta campanha foi excluída.');
        this.#router.navigate('/campanhas');
        return;
      }
      this.#campaign = campaign;
      this.#renderInfo();
      this.#renderRoster();
    }, onError));

    this.#stops.push(this.#characters.watchCampaign(id, (roster) => {
      this.#roster = roster.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'));
      this.#renderRoster();
    }, onError));
  }

  unmount() {
    this.#destroyed = true;
    this.#stops.forEach((stop) => stop?.());
  }

  // ---------- Informações e membros ----------

  #renderInfo() {
    const c = this.#campaign;
    const members = [...c.memberIds].sort((a, b) => (a === c.ownerId ? -1 : b === c.ownerId ? 1 : 0));

    this.#infoEl.replaceChildren(
      h('div', { class: 'cabecalho-pagina' },
        h('div', {},
          h('h1', {}, c.name),
          h('span', { class: 'ficha-item__meta' },
            this.#master ? 'Você é o Mestre' : `Mestre: ${memberName(c, c.ownerId)}`),
        ),
        h('div', { class: 'grupo-botoes' },
          h('a', { class: 'botao botao--secundario', href: '#/campanhas' }, '← Campanhas'),
          h('button', { class: 'botao', type: 'button', onclick: () => this.#share() }, 'Copiar convite'),
        ),
      ),
      c.description ? h('p', { class: 'campanha__descricao' }, c.description) : null,
      h('section', { class: 'card' },
        h('h2', {}, `Participantes (${members.length})`),
        h('ul', { class: 'membros' }, members.map((uid) => h('li', {},
          h('span', {}, memberName(c, uid)),
          uid === c.ownerId ? h('span', { class: 'selo' }, 'Mestre') : null,
          uid === this.#uid ? h('span', { class: 'selo' }, 'Você') : null,
          this.#master && uid !== this.#uid
            ? h('button', { class: 'botao botao--pequeno botao--secundario', type: 'button', onclick: () => this.#removeMember(uid) }, 'Remover')
            : null,
        ))),
        h('div', { class: 'grupo-botoes' },
          this.#master
            ? [
                h('button', { class: 'botao botao--pequeno botao--secundario', type: 'button', onclick: () => this.#edit() }, 'Editar campanha'),
                h('button', { class: 'botao botao--pequeno botao--perigo', type: 'button', onclick: () => this.#delete() }, 'Excluir campanha'),
              ]
            : h('button', { class: 'botao botao--pequeno botao--perigo', type: 'button', onclick: () => this.#leave() }, 'Sair da campanha'),
        ),
      ),
    );
  }

  // ---------- Personagens ----------

  #renderRoster() {
    this.#rosterEl.replaceChildren(
      h('section', { class: 'card' },
        h('div', { class: 'cabecalho-pagina' },
          h('h2', {}, `Personagens (${this.#roster.length})`),
          h('div', { class: 'grupo-botoes' },
            h('button', { class: 'botao botao--pequeno botao--secundario', type: 'button', onclick: () => this.#link() }, 'Vincular ficha'),
            h('button', { class: 'botao botao--pequeno', type: 'button', onclick: () => this.#createHere() }, '+ Criar ficha aqui'),
          ),
        ),
        this.#roster.length
          ? h('ul', { class: 'lista-fichas lista-fichas--campanha' }, this.#roster.map((c) => this.#renderCharacter(c)))
          : h('p', { class: 'campo__dica' }, 'Nenhum personagem ainda. Vincule uma ficha sua ou crie uma direto aqui.'),
      ),
    );
  }

  #renderCharacter(character) {
    const mine = character.ownerId === this.#uid;
    const cls = findClass(this.#gameData.classes, character.classId);
    const avatar = h('div', {}, portrait(character, { size: 'pequeno' }));
    this.#loadPortrait(character, avatar);

    const stat = (label, value) => h('span', { class: 'mini-stat' }, h('strong', {}, value), ` ${label}`);

    return h('li', { class: 'card ficha-item' },
      h('div', { class: 'identidade' },
        avatar,
        h('div', {},
          h('h3', { class: 'ficha-item__nome' }, character.name || 'Sem nome'),
          h('span', { class: 'ficha-item__meta' },
            [cls?.name ?? 'Sem classe', `Jogador: ${memberName(this.#campaign, character.ownerId)}`].join(' · ')),
        ),
      ),
      h('div', { class: 'mini-stats' },
        stat('Vida', `${character.hp.current}/${character.hp.max}`),
        stat('Estresse', `${character.stress.current}/${character.stress.max}`),
        stat('Esperança', `${character.hope}/${HOPE_MAX}`),
        character.vulnerable ? h('span', { class: 'selo selo--aviso' }, 'Vulnerável') : null,
      ),
      h('div', { class: 'grupo-botoes' },
        h('a', { class: 'botao botao--pequeno', href: `#/ficha/${character.id}` }, mine || this.#master ? 'Abrir' : 'Ver ficha'),
        mine || this.#master
          ? h('button', { class: 'botao botao--pequeno botao--secundario', type: 'button', onclick: () => this.#unlink(character) }, 'Desvincular')
          : null,
      ),
    );
  }

  // Retratos ficam fora da ficha (economia de dados): busca cada um uma vez
  #loadPortrait(character, container) {
    if (!this.#portraits.has(character.id)) {
      this.#portraits.set(character.id, this.#characters.getPortrait(character.id));
    }
    this.#portraits.get(character.id).then((src) => {
      if (src) container.replaceChildren(portrait({ ...character, portrait: src }, { size: 'pequeno' }));
    });
  }

  // ---------- Ações ----------

  async #share() {
    const url = this.#campaigns.inviteUrl(this.#campaign.id);
    try {
      await navigator.clipboard.writeText(url);
      showToast('Link de convite copiado! Envie para os jogadores.');
    } catch {
      // Sem acesso à área de transferência: mostra o link para copiar à mão
      openDialog({
        title: 'Link de convite',
        confirmLabel: 'Fechar',
        content: [
          h('p', {}, 'Envie este link para os jogadores. Quem estiver logado pode entrar na campanha.'),
          h('input', { class: 'campo-link', type: 'text', value: url, readOnly: true, onfocus: (e) => e.target.select() }),
        ],
      });
    }
  }

  async #link() {
    const available = (await this.#characters.list()).filter((c) => !c.campaignId);
    if (!available.length) {
      showToast('Você não tem fichas sem campanha. Crie uma aqui mesmo!');
      return;
    }
    let chosen = available[0].id;
    openDialog({
      title: 'Vincular ficha',
      confirmLabel: 'Vincular',
      content: [
        h('p', {}, 'Escolha uma ficha sua que ainda não está em nenhuma campanha.'),
        selectField({
          label: 'Ficha',
          value: chosen,
          options: available.map((c) => ({ value: c.id, label: c.name || 'Sem nome' })),
          onChange: (v) => { chosen = v; },
        }),
      ],
      onConfirm: async () => {
        await this.#characters.setCampaign(chosen, this.#campaign.id);
        showToast('Ficha vinculada à campanha.');
      },
    });
  }

  async #createHere() {
    const character = await this.#characters.create({
      campaignId: this.#campaign.id,
      player: this.#profile.displayName,
    });
    this.#router.navigate(`/editar/${character.id}`);
  }

  #unlink(character) {
    openDialog({
      title: 'Desvincular ficha?',
      confirmLabel: 'Desvincular',
      content: [h('p', {}, `"${character.name || 'Sem nome'}" sai da campanha, mas continua com o dono.`)],
      onConfirm: async () => {
        await this.#characters.setCampaign(character.id, null);
        showToast('Ficha desvinculada.');
      },
    });
  }

  #edit() {
    openCampaignDialog({
      title: 'Editar campanha',
      confirmLabel: 'Salvar',
      initial: { name: this.#campaign.name, description: this.#campaign.description ?? '' },
      onSubmit: async (values) => {
        await this.#campaigns.update(this.#campaign.id, values);
        showToast('Campanha atualizada.');
      },
    });
  }

  #removeMember(uid) {
    const name = memberName(this.#campaign, uid);
    openDialog({
      title: `Remover ${name}?`,
      confirmLabel: 'Remover',
      danger: true,
      content: [h('p', {}, `${name} sai da campanha. As fichas dessa pessoa são desvinculadas, mas continuam com ela.`)],
      onConfirm: async () => {
        await this.#campaigns.removeMember(this.#campaign, uid);
        showToast(`${name} foi removido(a) da campanha.`);
      },
    });
  }

  #leave() {
    openDialog({
      title: 'Sair da campanha?',
      confirmLabel: 'Sair',
      danger: true,
      content: [h('p', {}, 'Suas fichas serão desvinculadas desta campanha, mas continuam com você. Para voltar, peça o link de novo.')],
      onConfirm: async () => {
        await this.#campaigns.leave(this.#campaign);
        showToast('Você saiu da campanha.');
        this.#router.navigate('/campanhas');
      },
    });
  }

  #delete() {
    openDialog({
      title: 'Excluir campanha?',
      confirmLabel: 'Excluir',
      danger: true,
      content: [
        h('p', {}, `"${this.#campaign.name}" será excluída para todos.`),
        h('p', { class: 'campo__dica' }, 'Nenhuma ficha é apagada: todas voltam a ficar sem campanha, com seus donos.'),
      ],
      onConfirm: async () => {
        await this.#campaigns.remove(this.#campaign);
        showToast('Campanha excluída.');
        this.#router.navigate('/campanhas');
      },
    });
  }
}
