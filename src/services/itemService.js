import { supabase } from '@/lib/supabase';
import { removeAcentos, extractSearchTokens, createRelevanceScorer, accentInsensitivePattern } from '@/utils/stringUtils';
import { caixaService } from '@/services/caixaService';
import { createStockWriteService } from '@/services/stockWriteService.mjs';

const stockWriteService = createStockWriteService({
  rpc: (...args) => supabase.rpc(...args),
  invalidateCache: () => caixaService.invalidateCache(),
});

const isVideoCategory = (category) => category === 'dvds' || category === 'vhs';

/**
 * Aplica filtros de caixa na query Supabase suportando variações de Loja 1 e Loja 2
 */
function aplicarFiltroCaixaNaQuery(query, filtroCaixa) {
  if (!filtroCaixa) return query;

  const matchSufixoB = filtroCaixa.match(/^(?:caixa|c)?\s*(\d+)\s*b$/i);
  const matchNumeroPuro = filtroCaixa.match(/^(?:caixa|c)?\s*(\d+)$/i);

  if (matchSufixoB) {
    const numero = matchSufixoB[1];
    return query.in('caixa', [`Caixa ${numero}B`, `Caixa ${numero}b`, `${numero}B`, `${numero}b`]);
  }

  if (matchNumeroPuro) {
    const numero = matchNumeroPuro[1];
    return query.in('caixa', [numero, `Caixa ${numero}`]);
  }

  return query.eq('caixa', filtroCaixa);
}

async function buscarCopiasInativas(category, { titulo, artista, excludeId = null }) {
  if (!titulo || titulo.trim().length < 2) return [];

  const isVideo = isVideoCategory(category);
  const tituloLimpo = titulo.trim();
  const tituloSemAcento = removeAcentos(tituloLimpo);
  const { effectiveWords: palavrasTitulo } = extractSearchTokens(tituloLimpo);

  let colunas = 'id, titulo, preco, loja, caixa, ativo, ano';
  if (!isVideo) colunas += ', artista';

  let query = supabase.from(category).select(colunas).eq('deletado', false).eq('ativo', false);

  if (excludeId) {
    query = query.neq('id', excludeId);
  }

  palavrasTitulo.slice(0, 3).forEach((palavra) => {
    if (palavra.length >= 2) {
      query = query.filter('titulo', 'imatch', accentInsensitivePattern(palavra));
    }
  });

  let palavrasArtista = [];
  if (!isVideo && artista && artista.trim().length >= 2) {
    palavrasArtista = extractSearchTokens(artista).effectiveWords;
    palavrasArtista.slice(0, 2).forEach((palavra) => {
      if (palavra.length >= 2) {
        query = query.filter('artista', 'imatch', accentInsensitivePattern(palavra));
      }
    });
  }

  const { data: dadosItens, error } = await query.limit(10);
  if (error || !dadosItens) return [];

  return dadosItens.filter((item) => {
    const itemTitulo = removeAcentos(item.titulo || '');
    const matchTitulo =
      palavrasTitulo.length > 0
        ? palavrasTitulo.every((palavra) => itemTitulo.includes(palavra))
        : itemTitulo.includes(tituloSemAcento) || tituloSemAcento.includes(itemTitulo);

    if (isVideo) return matchTitulo;

    if (artista && artista.trim().length >= 2) {
      const itemArtista = removeAcentos(item.artista || '');
      const matchArtista =
        palavrasArtista.length > 0
          ? palavrasArtista.every((palavra) => itemArtista.includes(palavra))
          : true;
      return matchTitulo && matchArtista;
    }

    return matchTitulo;
  });
}

export const itemService = {
  /**
   * Busca itens do catálogo com suporte a paginação, filtros, ordenação e pesquisa fonética
   */
  async fetchItems(category, {
    pagina = 1,
    itensPorPagina = 50,
    filtroCaixa = '',
    filtroLoja = '',
    busca = '',
    mostrarAtivos = true,
    mostrarInativos = false,
    ordenarColuna = null,
    ordenarDirecao = null,
  } = {}) {
    const isVideo = isVideoCategory(category);

    let colunas = 'id, titulo, preco, ativo, loja, observacao, caixa, ano, capa_url';
    if (!isVideo) colunas += ', artista';

    let query = supabase.from(category).select(colunas, { count: 'exact' }).eq('deletado', false);

    // Filtros de status (Ativo / Inativo)
    if (mostrarAtivos && !mostrarInativos) query = query.eq('ativo', true);
    else if (!mostrarAtivos && mostrarInativos) query = query.eq('ativo', false);
    else if (!mostrarAtivos && !mostrarInativos) return { data: [], count: 0 };

    // Filtros de caixa e loja
    query = aplicarFiltroCaixaNaQuery(query, filtroCaixa);
    if (filtroLoja) query = query.eq('loja', filtroLoja);

    // Ordenação
    if (ordenarColuna && ordenarDirecao) {
      const crescente = ordenarDirecao === 'asc';
      query = query.order(ordenarColuna, { ascending: crescente, nullsFirst: crescente });
    } else {
      if (category === 'discos') query = query.order('caixa');
      if (!isVideo) query = query.order('artista');
      query = query.order('titulo');
    }

    // Pré-filtro SQL no banco para busca
    let tokensBusca = null;
    if (busca) {
      tokensBusca = extractSearchTokens(busca);
      const { effectiveWords } = tokensBusca;

      effectiveWords.forEach((palavra) => {
        const padrao = accentInsensitivePattern(palavra);
        if (isVideo) {
          query = query.filter('titulo', 'imatch', padrao);
        } else {
          query = query.or(`titulo.imatch."${padrao}",artista.imatch."${padrao}",caixa.imatch."${padrao}"`);
        }
      });
      query = query.limit(5000);
    } else {
      query = query.range((pagina - 1) * itensPorPagina, pagina * itensPorPagina - 1);
    }

    const { data: dadosBrutos, count, error } = await query;
    if (error) throw error;

    let itensFiltrados = dadosBrutos || [];

    // Refinamento em memória sem acentos e ordenação por relevância
    if (busca && tokensBusca) {
      const { effectiveWords } = tokensBusca;

      itensFiltrados = itensFiltrados.filter((item) => {
        const tituloSemAcento = removeAcentos(item.titulo || '');
        const artistaSemAcento = removeAcentos(item.artista || '');
        const caixaSemAcento = removeAcentos(item.caixa || '');
        const caixaSemEspaco = caixaSemAcento.replace(/\s+/g, '');

        return effectiveWords.every((palavra) => {
          const palavraSemEspaco = palavra.replace(/\s+/g, '');
          if (isVideo) {
            return tituloSemAcento.includes(palavra);
          }
          return (
            tituloSemAcento.includes(palavra) ||
            artistaSemAcento.includes(palavra) ||
            caixaSemAcento.includes(palavra) ||
            (palavraSemEspaco && caixaSemEspaco.includes(palavraSemEspaco))
          );
        });
      });

      if (!ordenarColuna) {
        const pontuar = createRelevanceScorer(tokensBusca, isVideo);
        const pontuacoes = new Map(itensFiltrados.map((item) => [item, pontuar(item)]));
        itensFiltrados.sort((itemA, itemB) => pontuacoes.get(itemB) - pontuacoes.get(itemA));
      }
    }

    let itensPaginados = itensFiltrados;
    if (busca) {
      const indiceInicio = (pagina - 1) * itensPorPagina;
      itensPaginados = itensFiltrados.slice(indiceInicio, indiceInicio + itensPorPagina);
    }

    return { data: itensPaginados, count: busca ? itensFiltrados.length : count };
  },

  /**
   * Busca um único item pelo ID
   */
  async getItemById(category, id) {
    const { data, error } = await supabase.from(category).select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  },

  /**
   * Adiciona um novo item e invalida cache de caixas se aplicável
   */
  async addItem(category, insertData, movementPayload, observationPayload = null) {
    return stockWriteService.addItem(category, insertData, movementPayload, observationPayload);
  },

  /**
   * Atualiza dados de um item existente
   */
  async updateItem(category, id, updateData) {
    const { data, error } = await supabase
      .from(category)
      .update(updateData)
      .eq('id', id)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('O item não existe ou não está acessível. Atualize a tela e tente novamente.');
    if (updateData.caixa !== undefined || updateData.loja !== undefined) {
      caixaService.invalidateCache();
    }
  },

  async bulkUpdate(category, ids, updateData) {
    return stockWriteService.bulkUpdate(category, ids, updateData);
  },

  /**
   * Exclusão com registro automático de saída conforme Regra 1.2 (ativo gera saída, inativo não)
   */
  async deleteItemWithMovement(category, item, motivo = 'Saída (Excluído)') {
    return stockWriteService.deleteItemWithMovement(category, item, motivo);
  },

  /**
   * Exclusão em lote com registro de saída para os itens que eram ativos
   */
  async bulkDeleteWithMovement(category, itens, motivo = 'Saída em Lote') {
    return stockWriteService.bulkDeleteWithMovement(category, itens, motivo);
  },

  /**
   * Busca sugestões de autocompletar para artistas ou títulos
   */
  async searchSuggestions(category, campo, valor) {
    if (!valor || valor.trim().length < 2) return [];
    const buscaTratada = removeAcentos(valor).trim();

    if (campo === 'artista') {
      const { data, error } = await supabase
        .from(category)
        .select('artista')
        .order('id', { ascending: false })
        .limit(1000);

      if (error) throw error;

      const filtrados = data.filter((item) => removeAcentos(item.artista).includes(buscaTratada));
      return [...new Set(filtrados.map((item) => item.artista).filter(Boolean))].slice(0, 20);
    }

    if (campo === 'titulo') {
      const isVideo = isVideoCategory(category);
      const colunas = isVideo ? 'titulo, preco, loja' : 'artista, titulo, preco, loja';

      const { data, error } = await supabase
        .from(category)
        .select(colunas)
        .order('id', { ascending: false })
        .limit(1000);

      if (error) throw error;

      const filtrados = data.filter((item) => removeAcentos(item.titulo).includes(buscaTratada));
      const sugestoesUnicas = [];
      const titulosVistos = new Set();

      for (const item of filtrados) {
        if (sugestoesUnicas.length >= 30) break;
        const chave = isVideo ? item.titulo : `${item.artista}-${item.titulo}`;
        if (!titulosVistos.has(chave)) {
          titulosVistos.add(chave);
          sugestoesUnicas.push(item);
        }
      }
      return sugestoesUnicas;
    }

    return [];
  },

  /**
   * Busca cópias inativas (Estoque Superior) para reposição automática
   */
  async findReplacements(category, { titulo, artista, excludeId = null }) {
    return buscarCopiasInativas(category, { titulo, artista, excludeId });
  },

  /**
   * Promove disco reserva do Estoque Superior (Inativo) para o chão de loja (Ativo)
   */
  async promoteReplacement(category, replacementId, targetCaixa, targetLoja, movementPayload) {
    return stockWriteService.promoteReplacement(
      category,
      replacementId,
      targetCaixa,
      targetLoja,
      movementPayload
    );
  },
};
