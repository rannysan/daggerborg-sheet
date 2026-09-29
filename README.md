# Dagger Sheet

PWA para criar e gerenciar fichas de personagem de RPG. HTML, CSS e JavaScript puro
(ES Modules, sem build). As fichas ficam salvas no aparelho (IndexedDB) e podem ser
exportadas/importadas em `.json`.

## Estrutura

```
dagger-sheet/
├── index.html          → casca do app (header + <main id="app">)
├── offline.html        → exibida quando não há internet nem cache
├── manifest.json       → nome, ícones e cores (o que torna o app "instalável")
├── sw.js               → service worker (cache e funcionamento offline)
├── .nojekyll           → faz o GitHub Pages servir os arquivos sem processar
├── css/
│   ├── base.css        → variáveis de tema, reset, tipografia
│   ├── layout.css      → estrutura das telas (mobile-first)
│   └── components.css  → botões, campos, cards, stepper, stats
├── data/               → CONTEÚDO do sistema (classes, itens...) em JSON
├── js/
│   ├── main.js         → ponto de entrada: cria as dependências e as rotas
│   ├── core/           → router (hash), store (observer), utilitários
│   ├── domain/         → regras do jogo: modelo, cálculos, validação, migrações
│   ├── services/       → casos de uso (criar, salvar, importar, exportar fichas)
│   ├── infra/          → IndexedDB, arquivos, carregamento de /data, PWA
│   └── ui/
│       ├── pages/      → Minhas fichas, Wizard de criação, Ficha
│       ├── steps/      → etapas do wizard (registradas em steps/index.js)
│       └── components/ → campos e peças reutilizáveis
├── icons/              → ícones do app (192, 512 e maskable)
└── _vscode/            → configurações do VS Code (renomeie para .vscode)
```

Regra de dependência: `ui → services → domain`; `infra` implementa os contratos
(ex.: `CharacterRepository`). O `domain` não conhece DOM nem armazenamento.

### Como estender

- **Nova etapa do wizard:** crie `js/ui/steps/MinhaEtapa.js` com `{ id, title, render, validate }`
  e registre em `js/ui/steps/index.js`.
- **Nova tabela de dados:** crie `data/<nome>.json` e adicione o nome em `js/infra/GameDataLoader.js`.
- **Novo campo na ficha:** adicione em `createCharacter()` (`js/domain/character.js`). Se mudar
  o formato de campos existentes, aumente `SCHEMA_VERSION` e crie a migração em `js/domain/migrations.js`.
- **Outro armazenamento (ex.: Supabase):** crie uma classe que estenda `CharacterRepository`
  e troque em `js/main.js`.
- Todo arquivo novo também entra na lista `ARQUIVOS` do `sw.js`.

## Como rodar

0. Renomeie a pasta `_vscode` para `.vscode` (tem as extensões recomendadas e as configurações).
1. Abra a pasta no VS Code.
2. Instale a extensão recomendada **Live Server** (o VS Code vai sugerir).
3. Clique com o botão direito em `index.html` → **Open with Live Server**.
4. Abre em `http://localhost:5500`.

> O service worker só funciona em `localhost` ou em `https://`. Abrir o arquivo direto (`file://`) não funciona.

## Testar no computador

No Chrome/Edge, abra o DevTools (F12) → aba **Application**:
- **Manifest**: mostra se o manifesto está válido.
- **Service workers**: mostra se registrou. Marque "Update on reload" enquanto desenvolve.
- **Network → Offline**: simula ficar sem internet.

Um ícone de instalar aparece na barra de endereço quando está tudo certo.

## Testar no celular

O celular precisa de **HTTPS** para instalar. Opções:
- **Rápido:** publicar no GitHub Pages, Netlify ou Vercel (todos grátis e já com HTTPS).
- **Android pela rede local:** conecte o celular via USB, abra `chrome://inspect` no PC e use *Port forwarding* (porta 5500 → `localhost:5500`). Aí o celular acessa `localhost:5500` e o PWA instala.

## Ao atualizar o site

Troque a versão em `sw.js` (`dagger-sheet-v1` → `dagger-sheet-v2`) para o navegador pegar os arquivos novos.
