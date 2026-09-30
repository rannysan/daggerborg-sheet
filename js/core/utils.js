// Atrasa a execução até parar de ser chamado por `wait` ms.
// .flush() executa na hora o que estiver pendente.
export function debounce(fn, wait) {
  let timer = null;

  const debounced = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, wait);
  };

  // Descarta o que estiver pendente, sem executar
  debounced.cancel = () => {
    clearTimeout(timer);
    timer = null;
  };

  debounced.flush = () => {
    if (timer === null) return;
    clearTimeout(timer);
    timer = null;
    fn();
  };

  return debounced;
}

// "Ána Maria!" → "ana-maria" (para nomes de arquivo)
export function slugify(text) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// 2 → "+2", -1 → "-1", 0 → "0"
export function formatModifier(value) {
  return value > 0 ? `+${value}` : String(value);
}

export function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString('pt-BR');
}
