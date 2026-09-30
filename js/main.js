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
import { firebaseConfig, FIREBASE_SDK_URL, RECAPTCHA_SITE_KEY } from './infra/firebase/config.js';
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
import { ProfilePage } from './ui/pages/ProfilePage.js';
import { setupShell } from './ui/shell.js';
import { mountHeaderAccount } from './ui/components/headerAccount.js';
import { watchSystemTheme } from './ui/theme.js';
import { emptyState } from './ui/components/emptyState.js';
import { openDialog } from './ui/components/dialog.js';
import { h, showToast } from './ui/dom.js';

registerServiceWorker();
setupInstallButton(document.getElementById('btn-instalar'));
setupNetworkStatus(document.getElementById('status-rede'));
watchSystemTheme();

const app = document.getElementById('app');

try {
  const gameData = await new GameDataLoader().load();

  // ---------- Armazenamento: local por padrão, nuvem com login ----------
  const local = new IndexedDbRepository();
  const repository = new SwitchableRepository(local);
  const firebase = new FirebaseClient(firebaseConfig, FIREBASE_SDK_URL, { recaptchaSiteKey: RECAPTCHA_SITE_KEY });
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

  // Ações da conta (usadas pela tela de Perfil)
  const account = {
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
  };

  setupShell(router);
  mountHeaderAccount(document.getElementById('conta-topo'), account);

  // meta de cada rota: aba ativa, título na barra do celular, destino do voltar
  // e se esconde a navegação inferior (o wizard tem a própria barra de ações)
  router
    .add('/', () => new CharacterListPage({ characters, campaigns, profile, router, gameData }), { tab: 'fichas' })
    .add('/editar/:id', wizard, { tab: 'fichas', title: 'Ficha', back: '/', hideNav: true })
    .add('/editar/:id/:step', wizard, { tab: 'fichas', title: 'Ficha', back: '/', hideNav: true })
    .add('/ficha/:id', () => new SheetPage({ characters, campaigns, gameData, images }), { tab: 'fichas', title: 'Ficha', back: '/' })
    .add('/campanhas', () => new CampaignListPage({ campaigns, router }), { tab: 'campanhas' })
    .add('/campanha/:id', () => new CampaignPage({ campaigns, characters, profile, router, gameData }), { tab: 'campanhas', title: 'Campanha', back: '/campanhas' })
    .add('/entrar/:id', () => new InvitePage({ campaigns, router }), { tab: 'campanhas', title: 'Convite', back: '/campanhas' })
    .add('/perfil', () => new ProfilePage(account), { tab: 'perfil' })
    .start();
} catch (erro) {
  console.error('[App] Falha ao iniciar:', erro);
  app.replaceChildren(emptyState('Não foi possível iniciar o app. Verifique a conexão e recarregue a página.'));
}

