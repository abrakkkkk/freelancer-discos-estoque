import { supabase } from '@/lib/supabase';

const CACHE_TTL_MS = 10 * 60 * 1000;
const STORAGE_PREFIX = 'freelancer_caixas_';
const TOTAL_PADRAO_CAIXAS_LOJA_1 = 55;
const TOTAL_PADRAO_CAIXAS_LOJA_2 = 20;

/**
 * Formata, popula caixas obrigatórias de cada loja e ordena alfanumericamente
 */
function formatAndSortCaixas(dadosBrutos = [], lojaAtiva = '') {
  const mapaCaixas = new Map();

  // Caixas padrão para Loja 1 (Caixa 1 até Caixa 55)
  if (!lojaAtiva || lojaAtiva === 'Loja 1') {
    for (let numero = 1; numero <= TOTAL_PADRAO_CAIXAS_LOJA_1; numero++) {
      const valorCaixa = String(numero);
      const chave = `${valorCaixa}|Loja 1`;
      mapaCaixas.set(chave, {
        caixa: valorCaixa,
        loja: 'Loja 1',
        label: `Caixa ${numero}`,
      });
    }
  }

  // Caixas padrão para Loja 2 (Caixa 1B até Caixa 20B com sufixo B obrigatório)
  if (!lojaAtiva || lojaAtiva === 'Loja 2') {
    for (let numero = 1; numero <= TOTAL_PADRAO_CAIXAS_LOJA_2; numero++) {
      const nomeCaixa = `Caixa ${numero}B`;
      const chave = `${nomeCaixa}|Loja 2`;
      mapaCaixas.set(chave, {
        caixa: nomeCaixa,
        loja: 'Loja 2',
        label: nomeCaixa,
      });
    }
  }

  // Incorpora caixas registradas no banco que ainda não estão no mapa
  dadosBrutos.forEach((item) => {
    if (item && item.caixa) {
      const chave = `${item.caixa}|${item.loja || ''}`;
      if (!mapaCaixas.has(chave)) {
        const isNumeroPuro = !isNaN(Number(item.caixa)) && String(item.caixa).trim() !== '';
        const rotuloFormatado =
          item.loja === 'Loja 1' && isNumeroPuro ? `Caixa ${item.caixa}` : item.caixa;

        mapaCaixas.set(chave, {
          caixa: item.caixa,
          loja: item.loja || '',
          label: rotuloFormatado,
        });
      }
    }
  });

  // Ordenação inteligente: numéricos primeiro, depois alfanuméricos com natural sort
  return Array.from(mapaCaixas.values()).sort((a, b) => {
    const valorNumericoA = Number(a.caixa);
    const valorNumericoB = Number(b.caixa);

    if (!isNaN(valorNumericoA) && !isNaN(valorNumericoB)) {
      if (valorNumericoA === valorNumericoB) {
        return a.loja.localeCompare(b.loja);
      }
      return valorNumericoA - valorNumericoB;
    }

    const comparacaoTexto = String(a.caixa).localeCompare(String(b.caixa), undefined, {
      numeric: true,
    });
    if (comparacaoTexto === 0) {
      return a.loja.localeCompare(b.loja);
    }
    return comparacaoTexto;
  });
}

function obterDoSessionStorage(chave) {
  if (typeof window === 'undefined') return null;
  try {
    const conteudoBruto = sessionStorage.getItem(STORAGE_PREFIX + chave);
    if (!conteudoBruto) return null;
    const itemArmazenado = JSON.parse(conteudoBruto);
    if (Date.now() - itemArmazenado.timestamp < CACHE_TTL_MS) {
      return itemArmazenado.data;
    }
  } catch {
    // sessionStorage indisponível ou corrompido
  }
  return null;
}

function salvarNoSessionStorage(chave, dados) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(
      STORAGE_PREFIX + chave,
      JSON.stringify({ timestamp: Date.now(), data: dados })
    );
  } catch {
    // quota de storage excedida ou indisponível
  }
}

export const caixaService = {
  _cacheEmMemoria: new Map(),

  /**
   * Retorna caixas padrão imediatamente de forma síncrona para renderização instantânea
   */
  getDefaultCaixas(loja = '') {
    return formatAndSortCaixas([], loja);
  },

  _salvarCache(chave, caixas) {
    this._cacheEmMemoria.set(chave, { timestamp: Date.now(), data: caixas });
    salvarNoSessionStorage(chave, caixas);
    return caixas;
  },

  /**
   * Busca caixas e localizações com estratégia de cache em 2 camadas (Memória + SessionStorage)
   * e fallback otimizado via RPC ou paginação paralela no banco
   */
  async getCaixas(loja = '') {
    const chaveCache = loja || 'TODAS';

    // 1. Memória RAM da sessão (0ms)
    const cacheMemoria = this._cacheEmMemoria.get(chaveCache);
    if (cacheMemoria && Date.now() - cacheMemoria.timestamp < CACHE_TTL_MS) {
      return cacheMemoria.data;
    }

    // 2. SessionStorage do navegador (0ms, persiste entre navegação de rotas)
    const cacheSessao = obterDoSessionStorage(chaveCache);
    if (cacheSessao) {
      this._cacheEmMemoria.set(chaveCache, { timestamp: Date.now(), data: cacheSessao });
      return cacheSessao;
    }

    // 3. Consulta via RPC otimizada no Supabase (~15ms)
    try {
      const { data: dadosRpc, error: erroRpc } = await supabase.rpc('get_distinct_caixas', {
        p_loja: loja || null,
      });

      if (!erroRpc && Array.isArray(dadosRpc)) {
        return this._salvarCache(chaveCache, formatAndSortCaixas(dadosRpc, loja));
      }
    } catch {
      // RPC não disponível; segue para o fallback de varredura
    }

    // 4. Fallback: Varredura paginada paralela em todas as tabelas de mídia
    const tabelas = ['discos', 'dvds', 'cds', 'vhs'];
    const tamanhoBloco = 1000;

    const promessasTabelas = tabelas.map(async (nomeTabela) => {
      let queryContagem = supabase
        .from(nomeTabela)
        .select('caixa', { count: 'exact', head: true })
        .eq('deletado', false)
        .not('caixa', 'is', null);

      if (loja) {
        queryContagem = queryContagem.eq('loja', loja);
      }

      const { count: totalRegistros, error: erroContagem } = await queryContagem;
      if (erroContagem || !totalRegistros) return [];

      const promessasPaginas = [];
      for (let offset = 0; offset < totalRegistros; offset += tamanhoBloco) {
        let queryPagina = supabase
          .from(nomeTabela)
          .select('caixa, loja')
          .eq('deletado', false)
          .not('caixa', 'is', null)
          .range(offset, offset + tamanhoBloco - 1);

        if (loja) {
          queryPagina = queryPagina.eq('loja', loja);
        }
        promessasPaginas.push(queryPagina);
      }

      const paginasCarregadas = await Promise.all(promessasPaginas);
      return paginasCarregadas.flatMap((resposta) => resposta.data || []);
    });

    const resultadosTabelas = await Promise.all(promessasTabelas);
    return this._salvarCache(chaveCache, formatAndSortCaixas(resultadosTabelas.flat(), loja));
  },

  /**
   * Invalida caches de memória e sessionStorage quando ocorrem mutações de localização
   */
  invalidateCache() {
    this._cacheEmMemoria.clear();
    if (typeof window !== 'undefined') {
      try {
        Object.keys(sessionStorage).forEach((chave) => {
          if (chave.startsWith(STORAGE_PREFIX)) {
            sessionStorage.removeItem(chave);
          }
        });
      } catch {
        // Ignora erros ao limpar storage
      }
    }
  },
};
