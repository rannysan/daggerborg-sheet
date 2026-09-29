// Prepara a imagem do personagem: recorta em quadrado (centro), reduz e comprime.
// Resultado é um data URL pequeno (~30-50 KB), salvo junto da ficha e no .json exportado.
const MAX_INPUT_BYTES = 15 * 1024 * 1024;

export class ImageService {
  async toPortrait(file, { size = 384, quality = 0.85 } = {}) {
    if (!file.type.startsWith('image/')) {
      throw new Error('Escolha um arquivo de imagem.');
    }
    if (file.size > MAX_INPUT_BYTES) {
      throw new Error('Imagem grande demais (máximo 15 MB).');
    }

    let bitmap;
    try {
      bitmap = await createImageBitmap(file);
    } catch {
      throw new Error('Não foi possível ler essa imagem.');
    }

    const side = Math.min(bitmap.width, bitmap.height);
    const out = Math.min(size, side);
    const canvas = document.createElement('canvas');
    canvas.width = out;
    canvas.height = out;
    canvas.getContext('2d').drawImage(
      bitmap,
      (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side,
      0, 0, out, out,
    );
    bitmap.close?.();

    // WebP é bem menor; navegadores sem suporte devolvem PNG, aí usamos JPEG
    const webp = canvas.toDataURL('image/webp', quality);
    return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', quality);
  }
}
