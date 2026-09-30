// Service worker: roda em segundo plano e intercepta as requisições do site.
// IMPORTANTE: sempre que mudar arquivos do site, aumente a versão abaixo
// para o navegador baixar tudo de novo.
const CACHE = 'dagger-sheet-v15';

// Arquivos guardados na instalação (o "esqueleto" do app para funcionar offline).
// Ao criar um arquivo .js/.css/.json novo, adicione aqui também.
const ARQUIVOS = [
  './',
  './index.html',
  './offline.html',
  './manifest.json',
  './css/base.css',
  './css/layout.css',
  './css/components.css',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './data/classes.json',
  './data/equipment.json',
  './js/main.js',
  './js/core/router.js',
  './js/core/store.js',
  './js/core/utils.js',
  './js/domain/campaign.js',
  './js/domain/character.js',
  './js/domain/classes.js',
  './js/domain/dice.js',
  './js/domain/equipment.js',
  './js/domain/migrations.js',
  './js/domain/normalize.js',
  './js/domain/rest.js',
  './js/domain/rules.js',
  './js/domain/validation.js',
  './js/infra/FileService.js',
  './js/infra/GameDataLoader.js',
  './js/infra/firebase/AuthService.js',
  './js/infra/firebase/CampaignRepository.js',
  './js/infra/firebase/FirebaseClient.js',
  './js/infra/firebase/ProfileRepository.js',
  './js/infra/firebase/config.js',
  './js/infra/firebase/legacyMigration.js',
  './js/infra/ImageService.js',
  './js/infra/pwa.js',
  './js/infra/repositories/CharacterRepository.js',
  './js/infra/repositories/FirestoreRepository.js',
  './js/infra/repositories/IndexedDbRepository.js',
  './js/infra/repositories/MemoryRepository.js',
  './js/infra/repositories/SwitchableRepository.js',
  './js/services/CampaignService.js',
  './js/services/CharacterService.js',
  './js/services/CloudSync.js',
  './js/services/EditSession.js',
  './js/services/ProfileService.js',
  './js/ui/dom.js',
  './js/ui/components/accountButton.js',
  './js/ui/components/campaignDialog.js',
  './js/ui/components/classAbilities.js',
  './js/ui/components/counter.js',
  './js/ui/components/dialog.js',
  './js/ui/components/emptyState.js',
  './js/ui/components/fields.js',
  './js/ui/components/pipTrack.js',
  './js/ui/components/portrait.js',
  './js/ui/components/rollPopup.js',
  './js/ui/components/textBlock.js',
  './js/ui/pages/CampaignListPage.js',
  './js/ui/pages/CampaignPage.js',
  './js/ui/pages/CharacterListPage.js',
  './js/ui/pages/InvitePage.js',
  './js/ui/pages/SheetPage.js',
  './js/ui/pages/WizardPage.js',
  './js/ui/steps/index.js',
  './js/ui/steps/AttributesStep.js',
  './js/ui/steps/BasicInfoStep.js',
  './js/ui/steps/ClassStep.js',
  './js/ui/steps/EquipmentStep.js',
  './js/ui/steps/ExperiencesStep.js',
  './js/ui/steps/OthersStep.js'
];

const DATA_PREFIX = new URL('data/', self.registration.scope).href;

// SDK do Firebase (CDN). URLs com versão fixa nunca mudam: cache-first é seguro.
// Guardado no primeiro uso, para quem está logado abrir o app mesmo offline.
const FIREBASE_SDK_PREFIX = 'https://www.gstatic.com/firebasejs/';

// Instalação: baixa e guarda os arquivos no cache
self.addEventListener('install', (event) => {
  event.waitUntil(
    // cache: 'reload' ignora o cache HTTP do navegador, senão uma versão nova
    // do app poderia guardar cópias antigas dos arquivos
    caches.open(CACHE).then((cache) =>
      cache.addAll(ARQUIVOS.map((url) => new Request(url, { cache: 'reload' })))
    )
  );
  self.skipWaiting();
});

// Ativação: apaga caches de versões antigas
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((nomes) =>
      Promise.all(nomes.filter((n) => n !== CACHE).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  if (request.url.startsWith(FIREBASE_SDK_PREFIX)) {
    event.respondWith(cacheFirst(request));
    return;
  }
  // Demais origens (login do Google, Firestore): direto na rede, sem cache
  if (new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    request.url.startsWith(DATA_PREFIX) ? staleWhileRevalidate(request) : networkFirst(request)
  );
});

// Código do app: tenta a rede primeiro; se falhar (offline), usa o cache
async function networkFirst(request) {
  try {
    const resposta = await fetch(request);
    if (resposta.ok) {
      const cache = await caches.open(CACHE);
      cache.put(request, resposta.clone());
    }
    return resposta;
  } catch {
    const doCache = await caches.match(request);
    if (doCache) return doCache;
    // página de navegação sem cache → mostra a página offline
    if (request.mode === 'navigate') return caches.match('./offline.html');
    return Response.error();
  }
}

async function cacheFirst(request) {
  const doCache = await caches.match(request);
  if (doCache) return doCache;
  const resposta = await fetch(request);
  if (resposta.ok) {
    const cache = await caches.open(CACHE);
    cache.put(request, resposta.clone());
  }
  return resposta;
}

// Dados do sistema (/data): responde na hora com o cache e atualiza em segundo plano
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const doCache = await cache.match(request);
  const daRede = fetch(request, { cache: 'no-cache' }) // revalida com o servidor
    .then((resposta) => {
      if (resposta.ok) cache.put(request, resposta.clone());
      return resposta;
    })
    .catch(() => null);

  return doCache ?? (await daRede) ?? Response.error();
}
