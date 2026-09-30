// "Campanhas": as campanhas de que participo (como Mestre ou jogador)
import { h, showToast } from '../dom.js';
import { emptyState } from '../components/emptyState.js';
import { openCampaignDialog } from '../components/campaignDialog.js';
import { isMaster, memberName } from '../../domain/campaign.js';

export class CampaignListPage {
  #campaigns;
  #router;

  constructor({ campaigns, router }) {
    this.#campaigns = campaigns;
    this.#router = router;
  }

  async mount(outlet) {
    if (!this.#campaigns.available) {
      outlet.append(
        h('div', { class: 'cabecalho-pagina' }, h('h1', {}, 'Campanhas')),
        emptyState('Entre com sua conta Google (botão "Entrar" no topo) para criar campanhas e jogar com seu grupo.'),
      );
      return;
    }

    const list = h('div', {}, h('p', { class: 'campo__dica' }, 'Carregando…'));
    outlet.append(
      h('div', { class: 'cabecalho-pagina' },
        h('h1', {}, 'Campanhas'),
        h('button', { class: 'botao', type: 'button', onclick: () => this.#create() }, '+ Nova campanha'),
      ),
      list,
    );

    try {
      const campaigns = await this.#campaigns.listMine();
      list.replaceChildren(campaigns.length
        ? h('ul', { class: 'lista-fichas' }, campaigns.map((c) => this.#renderItem(c)))
        : emptyState('Você ainda não participa de nenhuma campanha. Crie uma ou peça o link de convite ao seu Mestre.'));
    } catch (erro) {
      console.error('[Campanhas]', erro);
      list.replaceChildren(emptyState('Não foi possível carregar as campanhas. Verifique a conexão.'));
    }
  }

  #renderItem(campaign) {
    const uid = this.#campaigns.uid;
    const role = isMaster(campaign, uid) ? 'Você é o Mestre' : `Mestre: ${memberName(campaign, campaign.ownerId)}`;
    const count = campaign.memberIds.length;

    return h('li', { class: 'card ficha-item' },
      h('h2', {}, campaign.name),
      h('span', { class: 'ficha-item__meta' }, `${role} · ${count} participante${count === 1 ? '' : 's'}`),
      campaign.description ? h('p', { class: 'campanha__descricao' }, campaign.description) : null,
      h('div', { class: 'grupo-botoes' },
        h('a', { class: 'botao botao--pequeno', href: `#/campanha/${campaign.id}` }, 'Abrir'),
      ),
    );
  }

  #create() {
    openCampaignDialog({
      title: 'Nova campanha',
      confirmLabel: 'Criar',
      onSubmit: async (values) => {
        const campaign = await this.#campaigns.create(values);
        showToast('Campanha criada! Copie o link de convite para chamar os jogadores.');
        this.#router.navigate(`/campanha/${campaign.id}`);
      },
    });
  }
}
