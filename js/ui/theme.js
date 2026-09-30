// Tema (escuro/claro/sistema), por aparelho. O primeiro tema é aplicado por
// js/theme-boot.js no <head>; aqui fica a troca pelo Perfil.
const KEY = 'dagger-sheet:theme';
const THEME_COLORS = { dark: '#0e0c14', light: '#f6f4fb' };

export const THEME_OPTIONS = Object.freeze([
  { value: 'dark', label: 'Escuro' },
  { value: 'light', label: 'Claro' },
  { value: 'system', label: 'Do aparelho' },
]);

export function getThemePreference() {
  try {
    return localStorage.getItem(KEY) || 'dark';
  } catch {
    return 'dark';
  }
}

const systemDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches;

export function applyTheme(pref = getThemePreference()) {
  const theme = pref === 'system' ? (systemDark() ? 'dark' : 'light') : pref === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = theme;
  // Cor da barra do sistema (celular / app instalado)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme]);
}

export function setThemePreference(pref) {
  try {
    localStorage.setItem(KEY, pref);
  } catch { /* armazenamento bloqueado: vale só nesta visita */ }
  applyTheme(pref);
}

// Com "Do aparelho", acompanha quando o sistema troca entre claro e escuro
export function watchSystemTheme() {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (getThemePreference() === 'system') applyTheme('system');
  });
  applyTheme();
}
