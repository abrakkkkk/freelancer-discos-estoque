'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { MdLayers } from "react-icons/md";
import { FiSearch, FiCheck } from 'react-icons/fi';
import { IoClose } from 'react-icons/io5';
import { useCaixas } from '@/hooks/useCaixas';
import { itemService } from '@/services/itemService';
import { movimentacaoService } from '@/services/movimentacaoService';
import { supabase } from '@/lib/supabase';
import CategoryTabs from '@/components/CategoryTabs';
import AlertMessage from '@/components/AlertMessage';
import ConfirmModal from '@/components/ConfirmModal';
import { CATEGORY_IDS, STORE_OPTIONS, getStoreColor, getStoreBadgeColor } from '@/constants/config';
import { removeAcentos, formatCaixa, normalizeCaixa } from '@/utils/stringUtils';
import { useUndo } from '@/contexts/UndoContext';
import SuccessModal from '@/components/SuccessModal';
import { useStore } from '@/contexts/StoreContext';
import { useTouchGuardTap } from '@/hooks/useTouchGuardTap';

/**
 * Utilitários de persistência de sessão para o módulo de Lote
 */
const loteStorage = {
  get(key, defaultValue) {
    if (typeof window === 'undefined') return defaultValue;
    try {
      const savedItem = sessionStorage.getItem(`lote_${key}`);
      return savedItem !== null ? JSON.parse(savedItem) : defaultValue;
    } catch {
      return defaultValue;
    }
  },
  set(key, value) {
    if (typeof window === 'undefined') return;
    try {
      sessionStorage.setItem(`lote_${key}`, JSON.stringify(value));
    } catch (error) {
      console.warn(`Erro ao salvar lote_${key} no sessionStorage:`, error);
    }
  },
  remove(key) {
    if (typeof window === 'undefined') return;
    sessionStorage.removeItem(`lote_${key}`);
  },
  clearFormDraft() {
    this.remove('novaLocalizacao');
    this.remove('lojaDestino');
  },
  clearSelection() {
    this.remove('selecionados');
    this.remove('selecionadosData');
  }
};

function LoteCardRow({
  item,
  isItemSelecionado,
  toggleSelecionar,
  isVideo,
  activeStore,
}) {
  const touchProps = useTouchGuardTap(() => {
    toggleSelecionar(item.id);
  });

  const edicaoTag = item.observacao?.match(/^\[([^\]]+)\]/)?.[1] || null;
  const edicaoTemAno = Boolean(
    edicaoTag && (
      /\b(19\d{2}|20\d{2})\b/.test(edicaoTag) ||
      (item.ano && edicaoTag.includes(String(item.ano).trim()))
    )
  );
  const metaLote = [edicaoTag, !edicaoTemAno && item.ano].filter(Boolean).join(' · ');
  const mostrarLojaLote = !activeStore && item.loja;
  const corLoja = getStoreBadgeColor(item.loja);

  return (
    <tr
      key={item.id}
      {...touchProps}
      className={`lote-card ${isItemSelecionado ? 'lote-card-selected' : ''}`}
      style={{ opacity: item.ativo === false ? 0.6 : 1, cursor: 'pointer' }}
    >
      <td data-label="Selecionar" className="lote-card-select-col">
        <div className={`lote-checkbox-custom ${isItemSelecionado ? 'checked' : ''}`}>
          <input
            type="checkbox"
            checked={isItemSelecionado}
            onChange={() => {}}
            onClick={(e) => {
              e.stopPropagation();
              toggleSelecionar(item.id);
            }}
            aria-label={`Selecionar ${item.titulo || 'item'}`}
            className="lote-checkbox-input"
          />
          {isItemSelecionado && <FiCheck size={10} color="#ffffff" strokeWidth={3.5} />}
        </div>
      </td>

      {/* Card Info Mobile (estilo novo padronizado com o catálogo) */}
      <td data-label="Info" className="cell-disco-info lote-cell-info">
        <div className="disco-header-row lote-header-row">
          <span className="disco-titulo">{item.titulo || <span className="text-empty">—</span>}</span>
        </div>
        {!isVideo && item.artista && (
          <span className="disco-artista">{item.artista}</span>
        )}
        {(metaLote || item.ativo === false) && (
          <span className="disco-meta">
            {metaLote && (
              <span className="disco-meta-texto">
                {edicaoTag && <span className="edicao-dot" aria-hidden="true" />}
                {metaLote}
              </span>
            )}
            {item.ativo === false && <span className="disco-status-inativo">Inativo</span>}
          </span>
        )}
        <div className="disco-valores-row lote-valores-row">
          <span className="disco-valor-preco">
            {item.preco ? `R$ ${Number(item.preco).toFixed(2).replace('.', ',')}` : <span className="text-empty">—</span>}
          </span>
          {(item.caixa || mostrarLojaLote) && (
            <span className="disco-local" style={corLoja ? { '--loja-cor': corLoja } : undefined}>
              {[item.caixa && formatCaixa(item.caixa, item.loja), mostrarLojaLote && item.loja].filter(Boolean).join(' · ')}
            </span>
          )}
        </div>
      </td>

      {/* Células mantidas no DOM para renderização Desktop */}
      <td data-label="Local" className="desktop-only cell-desktop-col">{formatCaixa(item.caixa, item.loja)}</td>
      {!isVideo && (
        <td data-label="Artista" className={`desktop-only cell-desktop-col ${!item.artista ? 'empty-artist' : ''}`}>
          {item.artista || <span className="text-empty">—</span>}
        </td>
      )}
      <td data-label="Título" className="desktop-only cell-desktop-col">{item.titulo || <span className="text-empty">—</span>}</td>
      {!activeStore && (
        <td data-label="Loja" className="desktop-only cell-desktop-col">
          {item.loja ? (
            <span className={`cell-desktop-loja ${item.loja === 'Loja 1' ? 'loja-badge-1' : item.loja === 'Loja 2' ? 'loja-badge-2' : 'loja-badge-anexo'}`} style={{ whiteSpace: 'nowrap' }}>
              {item.loja}
            </span>
          ) : (
            <span className="text-empty">—</span>
          )}
        </td>
      )}
      <td data-label="Preço" className="desktop-only cell-desktop-col cell-desktop-preco" style={{ whiteSpace: 'nowrap' }}>
        {item.preco ? `R$ ${Number(item.preco).toFixed(2).replace('.', ',')}` : <span className="text-empty">—</span>}
      </td>
      <td data-label="Status" className="desktop-only cell-desktop-col">
        <span className={`badge ${item.ativo !== false ? 'badge-entrada' : 'badge-saida'}`}>
          {item.ativo !== false ? 'Ativo' : 'Inativo'}
        </span>
      </td>
    </tr>
  );
}

export default function AcoesEmLote() {
  const { activeStore } = useStore();
  const { registerUndo } = useUndo();

  // Estados principais de navegação e filtros
  const [activeTab, setActiveTab] = useState(() => loteStorage.get('activeTab', CATEGORY_IDS.DISCOS));
  const [caixaSelecionada, setCaixaSelecionada] = useState(() => loteStorage.get('caixaSelecionada', ''));
  const [filtroLoja, setFiltroLoja] = useState(activeStore || '');
  const [busca, setBusca] = useState(() => loteStorage.get('busca', ''));
  const [buscaDebounced, setBuscaDebounced] = useState(() => loteStorage.get('busca', ''));

  // Carregamento de caixas disponíveis para filtro
  const { caixas: listaCaixasFiltro } = useCaixas(filtroLoja || activeStore);

  // Estados de listagem e seleção
  const [itens, setItens] = useState([]);
  const [selecionados, setSelecionados] = useState(() => loteStorage.get('selecionados', []));
  const [selecionadosData, setSelecionadosData] = useState(() => loteStorage.get('selecionadosData', []));
  const [loading, setLoading] = useState(false);
  const [mensagem, setMensagem] = useState(null);

  // Estados de alteração em lote
  const [novaLocalizacao, setNovaLocalizacao] = useState(() => loteStorage.get('novaLocalizacao', ''));
  const [lojaDestino, setLojaDestino] = useState(() => loteStorage.get('lojaDestino', ''));
  const [modoCustomCaixa, setModoCustomCaixa] = useState(false);
  const { caixas: caixasDestino } = useCaixas(lojaDestino || filtroLoja || activeStore);

  // Estados de confirmação e modais
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const [confirmarExclusaoNaoSelecionados, setConfirmarExclusaoNaoSelecionados] = useState(false);
  const [successModalMessage, setSuccessModalMessage] = useState('');

  const isVideo = activeTab === CATEGORY_IDS.DVDS || activeTab === CATEGORY_IDS.VHS;

  // Sincronização com loja global ativa
  useEffect(() => {
    setFiltroLoja(activeStore || '');
  }, [activeStore]);

  // Debounce para busca de texto
  useEffect(() => {
    const timer = setTimeout(() => {
      setBuscaDebounced(busca);
    }, 500);
    return () => clearTimeout(timer);
  }, [busca]);

  // Auto-dismiss para mensagens temporárias de feedback
  useEffect(() => {
    if (!mensagem) return;
    const timer = setTimeout(() => {
      setMensagem(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [mensagem]);

  // Persistência automática do rascunho no sessionStorage
  useEffect(() => {
    loteStorage.set('activeTab', activeTab);
    loteStorage.set('caixaSelecionada', caixaSelecionada);
    loteStorage.set('busca', busca);
    loteStorage.set('selecionados', selecionados);
    loteStorage.set('selecionadosData', selecionadosData);
    loteStorage.set('novaLocalizacao', novaLocalizacao);
    loteStorage.set('lojaDestino', lojaDestino);
  }, [activeTab, caixaSelecionada, busca, selecionados, selecionadosData, novaLocalizacao, lojaDestino]);

  /**
   * Constrói a consulta de itens no banco com base nos filtros
   */
  const carregarItens = useCallback(async () => {
    setLoading(true);
    setMensagem(null);

    try {
      let query = supabase
        .from(activeTab)
        .select('*')
        .eq('deletado', false)
        .order('titulo', { ascending: true });

      if (caixaSelecionada) {
        const matchSufixoB = caixaSelecionada.match(/^(?:caixa|c)?\s*(\d+)\s*b$/i);
        const matchNumeroPuro = caixaSelecionada.match(/^(?:caixa|c)?\s*(\d+)$/i);

        if (matchSufixoB) {
          const numero = matchSufixoB[1];
          query = query.in('caixa', [`Caixa ${numero}B`, `Caixa ${numero}b`, `${numero}B`, `${numero}b`]);
        } else if (matchNumeroPuro) {
          const numero = matchNumeroPuro[1];
          query = query.in('caixa', [numero, `Caixa ${numero}`, `Caixa ${numero}B`]);
        } else {
          query = query.eq('caixa', caixaSelecionada);
        }
      }

      if (filtroLoja) {
        query = query.eq('loja', filtroLoja);
      }

      if (buscaDebounced) {
        const termosBusca = removeAcentos(buscaDebounced).trim().split(/\s+/);
        termosBusca.forEach((termo) => {
          const termoComCuringa = termo.replace(/[aeiou]/g, '_');
          if (isVideo) {
            query = query.ilike('titulo', `%${termoComCuringa}%`);
          } else {
            query = query.or(`titulo.ilike.%${termoComCuringa}%,artista.ilike.%${termoComCuringa}%,caixa.ilike.%${termoComCuringa}%`);
          }
        });
      }

      query = query.limit(10000);

      const { data: dadosItens, error } = await query;
      if (error) throw error;

      let itensProcessados = dadosItens || [];

      // Filtro em memória para busca precisa sem acentos
      if (buscaDebounced) {
        const termosBusca = removeAcentos(buscaDebounced).trim().split(/\s+/);
        itensProcessados = itensProcessados.filter((item) => {
          const tituloNormalizado = removeAcentos(item.titulo || '');
          const artistaNormalizado = removeAcentos(item.artista || '');
          const caixaNormalizada = removeAcentos(item.caixa || '');
          const caixaSemEspaco = caixaNormalizada.replace(/\s+/g, '');

          return termosBusca.every((termo) => {
            const termoSemEspaco = termo.replace(/\s+/g, '');
            if (isVideo) {
              return tituloNormalizado.includes(termo);
            }
            return (
              tituloNormalizado.includes(termo) ||
              artistaNormalizado.includes(termo) ||
              caixaNormalizada.includes(termo) ||
              (termoSemEspaco && caixaSemEspaco.includes(termoSemEspaco))
            );
          });
        });
      }

      setItens(itensProcessados);
    } catch (erroCarregamento) {
      console.error(erroCarregamento);
      setMensagem({ tipo: 'error', texto: 'Erro ao carregar itens: ' + erroCarregamento.message });
      setItens([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab, caixaSelecionada, filtroLoja, buscaDebounced, isVideo]);

  useEffect(() => {
    carregarItens();
  }, [carregarItens]);

  /**
   * Limpa seleções e rascunhos ao mudar de categoria
   */
  const handleTabChange = (novaCategoria) => {
    setActiveTab(novaCategoria);
    setMensagem(null);
    setBusca('');
    setCaixaSelecionada('');
    limparSelecao();
  };

  /**
   * Alterna a seleção de todos os itens atualmente visíveis
   */
  const toggleSelecionarTodos = () => {
    const idsVisiveis = itens.map((item) => item.id);
    const todosVisiveisSelecionados = idsVisiveis.every((id) => selecionados.includes(id));

    if (todosVisiveisSelecionados && idsVisiveis.length > 0) {
      setSelecionados(selecionados.filter((id) => !idsVisiveis.includes(id)));
      setSelecionadosData(selecionadosData.filter((item) => !idsVisiveis.includes(item.id)));
    } else {
      const novosIds = idsVisiveis.filter((id) => !selecionados.includes(id));
      setSelecionados([...selecionados, ...novosIds]);
      const novosItensData = itens.filter((item) => novosIds.includes(item.id));
      setSelecionadosData([...selecionadosData, ...novosItensData]);
    }
  };

  /**
   * Alterna seleção de um item individual
   */
  const toggleSelecionar = (id) => {
    if (selecionados.includes(id)) {
      setSelecionados(selecionados.filter((selectedId) => selectedId !== id));
      setSelecionadosData(selecionadosData.filter((item) => item.id !== id));
    } else {
      setSelecionados([...selecionados, id]);
      const itemEncontrado = itens.find((item) => item.id === id) || selecionadosData.find((item) => item.id === id);
      if (itemEncontrado) {
        setSelecionadosData([...selecionadosData, itemEncontrado]);
      }
    }
  };

  /**
   * Limpa todas as seleções ativas e remove dados do storage
   */
  const limparSelecao = () => {
    setSelecionados([]);
    setSelecionadosData([]);
    loteStorage.clearSelection();
  };

  /**
   * Executor padronizado de ações em lote com suporte a Undo e reload
   */
  const handleBulkAction = async (executarAcao, gerarMensagemSucesso, itensAfetados, undoMovements = []) => {
    setLoading(true);
    try {
      await executarAcao();
      if (itensAfetados && itensAfetados.length > 0) {
        registerUndo(activeTab, itensAfetados, () => {
          carregarItens();
        }, undoMovements);
      }
      const mensagemSucesso = gerarMensagemSucesso(itensAfetados ? itensAfetados.length : selecionados.length);
      setMensagem({ tipo: 'success', texto: mensagemSucesso });

      if (mensagemSucesso.includes('excluídos') || mensagemSucesso.includes('inativados')) {
        setSuccessModalMessage(mensagemSucesso);
      }

      limparSelecao();
      setNovaLocalizacao('');
      setLojaDestino('');
      loteStorage.clearFormDraft();
      await carregarItens();
    } catch (erroExecucao) {
      setMensagem({ tipo: 'error', texto: erroExecucao.message });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Aplica nova localização e/ou loja aos itens selecionados
   */
  const aplicarMudancas = () => {
    if (!novaLocalizacao && !lojaDestino) {
      return setMensagem({ tipo: 'error', texto: 'Selecione uma loja ou digite uma localização para aplicar.' });
    }

    const payloadAtualizacao = {};
    if (novaLocalizacao) {
      payloadAtualizacao.caixa = normalizeCaixa(novaLocalizacao.trim(), lojaDestino || filtroLoja || activeStore);
    }
    if (lojaDestino) {
      payloadAtualizacao.loja = lojaDestino;
    }

    handleBulkAction(
      () => itemService.bulkUpdate(activeTab, selecionados, payloadAtualizacao),
      (quantidade) => `${quantidade} item(ns) atualizado(s) com sucesso.`,
      selecionadosData
    ).then(() => {
      setNovaLocalizacao('');
      setLojaDestino('');
    });
  };

  /**
   * Altera status dos itens selecionados para inativo
   */
  const inativarSelecionados = () => {
    handleBulkAction(
      () => itemService.bulkUpdate(activeTab, selecionados, { ativo: false }),
      (quantidade) => `${quantidade} item(ns) inativados.`,
      selecionadosData
    );
  };

  /**
   * Exclui itens marcados pelo usuário
   */
  const excluirSelecionados = async () => {
    handleBulkAction(
      () => itemService.bulkDeleteWithMovement(activeTab, selecionadosData, 'Saída (Exclusão em lote)'),
      (quantidade) => `${quantidade} item(ns) excluído(s).`,
      selecionadosData,
      selecionadosData
        .filter((item) => item.ativo !== false)
        .map((item) => ({
          itemId: item.id,
          payload: movimentacaoService.createMovementPayload(
            activeTab,
            item.id,
            'entrada',
            item.quantidade || 1,
            'Estorno de saída (desfazer exclusão em lote)',
          ),
        })),
    ).then(() => setConfirmarExclusao(false));
  };

  /**
   * Exclui itens não selecionados pertencentes à caixa filtrada
   */
  const excluirNaoSelecionados = async () => {
    const itensNaoSelecionados = itens.filter((item) => !selecionados.includes(item.id));
    if (itensNaoSelecionados.length === 0) return;

    handleBulkAction(
      () => itemService.bulkDeleteWithMovement(activeTab, itensNaoSelecionados, 'Saída (Exclusão não selecionados)'),
      (quantidade) => `${quantidade} item(ns) não selecionados excluídos.`,
      itensNaoSelecionados,
      itensNaoSelecionados
        .filter((item) => item.ativo !== false)
        .map((item) => ({
          itemId: item.id,
          payload: movimentacaoService.createMovementPayload(
            activeTab,
            item.id,
            'entrada',
            item.quantidade || 1,
            'Estorno de saída (desfazer exclusão em lote)',
          ),
        })),
    ).then(() => setConfirmarExclusaoNaoSelecionados(false));
  };

  // Bloco de chips de itens selecionados
  const blocoChipsSelecionados = useMemo(() => {
    if (selecionadosData.length === 0) return null;

    return (
      <div className="lote-chips-block">
        <div className="lote-chips-header">
          <span className="lote-chips-count">{selecionadosData.length} selecionado(s)</span>
          <button onClick={limparSelecao} className="lote-chips-clear">Limpar tudo</button>
        </div>
        <div className="lote-chips-list">
          {selecionadosData.map((item) => (
            <span key={item.id} className="lote-chip-item">
              <span className="lote-chip-text">
                {!isVideo && item.artista ? `${item.artista} — ` : ''}
                {item.titulo}
              </span>
              <button
                onClick={() => toggleSelecionar(item.id)}
                className="lote-chip-remove"
                title="Remover da seleção"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </div>
    );
  }, [selecionadosData, isVideo]);

  const todosVisiveisSelecionados = itens.length > 0 && itens.every((item) => selecionados.includes(item.id));

  return (
    <div className="pageContainer">
      <div className="topHeader">
        <div className="titleGroup">
          <MdLayers size={28} color="var(--accent)" />
          <h1 className="page-title">Alteração em Lote</h1>
        </div>
      </div>

      <div className="mainCard">
        <CategoryTabs activeTab={activeTab} onTabChange={handleTabChange} />

        <div className="filterCard lote-filters-card">
          <div className={`filtersRow${activeStore ? ' filtersRow-store-selected' : ''}`}>
            <div className="filterGroup">
              <label>Buscar por {isVideo ? 'título' : 'artista ou título'}</label>
              <div className="search-bar-row">
                <div className="searchInputWrapper">
                  <FiSearch size={18} className="searchIconLeft" />
                  <input
                    type="text"
                    className="searchInputWithLeftIcon"
                    placeholder="Ex: Beatles..."
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                  />
                  {busca && (
                    <button
                      type="button"
                      onClick={() => setBusca('')}
                      className="search-clear-btn"
                      title="Limpar busca"
                      aria-label="Limpar busca"
                    >
                      <IoClose size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="filterGroup">
              <label>Filtrar por Localização</label>
              <select value={caixaSelecionada} onChange={(e) => setCaixaSelecionada(e.target.value)}>
                <option value="">Todas</option>
                {listaCaixasFiltro.map((caixaOption) => (
                  <option
                    key={`${caixaOption.caixa}-${caixaOption.loja}`}
                    value={caixaOption.caixa}
                    style={caixaOption.loja ? { color: getStoreColor(caixaOption.loja), fontWeight: '500' } : {}}
                  >
                    {caixaOption.label} {!activeStore && caixaOption.loja ? `(${caixaOption.loja})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {!activeStore && (
              <div className="filterGroup">
                <label>Filtrar por loja</label>
                <select value={filtroLoja} onChange={(e) => setFiltroLoja(e.target.value)}>
                  <option value="">Todas</option>
                  {STORE_OPTIONS.map((storeOption) => (
                    <option
                      key={storeOption.value}
                      value={storeOption.value}
                      style={{ color: storeOption.color, fontWeight: '500' }}
                    >
                      {storeOption.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        <AlertMessage message={mensagem} onClose={() => setMensagem(null)} />

        <SuccessModal
          isOpen={!!successModalMessage}
          message={successModalMessage}
          onClose={() => setSuccessModalMessage('')}
        />

        <div className="hide-on-mobile">{blocoChipsSelecionados}</div>

        {loading && !itens.length && <p>Carregando...</p>}
        {!loading && itens.length === 0 && selecionadosData.length === 0 && (
          <div className="empty-state">Nenhum item encontrado.</div>
        )}

        {itens.length > 0 && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
                {busca || caixaSelecionada ? `${itens.filter((item) => !selecionados.includes(item.id)).length} resultado(s)` : null}
              </p>
              <button className="btn lote-select-all-btn" onClick={toggleSelecionarTodos}>
                {todosVisiveisSelecionados ? 'Desmarcar Todos' : 'Selecionar Todos'}
              </button>
            </div>

            <div className="table-responsive" style={{ marginBottom: '16px' }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '40px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={todosVisiveisSelecionados}
                        onChange={toggleSelecionarTodos}
                        style={{ cursor: 'pointer', width: '18px', height: '18px', accentColor: 'var(--accent)' }}
                      />
                    </th>
                    <th>Localização</th>
                    {!isVideo && <th>Artista</th>}
                    <th>Título</th>
                    {!activeStore && <th>Loja</th>}
                    <th>Preço</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {itens.map((item) => (
                    <LoteCardRow
                      key={item.id}
                      item={item}
                      isItemSelecionado={selecionados.includes(item.id)}
                      toggleSelecionar={toggleSelecionar}
                      isVideo={isVideo}
                      activeStore={activeStore}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            <div className="hide-on-desktop">{blocoChipsSelecionados}</div>
            <div style={{ height: '120px' }}></div>
          </>
        )}

        {selecionados.length > 0 && (
          <div className="bulk-actions-panel">
            <div className="bulk-actions-content">
              <div className="bulk-actions-info">
                <button onClick={limparSelecao} className="bulk-close-btn" title="Cancelar seleção">✕</button>
                <div className="bulk-info-text">
                  <span className="bulk-count">{selecionados.length} selecionados</span>
                  <span className="bulk-sub">Ações em lote</span>
                </div>
                <div className="hide-on-desktop bulk-mobile-actions">
                  <button className="btn lote-action-btn-secondary" onClick={inativarSelecionados} disabled={loading}>
                    Inativar
                  </button>
                  {confirmarExclusao ? (
                    <div className="lote-confirm-del-group">
                      <button className="btn lote-action-btn-danger-confirm" onClick={excluirSelecionados} disabled={loading}>
                        OK
                      </button>
                      <button className="btn lote-action-btn-secondary" onClick={() => setConfirmarExclusao(false)}>
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button className="btn lote-action-btn-danger" onClick={() => setConfirmarExclusao(true)} disabled={loading}>
                      Excluir
                    </button>
                  )}
                </div>
              </div>

              <div className="bulk-actions-tools">
                <div className="bulk-move-group">
                  <select
                    className="bulk-input bulk-select-store"
                    value={lojaDestino}
                    onChange={(e) => setLojaDestino(e.target.value)}
                  >
                    <option value="" style={{ color: '#888' }}>Loja...</option>
                    {STORE_OPTIONS.map((storeOption) => (
                      <option
                        key={storeOption.value}
                        value={storeOption.value}
                        style={{ color: storeOption.color, fontWeight: '500' }}
                      >
                        {storeOption.label}
                      </option>
                    ))}
                  </select>

                  {!modoCustomCaixa ? (
                    <select
                      className="bulk-input bulk-select-caixa"
                      value={novaLocalizacao}
                      onChange={(e) => {
                        if (e.target.value === '__custom__') {
                          setModoCustomCaixa(true);
                          setNovaLocalizacao('');
                        } else {
                          setNovaLocalizacao(e.target.value);
                        }
                      }}
                    >
                      <option value="" style={{ color: '#888' }}>Caixa...</option>
                      {caixasDestino.map((caixaDestino) => (
                        <option
                          key={`${caixaDestino.caixa}-${caixaDestino.loja}`}
                          value={caixaDestino.caixa}
                          style={{ color: '#fff' }}
                        >
                          {caixaDestino.label}
                        </option>
                      ))}
                      <option value="__custom__" style={{ color: 'var(--accent)', fontWeight: 500 }}>
                        + Digitar...
                      </option>
                    </select>
                  ) : (
                    <div className="bulk-custom-caixa-input">
                      <input
                        type="text"
                        placeholder="Ex: 5b, 19b..."
                        value={novaLocalizacao}
                        onChange={(e) => setNovaLocalizacao(e.target.value)}
                        onBlur={(e) => {
                          const valorNormalizado = normalizeCaixa(e.target.value, lojaDestino || filtroLoja || activeStore);
                          if (valorNormalizado !== e.target.value) {
                            setNovaLocalizacao(valorNormalizado);
                          }
                        }}
                        className="bulk-input"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setModoCustomCaixa(false)}
                        className="bulk-custom-caixa-btn"
                        title="Voltar para seleção por lista"
                      >
                        Lista
                      </button>
                    </div>
                  )}

                  <button className="btn btn-primary bulk-apply-btn" onClick={aplicarMudancas} disabled={loading}>
                    Aplicar
                  </button>
                </div>

                <div className="hide-on-mobile bulk-desktop-divider"></div>
                <button
                  type="button"
                  className="btn btn-secondary hide-on-mobile lote-action-btn-secondary"
                  onClick={inativarSelecionados}
                  disabled={loading}
                >
                  Inativar
                </button>
                <button
                  type="button"
                  className="btn btn-danger hide-on-mobile lote-action-btn-danger"
                  onClick={() => setConfirmarExclusao(true)}
                  disabled={loading}
                >
                  Excluir
                </button>

                {caixaSelecionada && (
                  <>
                    <div className="bulk-desktop-divider"></div>
                    <button
                      type="button"
                      className="btn btn-danger lote-action-btn-danger-all"
                      onClick={() => setConfirmarExclusaoNaoSelecionados(true)}
                      disabled={loading}
                    >
                      Apagar não marcados
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        <ConfirmModal
          isOpen={confirmarExclusao}
          title="Confirmar Exclusão em Lote"
          message={
            <span>
              Tem certeza que deseja excluir <strong>{selecionados.length}</strong> item(ns) selecionado(s)?
              <br />
              Itens ativos terão saída registrada no histórico. Itens inativos serão removidos sem registrar saída.
            </span>
          }
          confirmText="Sim, excluir selecionados"
          cancelText="Cancelar"
          variant="danger"
          isSubmitting={loading}
          onConfirm={excluirSelecionados}
          onClose={() => setConfirmarExclusao(false)}
        />

        <ConfirmModal
          isOpen={confirmarExclusaoNaoSelecionados}
          title="Confirmar Exclusão dos Não Marcados"
          message={
            <span>
              Tem certeza que deseja excluir todos os itens <strong>não marcados</strong> desta caixa?
              <br />
              Esta ação removerá os itens não selecionados do catálogo.
            </span>
          }
          confirmText="Sim, apagar não marcados"
          cancelText="Cancelar"
          variant="danger"
          isSubmitting={loading}
          onConfirm={excluirNaoSelecionados}
          onClose={() => setConfirmarExclusaoNaoSelecionados(false)}
        />
      </div>
    </div>
  );
}
