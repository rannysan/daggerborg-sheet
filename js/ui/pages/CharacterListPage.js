// Tela inicial: "Minhas fichas" (só as que eu criei, com o selo da campanha de cada uma)
import { h, showToast } from '../dom.js';
import { emptyState } from '../components/emptyState.js';
import { formatDate } from '../../core/utils.js';
import { findClass } from '../../domain/classes.js';
import { portrait } from '../components/portrait.js';
import { openDialog } from '../components/dialog.js';

export class CharacterListPage {
  #characters;
  #campaigns;
  #profile;
  #router;
  #gameData;
  #list = null;
  #campaignNames = new Map(); // id → nome, para os selos

  constructor({ characters, campaigns, profile, router, gameData }) {
    this.#characters = characters;
    this.#campaigns = campaigns;
    this.#profile = profile;
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
    const [characters, campaigns] = await Promise.all([
      this.#characters.list(),
      this.#campaigns.available ? this.#campaigns.listMine().catch(() => []) : [],
    ]);
    this.#campaignNames = new Map(campaigns.map((c) => [c.id, c.name]));

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
          h('div', { class: 'selos' },
            character.draft ? h('span', { class: 'selo selo--aviso' }, 'Rascunho') : null,
            this.#campaignNames.has(character.campaignId)
              ? h('a', { class: 'selo', href: `#/campanha/${character.campaignId}` },
                  `🎲 ${this.#campaignNames.get(character.campaignId)}`)
              : null,
          ),
        ),
      ),
      h('div', { class: 'grupo-botoes' },
        // Rascunho (ficha nova não concluída): só continuar ou excluir
        character.draft
          ? h('a', { class: 'botao botao--pequeno', href: `#/editar/${character.id}` }, 'Continuar')
          : [
              h('a', { class: 'botao botao--pequeno', href: `#/ficha/${character.id}` }, 'Abrir'),
              h('a', { class: 'botao botao--pequeno botao--secundario', href: `#/editar/${character.id}` }, 'Editar'),
              h('button', {
                class: 'botao botao--pequeno botao--secundario', type: 'button',
                onclick: () => this.#characters.export(character),
              }, 'Exportar'),
            ],
        h('button', {
          class: 'botao botao--pequeno botao--perigo', type: 'button',
          onclick: () => this.#remove(character),
        }, 'Excluir'),
      ),
    );
  }

  async #create() {
    const character = await this.#characters.create({ player: this.#profile.displayName, draft: true });
    this.#router.navigate(`/editar/${character.id}`);
  }

  #remove(character) {
    openDialog({
      title: 'Excluir ficha?',
      confirmLabel: 'Excluir',
      danger: true,
      content: [
        h('p', {}, `"${character.name || 'Sem nome'}" será excluída. Isso não pode ser desfeito.`),
        character.campaignId ? h('p', { class: 'campo__dica' }, 'Ela também sai da campanha.') : null,
      ],
      onConfirm: async () => {
        await this.#characters.remove(character.id);
        showToast('Ficha excluída.');
        await this.#renderList();
      },
    });
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
