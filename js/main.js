// Ponto de entrada (Composition Root): cria as dependências e liga tudo.
// É o ÚNICO lugar que escolhe implementações concretas (ex.: IndexedDB).
import { Router } from './core/router.js';
import { CharacterService } from './services/CharacterService.js';
import { IndexedDbRepository } from './infra/repositories/IndexedDbRepository.js';
import { FileService } from './infra/FileService.js';
import { ImageService } from './infra/ImageService.js';
import { GameDataLoader } from './infra/GameDataLoader.js';
import { registerServiceWorker, setupInstallButton, setupNetworkStatus } from './infra/pwa.js';
import { WIZARD_STEPS } from './ui/steps/index.js';
import { CharacterListPage } from './ui/pages/CharacterListPage.js';
import { WizardPage } from './ui/pages/WizardPage.js';
import { SheetPage } from './ui/pages/SheetPage.js';
import { emptyState } from './ui/components/emptyState.js';

registerServiceWorker();
setupInstallButton(document.getElementById('btn-instalar'));
setupNetworkStatus(document.getElementById('status-rede'));

const app = document.getElementById('app');

try {
  const gameData = await new GameDataLoader().load();
  const characters = new CharacterService(new IndexedDbRepository(), new FileService());
  const images = new ImageService();
  const router = new Router(app);

  const wizard = () => new WizardPage({ characters, router, gameData, images, steps: WIZARD_STEPS });

  router
    .add('/', () => new CharacterListPage({ characters, router, gameData }))
    .add('/editar/:id', wizard)
    .add('/editar/:id/:step', wizard)
    .add('/ficha/:id', () => new SheetPage({ characters, gameData, images }))
    .start();
} catch (erro) {
  console.error('[App] Falha ao iniciar:', erro);
  app.replaceChildren(emptyState('Não foi possível iniciar o app. Verifique a conexão e recarregue a página.'));
}
