import { fetchDiscogs, parseDiscogsItem } from '@/utils/discogsClient';

/**
 * Serviço especializado para processamento, reconhecimento visual e enriquecimento de fotos em lote
 */
export const loteFotosService = {
  /**
   * Envia uma foto (base64 DataURL) para o endpoint de IA com retentativas e backoff exponencial
   */
  async reconhecerFoto(dataUrl, onStatusUpdate) {
    if (!dataUrl) return null;
    const delays = [0, 2500, 5000];

    for (let tentativa = 0; tentativa < delays.length; tentativa++) {
      if (delays[tentativa] > 0) {
        if (onStatusUpdate) {
          onStatusUpdate(`Aguardando cota da IA... (${delays[tentativa] / 1000}s)`);
        }
        await new Promise((resolve) => setTimeout(resolve, delays[tentativa]));
      }

      try {
        const resposta = await fetch('/api/recognize-cover', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: dataUrl }),
        });

        if (resposta.status === 429 || resposta.status === 502 || resposta.status === 504) {
          console.warn(`[Lote] Tentativa ${tentativa + 1} retornou status ${resposta.status}.`);
          continue;
        }

        if (resposta.ok) {
          const dados = await resposta.json();
          if (dados && dados.success) {
            return dados;
          }
        }
      } catch (erro) {
        console.warn(`[Lote] Erro de rede na tentativa ${tentativa + 1}:`, erro);
      }
    }

    return null;
  },

  /**
   * Enriquece as informações detectadas pela IA consultando o acervo do Discogs
   */
  async enriquecerComDiscogs(artistaGemini, tituloGemini, anoGemini) {
    let discogsMatch = null;
    const termoBusca = [artistaGemini, tituloGemini].filter(Boolean).join(' ');

    if (termoBusca.trim()) {
      try {
        const dadosDiscogs = await fetchDiscogs({ q: termoBusca });
        if (dadosDiscogs?.results && dadosDiscogs.results.length > 0) {
          discogsMatch = dadosDiscogs.results[0];
        }
      } catch (erroDiscogs) {
        console.warn('Erro ao consultar Discogs no lote:', erroDiscogs);
      }
    }

    const itemNormalizado = parseDiscogsItem(discogsMatch);

    const finalArtista = artistaGemini || itemNormalizado?.artista || '';
    const finalTitulo = tituloGemini || itemNormalizado?.titulo || '';
    const finalAno = anoGemini || itemNormalizado?.ano || '';
    const finalSelo = itemNormalizado?.seloPrensagem || '';
    const finalCapa = itemNormalizado?.thumb || itemNormalizado?.cover || null;

    return {
      artista: finalArtista,
      titulo: finalTitulo,
      ano: finalAno,
      selo: finalSelo,
      capaUrl: finalCapa,
      discogsMatch,
    };
  },
};
