// Utilitários de imagem no cliente para o cadastro em lote por fotos.
// Objetivo: nunca decodificar a foto original em resolução cheia (12MP ~ 48MB RGBA cada),
// o que estoura o limite de memória de canvas/aba no celular após ~8 fotos.

const MIN_VALID_DATAURL_LENGTH = 1000; // "data:," e imagens vazias ficam abaixo disso

function isValidDataUrl(dataUrl) {
  return typeof dataUrl === 'string'
    && dataUrl.startsWith('data:image/')
    && dataUrl.length > MIN_VALID_DATAURL_LENGTH;
}

// Decodifica já reduzido (createImageBitmap com resize) quando suportado; senão cai para <img>.
async function decodeScaled(file, maxDimension) {
  if (typeof createImageBitmap === 'function') {
    try {
      // Só resizeWidth: o navegador preserva a proporção e nunca decodifica em tamanho cheio.
      const bitmap = await createImageBitmap(file, {
        resizeWidth: maxDimension,
        resizeQuality: 'medium'
      });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release: () => { try { bitmap.close(); } catch (_) {} }
      };
    } catch (_) {
      // Navegador sem suporte a opções de resize: usa fallback abaixo
    }
  }

  const blobUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      const timer = setTimeout(() => reject(new Error('timeout ao decodificar foto')), 15000);
      el.onload = () => { clearTimeout(timer); resolve(el); };
      el.onerror = () => { clearTimeout(timer); reject(new Error('formato de foto não suportado')); };
      el.src = blobUrl;
    });
    const scale = Math.min(1, maxDimension / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));
    // Pré-reduz num canvas pequeno para soltar o bitmap grande imediatamente
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').drawImage(img, 0, 0, width, height);
    img.src = '';
    return {
      source: canvas,
      width,
      height,
      release: () => { canvas.width = 0; canvas.height = 0; }
    };
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

function encode(source, width, height, quality) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas indisponível (memória do navegador esgotada)');
  ctx.drawImage(source, 0, 0, width, height);
  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  canvas.width = 0;
  canvas.height = 0;
  return dataUrl;
}

/**
 * Prepara uma foto para o lote.
 * @returns {{ dataUrl: string|null, thumbUrl: string, erro: string|null }}
 *  dataUrl: JPEG ~800px para a IA | thumbUrl: miniatura ~160px para a lista | erro: motivo legível
 */
export async function prepararFoto(file, maxDimension = 560, thumbDimension = 160) {
  let decoded = null;
  try {
    decoded = await decodeScaled(file, maxDimension);
    const dataUrl = encode(decoded.source, decoded.width, decoded.height, 0.75);
    if (!isValidDataUrl(dataUrl)) {
      return { dataUrl: null, thumbUrl: '', erro: 'foto gerou imagem vazia (memória do navegador)' };
    }
    const ts = Math.min(1, thumbDimension / Math.max(decoded.width, decoded.height));
    const thumbUrl = encode(
      decoded.source,
      Math.max(1, Math.round(decoded.width * ts)),
      Math.max(1, Math.round(decoded.height * ts)),
      0.7
    );
    return { dataUrl, thumbUrl: isValidDataUrl(thumbUrl) ? thumbUrl : '', erro: null };
  } catch (err) {
    return { dataUrl: null, thumbUrl: '', erro: err?.message || 'falha ao ler a foto' };
  } finally {
    if (decoded) decoded.release();
  }
}
