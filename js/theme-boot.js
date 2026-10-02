// Aplica o tema salvo ANTES da página aparecer (script comum, carregado no <head>),
// para não "piscar" o tema errado. A troca de tema depois fica em js/ui/theme.js.
// Preferência: 'dark' (padrão), 'light' ou 'system' (segue o aparelho).
(function () {
  var pref = 'dark';
  try { pref = localStorage.getItem('dagger-sheet:theme') || 'dark'; } catch (e) { /* armazenamento bloqueado */ }
  var dark = pref === 'system'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : pref !== 'light';
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
}());
