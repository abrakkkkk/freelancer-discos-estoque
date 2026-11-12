'use client';

import { useState, useEffect, useMemo } from 'react';
import { MdHistory } from 'react-icons/md';
import { movimentacaoService } from '@/services/movimentacaoService';
import { removeAcentos } from '@/utils/stringUtils';
import { useStore } from '@/contexts/StoreContext';
import MovimentacoesFilters from '@/components/MovimentacoesFilters';
import MovimentacoesList, { extrairDadosItemMovimentacao } from '@/components/MovimentacoesList';
import CatalogPagination from '@/components/CatalogPagination';

const ITENS_POR_PAGINA = 50;

export default function Movimentacoes() {
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [filtroTipoMov, setFiltroTipoMov] = useState('');
  const [filtroPeriodo, setFiltroPeriodo] = useState('semana');
  const [filtroLoja, setFiltroLoja] = useState('');
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [reloadCount, setReloadCount] = useState(0);
  const [pagina, setPagina] = useState(1);
  const { activeStore } = useStore();

  // Sincroniza loja ativa com o contexto global
  useEffect(() => {
    setFiltroLoja(activeStore || '');
  }, [activeStore]);

  // Reseta página para a primeira sempre que qualquer filtro se altera
  useEffect(() => {
    setPagina(1);
  }, [filtroTipoMov, filtroPeriodo, filtroLoja, busca]);

  // Carrega o histórico de movimentações com base nos filtros centrais
  useEffect(() => {
    let ativo = true;
    const carregarHistorico = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const dados = await movimentacaoService.fetchMovimentacoes(
          filtroPeriodo,
          filtroTipoMov,
          filtroLoja
        );
        if (ativo) {
          setMovimentacoes(dados || []);
          setLoadError(null);
        }
      } catch (erro) {
        console.error('Erro ao buscar histórico de movimentações:', erro);
        if (ativo) {
          setMovimentacoes([]);
          setLoadError('Não foi possível carregar o histórico. Verifique a conexão e tente novamente.');
        }
      } finally {
        if (ativo) {
          setLoading(false);
        }
      }
    };

    carregarHistorico();

    return () => {
      ativo = false;
    };
  }, [filtroTipoMov, filtroPeriodo, filtroLoja, reloadCount]);

  // Contadores semânticos para o cabeçalho
  const { totalEntradas, totalSaidas } = useMemo(() => {
    return {
      totalEntradas: movimentacoes.filter((m) => m.tipo === 'entrada').length,
      totalSaidas: movimentacoes.filter((m) => m.tipo === 'saida').length,
    };
  }, [movimentacoes]);

  // Filtragem client-side por texto (artista, título, observação ou caixa)
  const movimentacoesFiltradas = useMemo(() => {
    const termoLimpo = busca.trim();
    if (!termoLimpo) return movimentacoes;

    const termoNormalizado = removeAcentos(termoLimpo);

    return movimentacoes.filter((m) => {
      const item = extrairDadosItemMovimentacao(m);
      const artista = removeAcentos(item.artista || '');
      const titulo = removeAcentos(item.titulo || '');
      const observacao = removeAcentos(m.observacao || '');
      const caixa = removeAcentos(item.caixa || '');

      return (
        artista.includes(termoNormalizado) ||
        titulo.includes(termoNormalizado) ||
        observacao.includes(termoNormalizado) ||
        caixa.includes(termoNormalizado)
      );
    });
  }, [movimentacoes, busca]);

  const totalItens = movimentacoesFiltradas.length;
  const totalPaginas = Math.max(1, Math.ceil(totalItens / ITENS_POR_PAGINA));

  const itensPaginados = useMemo(() => {
    const indiceInicio = (pagina - 1) * ITENS_POR_PAGINA;
    return movimentacoesFiltradas.slice(indiceInicio, indiceInicio + ITENS_POR_PAGINA);
  }, [movimentacoesFiltradas, pagina]);

  const temFiltrosAtivos = Boolean(busca || filtroTipoMov || filtroPeriodo !== 'semana');

  return (
    <div className="pageContainer mov-page">
      {/* Cabeçalho minimalista */}
      <div className="mov-header-clean">
        <h1>
          <MdHistory size={22} color="var(--accent)" />
          Histórico de Movimentações
        </h1>
        {!loading && movimentacoes.length > 0 && (
          <div className="mov-header-counter">
            <span>
              <strong style={{ color: '#34d399', fontWeight: 500 }}>{totalEntradas}</strong> entradas
            </span>
            <span style={{ opacity: 0.35 }}>•</span>
            <span>
              <strong style={{ color: '#f87171', fontWeight: 500 }}>{totalSaidas}</strong> saídas
            </span>
          </div>
        )}
      </div>

      <div className="mov-panel-clean">
        {/* Barra de Filtros */}
        <MovimentacoesFilters
          busca={busca}
          onBuscaChange={setBusca}
          filtroTipoMov={filtroTipoMov}
          onFiltroTipoMovChange={setFiltroTipoMov}
          filtroPeriodo={filtroPeriodo}
          onFiltroPeriodoChange={setFiltroPeriodo}
          filtroLoja={filtroLoja}
          onFiltroLojaChange={setFiltroLoja}
          activeStore={activeStore}
        />

        {loadError ? (
          <div className="alert alert-error" role="alert" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            <span>{loadError}</span>
            <button type="button" className="btn btn-secondary" onClick={() => setReloadCount((count) => count + 1)}>
              Tentar novamente
            </button>
          </div>
        ) : (
          <>
            {/* Listagem (feed mobile e tabela desktop) */}
            <MovimentacoesList
              itens={itensPaginados}
              loading={loading}
              totalItens={totalItens}
              temFiltrosAtivos={temFiltrosAtivos}
              activeStore={activeStore}
            />

            {/* Paginação Reutilizável */}
            <CatalogPagination
              pagina={pagina}
              totalPaginas={totalPaginas}
              onPageChange={setPagina}
            />
          </>
        )}
      </div>
    </div>
  );
}
