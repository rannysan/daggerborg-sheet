// Recursos de PWA: service worker, botão de instalar e status da rede

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  // Versão nova publicada: quando o service worker novo assume, recarrega uma
  // vez para a tela usar os arquivos novos (sem isso, o app instalado seguia
  // mostrando a versão antiga). Na primeira visita não há controlador antigo,
  // então não recarrega à toa.
  const hadController = Boolean(navigator.serviceWorker.controller);
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    reloading = true;
    location.reload();
  });

  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('sw.js');
      console.log('[PWA] Service worker registrado:', reg.scope);
      // Ao voltar para o app (ex.: reabrir o app instalado), procura versão nova
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {});
      });
    } catch (erro) {
      console.error('[PWA] Falha ao registrar o service worker:', erro);
    }
  });
}

// Android/Chrome/Edge disparam beforeinstallprompt quando o site pode ser instalado.
// No iPhone a instalação é por Compartilhar → "Adicionar à Tela de Início".
export function setupInstallButton(button) {
  let installEvent = null;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installEvent = e;
    button.hidden = false;
  });

  button.addEventListener('click', async () => {
    if (!installEvent) return;
    installEvent.prompt();
    await installEvent.userChoice;
    installEvent = null;
    button.hidden = true;
  });

  window.addEventListener('appinstalled', () => {
    button.hidden = true;
  });
}

// Como num app: o aviso só aparece quando está SEM internet
export function setupNetworkStatus(element) {
  const refresh = () => {
    element.hidden = navigator.onLine;
  };
  window.addEventListener('online', refresh);
  window.addEventListener('offline', refresh);
  refresh();
}
