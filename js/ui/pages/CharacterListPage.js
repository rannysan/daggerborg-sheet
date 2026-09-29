// Tela inicial: "Minhas fichas"
import { h, showToast } from '../dom.js';
import { emptyState } from '../components/emptyState.js';
import { formatDate } from '../../core/utils.js';
import { findClass } from '../../domain/classes.js';
import { portrait } from '../components/portrait.js';

export class CharacterListPage {
  #characters;
  #router;
  #gameData;
  #list = null;

  constructor({ characters, router, gameData }) {
    this.#characters = characters;
    this.#gameData = gameData;
    this.#router = router;
  }

  async mount(outlet) {
    const fileInput = h('input', {
      type: 'file',
      accept: '.json,application/json',
      hidden: true,
      onchange: (e) => this.#import(e.target),
    });

    this.#list = h('div');

    outlet.append(
      h('div', { class: 'cabecalho-pagina' },
        h('h1', {}, 'Minhas fichas'),
        h('div', { class: 'grupo-botoes' },
          h('button', { class: 'botao botao--secundario', type: 'button', onclick: () => fileInput.click() }, 'Importar'),
          h('button', { class: 'botao', type: 'button', onclick: () => this.#create() }, '+ Nova ficha'),
        ),
        fileInput,
      ),
      this.#list,
    );

    await this.#renderList();
  }

  async #renderList() {
    const characters = await this.#characters.list();

    if (characters.length === 0) {
      this.#list.replaceChildren(emptyState('Você ainda não tem fichas. Crie a primeira!'));
      return;
    }

    this.#list.replaceChildren(
      h('ul', { class: 'lista-fichas' }, characters.map((c) => this.#renderItem(c)))
    );
  }

  #renderItem(character) {
    const meta = [
      findClass(this.#gameData.classes, character.classId)?.name ?? 'Sem classe',
      character.player,
      `atualizada em ${formatDate(character.updatedAt)}`,
    ].filter(Boolean).join(' · ');

    return h('li', { class: 'card ficha-item' },
      h('div', { class: 'identidade' },
        portrait(character, { size: 'pequeno' }),
        h('div', {},
          h('h2', {}, character.name || 'Sem nome'),
          h('span', { class: 'ficha-item__meta' }, meta),
        ),
      ),
      h('div', { class: 'grupo-botoes' },
        h('a', { class: 'botao botao--pequeno', href: `#/ficha/${character.id}` }, 'Abrir'),
        h('a', { class: 'botao botao--pequeno botao--secundario', href: `#/editar/${character.id}` }, 'Editar'),
        h('button', {
          class: 'botao botao--pequeno botao--secundario', type: 'button',
          onclick: () => this.#characters.export(character),
        }, 'Exportar'),
        h('button', {
          class: 'botao botao--pequeno botao--perigo', type: 'button',
          onclick: () => this.#remove(character),
        }, 'Excluir'),
      ),
    );
  }

  async #create() {
    const character = await this.#characters.create();
    this.#router.navigate(`/editar/${character.id}`);
  }

  async #remove(character) {
    if (!confirm(`Excluir "${character.name || 'Sem nome'}"? Isso não pode ser desfeito.`)) return;
    await this.#characters.remove(character.id);
    showToast('Ficha excluída.');
    await this.#renderList();
  }

  async #import(input) {
    const [file] = input.files;
    input.value = ''; // permite importar o mesmo arquivo de novo
    if (!file) return;
    try {
      await this.#characters.import(file);
      showToast('Ficha importada!');
      await this.#renderList();
    } catch (erro) {
      showToast(erro.message);
    }
  }
}
