// Exportar e importar arquivos .json (backup e troca entre aparelhos)
const MAX_IMPORT_BYTES = 2 * 1024 * 1024; // 2 MB

export class FileService {
  downloadJson(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = Object.assign(document.createElement('a'), { href: url, download: filename });
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  async readJson(file) {
    if (file.size > MAX_IMPORT_BYTES) {
      throw new Error('Arquivo grande demais para ser uma ficha.');
    }
    try {
      return JSON.parse(await file.text());
    } catch {
      throw new Error('O arquivo não é um JSON válido.');
    }
  }
}
