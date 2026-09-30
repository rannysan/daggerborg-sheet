// Recursos de PWA: service worker, botão de instalar e status da rede

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('sw.js');
      console.log('[PWA] Service worker registrado:', reg.scope);
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
