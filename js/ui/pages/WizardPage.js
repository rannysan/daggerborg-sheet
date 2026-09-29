// Criação/edição da ficha em etapas. Salva sozinho a cada alteração.
import { h, showToast } from '../dom.js';
import { emptyState } from '../components/emptyState.js';
import { EditSession } from '../../services/EditSession.js';
import { hasErrors } from '../../domain/validation.js';
import { normalizeCharacter } from '../../domain/normalize.js';

export class WizardPage {
  #characters;
  #router;
  #gameData;
  #steps;
  #images;

  #session = null;
  #outlet = null;
  #destroyed = false;
  #showErrorsOnRender = false; // ao concluir com etapa pendente, já abre ela com os erros

  constructor({ characters, router, gameData, steps, images }) {
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
    this.#session?.dispose();
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
        session.flush();
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

    renderStep(this.#showErrorsOnRender ? this.#validate(step) : {});
    this.#showErrorsOnRender = false;
    this.#outlet.classList.add('pagina--com-barra');
    this.#outlet.replaceChildren(stepper, body, bottomBar);
    stepper.children[index]?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }
}
