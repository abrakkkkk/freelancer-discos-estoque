import { supabase } from '@/lib/supabase';
import { createMovementPayload as buildMovementPayload, getMovementForeignKey } from '@/utils/movementPayload.mjs';

/**
 * Retorna a data de corte em formato ISO para o período especificado
 * @param {'hoje' | 'semana' | 'mes' | 'todos'} filtroPeriodo
 * @returns {string | null}
 */
function calcularDataInicioPeriodo(filtroPeriodo) {
  const agora = new Date();
  agora.setHours(0, 0, 0, 0);

  if (filtroPeriodo === 'hoje') {
    return agora.toISOString();
  }

  if (filtroPeriodo === 'semana') {
    const dataSemana = new Date(agora);
    dataSemana.setDate(dataSemana.getDate() - 7);
    return dataSemana.toISOString();
  }

  if (filtroPeriodo === 'mes') {
    const dataMes = new Date(agora);
    dataMes.setDate(dataMes.getDate() - 30);
    return dataMes.toISOString();
  }

  return null;
}

export const movimentacaoService = {
  async addObservation(category, itemId, observation) {
    const foreignKey = getMovementForeignKey(category);

    const { data, error } = await supabase.rpc('stock_write_transaction', {
      p_action: 'add_observation',
      p_category: category,
      p_item_id: itemId,
      p_payload: { observacao: observation },
      p_observation: { [foreignKey]: itemId, observacao: observation },
    });
    if (error) throw error;
    return data;
  },

  async deleteObservation(category, itemId, observationId) {
    const { data, error } = await supabase.rpc('stock_write_transaction', {
      p_action: 'delete_observation',
      p_category: category,
      p_item_id: itemId,
      p_ids: [observationId],
    });
    if (error) throw error;
    return data;
  },

  /**
   * Busca histórico de movimentações com paginação automática e filtros de período, tipo e loja
   */
  async fetchMovimentacoes(filtroPeriodo = 'semana', filtroTipoMov = '', filtroLoja = '') {
    const dataInicioFiltro = calcularDataInicioPeriodo(filtroPeriodo);
    const limiteMaximoLinhas = filtroPeriodo === 'todos' ? 3000 : 5000;
    const tamanhoPagina = 1000;

    let registrosCompletos = [];
    let offset = 0;

    while (registrosCompletos.length < limiteMaximoLinhas) {
      let query = supabase
        .from('movimentacoes')
        .select(`
          id, tipo, observacao, criado_em,
          discos ( caixa, artista, titulo, loja ),
          dvds ( titulo, loja, caixa ),
          cds ( artista, titulo, loja, caixa ),
          vhs ( titulo, loja, caixa )
        `)
        .order('criado_em', { ascending: false })
        .range(offset, offset + tamanhoPagina - 1);

      if (dataInicioFiltro) {
        query = query.gte('criado_em', dataInicioFiltro);
      }

      if (filtroTipoMov) {
        query = query.eq('tipo', filtroTipoMov);
      }

      const { data: paginaRegistros, error } = await query;
      if (error) throw error;
      if (!paginaRegistros || paginaRegistros.length === 0) break;

      registrosCompletos = registrosCompletos.concat(paginaRegistros);
      if (paginaRegistros.length < tamanhoPagina) break;

      offset += tamanhoPagina;
    }

    // Filtragem em memória para loja devido à complexidade de joins dinâmicos do Supabase
    if (filtroLoja) {
      return registrosCompletos.filter((movimentacao) => {
        const itemRelacionado =
          movimentacao.discos || movimentacao.dvds || movimentacao.cds || movimentacao.vhs;
        return itemRelacionado && itemRelacionado.loja === filtroLoja;
      });
    }

    return registrosCompletos;
  },

  /**
   * Constrói o payload padronizado da movimentação associando à chave estrangeira correta
   */
  createMovementPayload(category, itemId, tipo, quantidade, observacao) {
    return buildMovementPayload(category, itemId, tipo, quantidade, observacao);
  },
};
