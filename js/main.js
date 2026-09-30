// Ponto de entrada (Composition Root): cria as dependências e liga tudo.
// É o ÚNICO lugar que escolhe implementações concretas (ex.: IndexedDB, Firestore).
import { Router } from './core/router.js';
import { CharacterService } from './services/CharacterService.js';
import { CampaignService } from './services/CampaignService.js';
import { ProfileService } from './services/ProfileService.js';
import { copyCharacters, countCharacters } from './services/CloudSync.js';
import { IndexedDbRepository } from './infra/repositories/IndexedDbRepository.js';
import { FirestoreRepository } from './infra/repositories/FirestoreRepository.js';
import { SwitchableRepository } from './infra/repositories/SwitchableRepository.js';
import { FirebaseClient } from './infra/firebase/FirebaseClient.js';
import { AuthService } from './infra/firebase/AuthService.js';
import { CampaignRepository } from './infra/firebase/CampaignRepository.js';
import { ProfileRepository } from './infra/firebase/ProfileRepository.js';
import { migrateLegacyCharacters } from './infra/firebase/legacyMigration.js';
import { firebaseConfig, FIREBASE_SDK_URL } from './infra/firebase/config.js';
import { FileService } from './infra/FileService.js';
import { ImageService } from './infra/ImageService.js';
import { GameDataLoader } from './infra/GameDataLoader.js';
import { registerServiceWorker, setupInstallButton, setupNetworkStatus } from './infra/pwa.js';
import { WIZARD_STEPS } from './ui/steps/index.js';
import { CharacterListPage } from './ui/pages/CharacterListPage.js';
import { WizardPage } from './ui/pages/WizardPage.js';
import { SheetPage } from './ui/pages/SheetPage.js';
import { CampaignListPage } from './ui/pages/CampaignListPage.js';
import { CampaignPage } from './ui/pages/CampaignPage.js';
import { InvitePage } from './ui/pages/InvitePage.js';
import { emptyState } from './ui/components/emptyState.js';
import { mountAccountButton } from './ui/components/accountButton.js';
import { openDialog } from './ui/components/dialog.js';
import { h, showToast } from './ui/dom.js';

registerServiceWorker();
setupInstallButton(document.getElementById('btn-instalar'));
setupNetworkStatus(document.getElementById('status-rede'));
setupTabs();

const app = document.getElementById('app');

try {
  const gameData = await new GameDataLoader().load();

  // ---------- Armazenamento: local por padrão, nuvem com login ----------
  const local = new IndexedDbRepository();
  const repository = new SwitchableRepository(local);
  const firebase = new FirebaseClient(firebaseConfig, FIREBASE_SDK_URL);
  const auth = new AuthService(firebase);
  const profile = new ProfileService(new ProfileRepository(firebase), auth);

  const cloudFor = (user) => new FirestoreRepository(firebase, user.uid, {
    onError: (erro) => {
      console.error('[Nuvem] Falha ao salvar:', erro);
      showToast(erro.code === 'permission-denied'
        ? 'Sem permissão para salvar esta ficha.'
        : 'Não foi possível salvar na nuvem.');
    },
  });

  // Ao entrar (ou reabrir o app já logado): nuvem + perfil + migração do formato antigo
  const connect = async (user) => {
    const cloud = cloudFor(user);
    repository.use(cloud);
    await profile.load();
    try {
      await migrateLegacyCharacters(firebase, user.uid, cloud);
    } catch (erro) {
      console.warn('[Nuvem] Migração das fichas antigas:', erro);
    }
  };

  try {
    const user = await auth.restore();
    if (user) await connect(user);
  } catch (erro) {
    console.warn('[Nuvem] Sessão não restaurada:', erro);
    showToast('Sem conexão com a nuvem: mostrando as fichas deste aparelho.');
  }

  const characters = new CharacterService(repository, new FileService());
  const campaigns = new CampaignService(new CampaignRepository(firebase, () => auth.user?.uid ?? null), characters, profile);
  const images = new ImageService();
  const router = new Router(app);

  const wizard = () => new WizardPage({ characters, campaigns, router, gameData, images, steps: WIZARD_STEPS });

  router
    .add('/', () => new CharacterListPage({ characters, campaigns, profile, router, gameData }))
    .add('/editar/:id', wizard)
    .add('/editar/:id/:step', wizard)
    .add('/ficha/:id', () => new SheetPage({ characters, campaigns, gameData, images }))
    .add('/campanhas', () => new CampaignListPage({ campaigns, router }))
    .add('/campanha/:id', () => new CampaignPage({ campaigns, characters, profile, router, gameData }))
    .add('/entrar/:id', () => new InvitePage({ campaigns, router }))
    .start();

  // Primeiro login neste aparelho: oferece levar as fichas locais para a conta
  const offerUpload = async () => {
    const count = await countCharacters(local);
    if (!count) return;
    openDialog({
      title: 'Enviar fichas deste aparelho?',
      confirmLabel: 'Enviar para a conta',
      content: [
        h('p', {}, `Você tem ${count} ficha(s) salva(s) só neste aparelho. Quer enviá-las para sua conta?`),
        h('p', { class: 'campo__dica' }, 'Elas continuam guardadas aqui também. Enviar de novo só atualiza, não duplica.'),
      ],
      onConfirm: async () => {
        const sent = await copyCharacters(local, repository);
        showToast(`${sent} ficha(s) enviada(s) para sua conta.`);
        await router.reload();
      },
    });
  };

  mountAccountButton(document.getElementById('conta'), {
    auth,
    profile,
    onSignIn: async (user) => {
      await router.reload(() => connect(user));
      await offerUpload();
    },
    onSignOut: async () => {
      let failure = null;
      await router.reload(async () => {
        try {
          await auth.signOut();
          repository.use(local);
          await profile.load();
        } catch (erro) {
          failure = erro; // continua na nuvem; a página é remontada igual
        }
      });
      if (failure) throw failure;
    },
    // Apelido novo: atualiza o nome nas campanhas e redesenha a página atual
    onProfileSaved: async () => {
      await campaigns.syncMyName().catch((erro) => console.warn('[Perfil] Campanhas:', erro));
      await router.reload();
    },
  });
} catch (erro) {
  console.error('[App] Falha ao iniciar:', erro);
  app.replaceChildren(emptyState('Não foi possível iniciar o app. Verifique a conexão e recarregue a página.'));
}

// Abas do cabeçalho (Fichas | Campanhas): destaca a seção da rota atual
function setupTabs() {
  const tabs = document.querySelectorAll('[data-aba]');
  const refresh = () => {
    const path = location.hash.slice(1) || '/';
    const section = /^\/(campanha|entrar)/.test(path) ? 'campanhas' : 'fichas';
    tabs.forEach((tab) => {
      if (tab.dataset.aba === section) tab.setAttribute('aria-current', 'page');
      else tab.removeAttribute('aria-current');
    });
  };
  window.addEventListener('hashchange', refresh);
  refresh();
}
