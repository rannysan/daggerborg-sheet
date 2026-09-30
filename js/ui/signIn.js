// Entrar com Google, com as mensagens de erro para o usuário.
// Usado pelo botão da barra superior (e por onde mais precisar).
import { showToast } from './dom.js';

// Erros do popup que não são falha de verdade (a pessoa só fechou/cancelou)
const CANCELLED = new Set(['auth/popup-closed-by-user', 'auth/cancelled-popup-request']);

/**
 * @param {import('../infra/firebase/AuthService.js').AuthService} auth
 * @param {(user: object) => Promise<void>} onSignIn  ex.: trocar para a nuvem e recarregar
 * @returns {Promise<boolean>} true se entrou
 */
export async function signInWithFeedback(auth, onSignIn) {
  try {
    const user = await auth.signIn();
    await onSignIn(user);
    return true;
  } catch (erro) {
    if (erro.code === 'auth/popup-blocked') {
      showToast('O navegador bloqueou a janela de login. Permita pop-ups para este site.');
    } else if (!CANCELLED.has(erro.code)) {
      console.error('[Conta] Falha ao entrar:', erro);
      showToast('Não foi possível entrar. Verifique a conexão e tente de novo.');
    }
    return false;
  }
}
