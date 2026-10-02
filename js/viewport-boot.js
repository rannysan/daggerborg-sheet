// Corrige a escala em celulares que desenham a página mais larga que a tela
// (ex.: Chrome em "Site para computador", que usa ~980px num celular de ~360px
// e deixa tudo minúsculo). Script comum no <head>, roda antes de pintar.
//
// 1º tenta fixar o viewport na largura real da tela; se o navegador ignorar,
// aplica zoom na página inteira na mesma proporção. Marca <html data-zoom>
// para o CSS saber que a largura informada não é a largura útil.
(function () {
  var root = document.documentElement;
  var meta = document.querySelector('meta[name="viewport"]');
  if (!window.matchMedia || !window.matchMedia('(pointer: coarse)').matches) return;

  // Largura real da tela na orientação atual (no iPhone, screen não gira)
  function screenWidth() {
    var w = screen.width, h = screen.height;
    if (!w || !h) return 0;
    return window.innerWidth > window.innerHeight ? Math.max(w, h) : Math.min(w, h);
  }

  function ratio() {
    var real = screenWidth();
    return real ? window.innerWidth / real : 1;
  }

  function apply() {
    root.style.zoom = '';
    root.style.removeProperty('--zoom');
    root.removeAttribute('data-zoom');
    var r = ratio();
    if (r > 1.15) {
      var zoom = String(Math.round(r * 100) / 100);
      root.style.zoom = zoom;
      // O zoom também multiplica alturas em vh/dvh; o CSS divide por --zoom
      root.style.setProperty('--zoom', zoom);
      root.setAttribute('data-zoom', '');
    }
  }

  if (ratio() > 1.15 && meta) {
    meta.setAttribute('content', 'width=' + screenWidth() + ', initial-scale=1.0, viewport-fit=cover');
  }
  apply();
  // Girar o celular muda a largura real
  window.addEventListener('orientationchange', function () { setTimeout(apply, 300); });
}());
