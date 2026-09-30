// Criação/edição da ficha em etapas. Salva sozinho a cada alteração.
// Ficha NOVA é um rascunho até o Concluir: ao tentar sair antes, pergunta se quer
// descartar; se não, mostra o que falta preencher.
import { h, append, showToast } from '../dom.js';
import { icon } from '../icons.js';
import { setShellTitle } from '../shell.js';
import { emptyState } from '../components/emptyState.js';
import { openDialog } from '../components/dialog.js';
import { EditSession } from '../../services/EditSession.js';
import { hasErrors } from '../../domain/validation.js';
import { normalizeCharacter } from '../../domain/normalize.js';
import { canEditCharacter } from '../../domain/campaign.js';

export class WizardPage {
  #characters;
  #campaigns;
  #router;
  #gameData;
  #steps;
  #images;

  #session = null;
  #outlet = null;
  #destroyed = false;
  #showErrorsOnRender = false; // ao concluir com etapa pendente, já abre ela com os erros
  #showPending = false; // painel "Falta preencher" (depois de desistir de descartar)
  #discarded = false;
  #index = 0;

  constructor({ characters, campaigns, router, gameData, steps, images }) {
    this.#campaigns = campaigns;
    this.#images = images;
    this.#characters = characters;
    this.#router = router;
    this.#gameData = gameData;
    this.#steps = steps;
  }

  async mount(outlet, { id, step }) {
    this.#outlet = outlet;
    const character = await this.#characters.get(id);
    if (this.#destroyed) return;

    if (!character) {
      outlet.append(emptyState('Ficha não encontrada.', { href: '#/', label: 'Voltar para as fichas' }));
      return;
    }

    // Ficha de outra pessoa: só o Mestre da campanha dela pode editar
    if (character.ownerId && character.ownerId !== this.#campaigns.uid) {
      const campaign = character.campaignId && this.#campaigns.available
        ? await this.#campaigns.get(character.campaignId).catch(() => null)
        : null;
      if (this.#destroyed) return;
      if (!canEditCharacter(character, { uid: this.#campaigns.uid, campaign })) {
        outlet.append(emptyState('Você não pode editar esta ficha.', { href: `#/ficha/${id}`, label: 'Ver ficha' }));
        return;
      }
    }

    const index = this.#indexOf(step);
    if (index === -1) {
      this.#router.navigate(`/editar/${id}/${this.#steps[0].id}`, { replace: true });
      return;
    }

    this.#session = new EditSession(this.#characters, character, {
      onError: () => showToast('Não foi possível salvar a ficha.'),
      normalize: (c) => normalizeCharacter(c, this.#gameData),
    });
    this.#render(index);
  }

  // Troca de etapa na mesma ficha: redesenha sem recarregar do banco
  update({ id, step }) {
    const index = this.#indexOf(step);
    if (id !== this.#session?.character.id || index === -1) return false;
    this.#render(index);
    return true;
  }

  unmount() {
    this.#destroyed = true;
    // Rascunho descartado: não salva nada (senão recriaria a ficha apagada)
    this.#session?.dispose({ save: !this.#discarded });
  }

  // Chamado pelo router antes de sair (links, abas, botão voltar do navegador)
  beforeLeave() {
    if (!this.#session?.character.draft) return true;

    return new Promise((resolve) => {
      openDialog({
        title: 'Descartar esta ficha?',
        danger: true,
        confirmLabel: 'Descartar ficha',
        cancelLabel: 'Continuar editando',
        content: [
          h('p', {}, 'Esta ficha ainda não foi concluída. Se sair agora, ela será descartada.'),
          h('p', { class: 'campo__dica' }, 'Para guardar, preencha o que falta e clique em Concluir na última etapa.'),
        ],
        onConfirm: async () => {
          await this.#discard();
          resolve(true);
        },
        onCancel: () => {
          this.#showPending = true;
          this.#render(this.#index);
          resolve(false);
        },
      });
    });
  }

  async #discard() {
    this.#discarded = true;
    this.#session.dispose({ save: false });
    await this.#characters.remove(this.#session.character.id);
    showToast('Ficha descartada.');
  }

  // Etapas com algo faltando, com as mensagens de cada uma
  #pendingSteps() {
    return this.#steps
      .map((step, index) => ({ step, index, errors: this.#validate(step) }))
      .filter(({ errors }) => hasErrors(errors));
  }

  #pendingPanel() {
    const pending = this.#pendingSteps();
    if (!pending.length) {
      return h('section', { class: 'card pendencias pendencias--ok', role: 'status' },
        h('strong', {}, 'Tudo preenchido!'),
        ' Vá até a última etapa e clique em Concluir para salvar a ficha.');
    }
    return h('section', { class: 'card pendencias', role: 'status' },
      h('h2', {}, 'Falta preencher para salvar'),
      h('ul', {}, pending.map(({ step, index, errors }) => h('li', {},
        h('button', { class: 'pendencias__etapa', type: 'button', onclick: () => this.#goTo(index) }, step.title),
        h('span', {}, Object.values(errors).join(' ')),
      ))),
    );
  }

  #indexOf(stepId) {
    return this.#steps.findIndex((s) => s.id === stepId);
  }

  #goTo(index) {
    const { id } = this.#session.character;
    this.#router.navigate(`/editar/${id}/${this.#steps[index].id}`);
  }

  #validate(step) {
    return step.validate(this.#session.character, this.#gameData);
  }

  #render(index) {
    this.#index = index;
    const session = this.#session;
    const step = this.#steps[index];
    const isFirst = index === 0;
    const isLast = index === this.#steps.length - 1;

    const body = h('section', { class: 'card' });
    const renderStep = (errors = {}) => {
      body.replaceChildren();
      step.render(body, {
        character: session.character,
        current: () => session.character,
        update: (patch) => session.update(patch),
        gameData: this.#gameData,
        images: this.#images,
        errors,
      });
    };

    const next = () => {
      const errors = this.#validate(step);
      if (hasErrors(errors)) {
        renderStep(errors);
        showToast('Confira os campos destacados.');
        return;
      }
      if (isLast) {
        // Dá para pular etapas pelo stepper: confere todas antes de concluir
        const pending = this.#steps.findIndex((s) => hasErrors(this.#validate(s)));
        if (pending !== -1) {
          showToast(`Falta completar: ${this.#steps[pending].title}.`);
          this.#showErrorsOnRender = true;
          this.#goTo(pending);
          return;
        }
        const wasDraft = session.character.draft;
        session.update({ draft: false }); // agora é uma ficha de verdade
        session.flush();
        if (wasDraft) showToast('Ficha salva!');
        this.#router.navigate(`/ficha/${session.character.id}`);
      } else {
        this.#goTo(index + 1);
      }
    };

    const back = () => (isFirst ? this.#router.navigate('/') : this.#goTo(index - 1));

    const stepper = h('nav', { class: 'stepper', 'aria-label': 'Etapas da ficha' },
      this.#steps.map((s, i) => h('button', {
        class: 'stepper__item',
        type: 'button',
        'aria-current': i === index ? 'step' : null,
        onclick: () => this.#goTo(i),
      }, s.title)),
    );

    const bottomBar = h('nav', { class: 'barra-inferior', 'aria-label': 'Navegação das etapas' },
      h('button', { class: 'botao botao--secundario', type: 'button', onclick: back },
        isFirst ? '← Fichas' : '← Voltar'),
      h('div', { class: 'barra-inferior__etapa' },
        h('strong', {}, step.title),
        `Etapa ${index + 1} de ${this.#steps.length}`),
      h('button', { class: 'botao', type: 'button', onclick: next },
        isLast ? 'Concluir' : 'Continuar →'),
    );

    // Celular: barra de progresso no lugar do stepper; tocar abre a lista de etapas
    const progress = h('button', {
      class: 'progresso',
      type: 'button',
      'aria-label': `Etapa ${index + 1} de ${this.#steps.length}: ${step.title}. Tocar para ver todas as etapas.`,
      onclick: () => this.#openStepList(index),
    },
      h('span', { class: 'progresso__texto' },
        h('span', {}, `Etapa ${index + 1} de ${this.#steps.length}`),
        h('strong', {}, step.title),
        icon('chevron-down'),
      ),
      h('progress', { class: 'progresso__barra', max: this.#steps.length, value: index + 1 }),
    );

    setShellTitle(session.character.draft ? 'Nova ficha' : `Editar ${session.character.name || 'ficha'}`);

    renderStep(this.#showErrorsOnRender ? this.#validate(step) : {});
    this.#showErrorsOnRender = false;
    this.#outlet.classList.add('pagina--com-barra');
    this.#outlet.replaceChildren();
    append(this.#outlet,
      stepper,
      progress,
      this.#showPending && session.character.draft ? this.#pendingPanel() : null,
      body,
      bottomBar,
    );
    stepper.children[index]?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }

  // Lista de etapas (celular): pular direto para qualquer uma, vendo o que falta
  #openStepList(current) {
    const { close } = openDialog({
      title: 'Etapas da ficha',
      confirmLabel: 'Fechar',
      content: [
        h('ol', { class: 'lista-etapas' },
          this.#steps.map((s, i) => {
            const pending = hasErrors(this.#validate(s));
            return h('li', {},
              h('button', {
                class: 'lista-etapas__item',
                type: 'button',
                'aria-current': i === current ? 'step' : null,
                onclick: () => {
                  close();
                  this.#goTo(i);
                },
              },
                h('span', { class: 'lista-etapas__numero' }, String(i + 1)),
                h('span', { class: 'lista-etapas__nome' }, s.title),
                pending
                  ? h('span', { class: 'lista-etapas__estado lista-etapas__estado--pendente' }, 'Falta preencher')
                  : h('span', { class: 'lista-etapas__estado' }, icon('check')),
              ),
            );
          }),
        ),
      ],
    });
  }
}
