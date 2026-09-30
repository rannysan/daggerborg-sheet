// Convite: #/entrar/:id — quem tem o link e está logado pode entrar na campanha
import { h, showToast } from '../dom.js';
import { emptyState } from '../components/emptyState.js';
import { invitesOpen, isMember, memberName } from '../../domain/campaign.js';

export class InvitePage {
  #campaigns;
  #router;

  constructor({ campaigns, router }) {
    this.#campaigns = campaigns;
    this.#router = router;
  }

  async mount(outlet, { id }) {
    if (!this.#campaigns.available) {
      // Depois de entrar, o app recarrega esta mesma página e o convite aparece
      outlet.append(emptyState('Você foi convidado para uma campanha! Entre com sua conta Google (botão "Entrar" no topo) para participar.'));
      return;
    }

    let campaign;
    try {
      campaign = await this.#campaigns.get(id);
    } catch (erro) {
      console.error('[Convite]', erro);
      outlet.append(emptyState('Não foi possível abrir o convite. Verifique a conexão.'));
      return;
    }

    if (!campaign) {
      outlet.append(emptyState('Convite inválido ou a campanha foi excluída.', { href: '#/campanhas', label: 'Ver minhas campanhas' }));
      return;
    }
    if (isMember(campaign, this.#campaigns.uid)) {
      this.#router.navigate(`/campanha/${id}`, { replace: true });
      return;
    }

    if (!invitesOpen(campaign)) {
      outlet.append(emptyState(`Os convites de "${campaign.name}" estão fechados. Peça ao Mestre para abri-los.`, { href: '#/campanhas', label: 'Ver minhas campanhas' }));
      return;
    }

    const count = campaign.memberIds.length;
    const joinButton = h('button', { class: 'botao', type: 'button' }, 'Entrar na campanha');
    joinButton.addEventListener('click', async () => {
      joinButton.disabled = true;
      try {
        await this.#campaigns.join(id);
        showToast(`Você entrou em "${campaign.name}"!`);
        this.#router.navigate(`/campanha/${id}`);
      } catch (erro) {
        console.error('[Convite]', erro);
        showToast('Não foi possível entrar na campanha.');
        joinButton.disabled = false;
      }
    });

    outlet.append(
      h('section', { class: 'card convite' },
        h('p', { class: 'rotulo' }, 'Convite para campanha'),
        h('h1', {}, campaign.name),
        h('p', { class: 'ficha-item__meta' },
          `Mestre: ${memberName(campaign, campaign.ownerId)} · ${count} participante${count === 1 ? '' : 's'}`),
        campaign.description ? h('p', { class: 'campanha__descricao' }, campaign.description) : null,
        h('p', {}, 'Ao entrar, você poderá ver os personagens da campanha e vincular os seus.'),
        h('div', { class: 'grupo-botoes' },
          joinButton,
          h('a', { class: 'botao botao--secundario', href: '#/campanhas' }, 'Agora não'),
        ),
      ),
    );
  }
}
