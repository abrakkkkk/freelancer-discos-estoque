'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { PiVinylRecord, PiDisc, PiFilmStrip, PiCassetteTape } from 'react-icons/pi';
import { MdDownload } from 'react-icons/md';

import { useCatalog } from '@/hooks/useCatalog';
import { useCaixas } from '@/hooks/useCaixas';
import { itemService } from '@/services/itemService';
import { movimentacaoService } from '@/services/movimentacaoService';
import { PAGINATION, CATEGORY_IDS } from '@/constants/config';
import { useUndo } from '@/contexts/UndoContext';
import { useStore } from '@/contexts/StoreContext';
import { useReposicao } from '@/contexts/ReposicaoContext';

import CategoryTabs from '@/components/CategoryTabs';
import CatalogTable from '@/components/CatalogTable';
import CatalogFilters from '@/components/CatalogFilters';
import CatalogPagination from '@/components/CatalogPagination';
import CatalogBulkDock from '@/components/CatalogBulkDock';
import ConfirmModal from '@/components/ConfirmModal';
import ReposicaoModal from '@/components/ReposicaoModal';
import ReposicaoBell from '@/components/ReposicaoBell';
import AlertMessage from '@/components/AlertMessage';

const CoverScannerModal = dynamic(() => import('@/components/CoverScannerModal'), { ssr: false });

export default function CatalogoClone() {
  const { activeStore } = useStore();
  const { registerUndo } = useUndo();
  const { adicionarTarefa, removerTarefa } = useReposicao();

  const catalog = useCatalog(CATEGORY_IDS.DISCOS);
  const { caixas } = useCaixas(catalog.filtroLoja || activeStore);

  // Estados locais da página
  const [exportando, setExportando] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState(null);
  const [isCoverScannerOpen, setIsCoverScannerOpen] = useState(false);

  // Estados de exclusão e reposição individual
  const [itemParaExcluir, setItemParaExcluir] = useState(null);
  const [isExcluindo, setIsExcluindo] = useState(false);
  const [reposicaoData, setReposicaoData] = useState(null);
  const [isRepondo, setIsRepondo] = useState(false);

  // Estados de seleção múltipla e baixa em lote
  const [itensSelecionados, setItensSelecionados] = useState([]);
  const [isBaixandoLote, setIsBaixandoLote] = useState(false);
  const [showConfirmBaixaLote, setShowConfirmBaixaLote] = useState(false);

  // Auto-dismiss para alertas de feedback (5 segundos)
  useEffect(() => {
    if (!feedbackMsg) return;
    const timer = setTimeout(() => {
      setFeedbackMsg(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [feedbackMsg]);

  // Limpa avisos e seleção ao alternar categorias
  useEffect(() => {
    setFeedbackMsg(null);
    setItensSelecionados([]);
  }, [catalog.activeTab]);

  // Sincroniza filtro de loja global com o catálogo
  useEffect(() => {
    catalog.setFiltroLoja(activeStore);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStore]);

  // Reconhecimento de capa pelo scanner
  const handleCoverRecognized = ({ artista, titulo, confianca }) => {
    if (!artista && !titulo) return;
    const baixaConfianca = String(confianca || '').toLowerCase() === 'baixa';

    let queryBusca = '';
    const isVarious = !artista || /^(various|v[aá]rios(\s+artistas)?|trilha\s+sonora)$/i.test(artista);

    if (isVarious) {
      queryBusca = (titulo || artista || '').trim();
    } else {
      queryBusca = `${artista} ${titulo || ''}`.trim();
    }

    catalog.setBusca(queryBusca);
    catalog.setPagina(1);
    setFeedbackMsg({
      tipo: baixaConfianca ? 'error' : 'success',
      texto: baixaConfianca
        ? 'A identificação da capa ficou incerta. Revise os resultados do estoque antes de usar os dados.'
        : `Capa identificada: "${[artista, titulo].filter(Boolean).join(' - ')}". Exibindo resultados do estoque.`,
    });
  };

  // Exportação de planilha Excel
  const exportarEstoque = async () => {
    setExportando(true);
    setFeedbackMsg(null);
    try {
      const { exportarEstoqueCompleto } = await import('@/utils/export');
      await exportarEstoqueCompleto(activeStore);
    } catch (err) {
      console.error(err);
      setFeedbackMsg({
        tipo: 'error',
        texto: 'Erro ao exportar planilha: ' + (err.message || 'Tente novamente.'),
      });
    } finally {
      setExportando(false);
    }
  };

  // Gerenciamento de seleção múltipla
  const toggleSelecionar = useCallback((item) => {
    setItensSelecionados((prev) => {
      const jaExiste = prev.some((selecionado) => selecionado.id === item.id);
      if (jaExiste) {
        return prev.filter((selecionado) => selecionado.id !== item.id);
      }
      return [...prev, item];
    });
  }, []);

  const toggleSelectAllPage = useCallback((itensPagina) => {
    if (!itensPagina || itensPagina.length === 0) return;

    const todosDaPaginaSelecionados = itensPagina.every((item) =>
      itensSelecionados.some((selecionado) => selecionado.id === item.id)
    );

    if (todosDaPaginaSelecionados) {
      const idsDaPagina = new Set(itensPagina.map((item) => item.id));
      setItensSelecionados((prev) => prev.filter((item) => !idsDaPagina.has(item.id)));
    } else {
      setItensSelecionados((prev) => {
        const idsExistentes = new Set(prev.map((item) => item.id));
        const novosItens = itensPagina.filter((item) => !idsExistentes.has(item.id));
        return [...prev, ...novosItens];
      });
    }
  }, [itensSelecionados]);

  const limparSelecao = useCallback(() => {
    setItensSelecionados([]);
  }, []);

  // Exclusão individual com reposição automática
  const solicitarExclusao = (id, titulo) => {
    setFeedbackMsg(null);
    setItemParaExcluir({ id, titulo });
  };

  const confirmarExclusao = async () => {
    if (!itemParaExcluir || isExcluindo) return;
    setIsExcluindo(true);
    setFeedbackMsg(null);

    const { id, titulo } = itemParaExcluir;

    try {
      const itemToDelete = catalog.itens.find((item) => item.id === id);
      const isAtivo = itemToDelete?.ativo !== false;

      await itemService.deleteItemWithMovement(
        catalog.activeTab,
        itemToDelete,
        'Saída (Excluído via Catálogo)'
      );

      catalog.setItens(catalog.itens.filter((item) => item.id !== id));
      catalog.setTotal(catalog.total - 1);

      if (itemToDelete) {
        const undoMovements = isAtivo
          ? [{
              itemId: id,
              payload: movimentacaoService.createMovementPayload(
                catalog.activeTab,
                id,
                'entrada',
                itemToDelete.quantidade || 1,
                'Estorno de saída (desfazer exclusão)',
              ),
            }]
          : [];
        registerUndo(catalog.activeTab, [itemToDelete], () => {
          catalog.refresh();
        }, undoMovements);
      }
      setItemParaExcluir(null);

      // Checa reposição para itens ativos
      if (isAtivo) {
        try {
          const replacements = await itemService.findReplacements(catalog.activeTab, {
            titulo: itemToDelete?.titulo,
            artista: itemToDelete?.artista,
            excludeId: id,
          });

          if (replacements && replacements.length > 0) {
            const reserva = replacements[0];
            adicionarTarefa({
              itemSaida: itemToDelete,
              reserva,
              totalReservas: replacements.length,
              categoria: catalog.activeTab,
            });

            setReposicaoData({
              itemSaida: itemToDelete,
              reserva,
              totalReservas: replacements.length,
            });
          }
        } catch (erroReposicao) {
          console.warn('Erro ao verificar reposição:', erroReposicao);
        }
      }

      setFeedbackMsg({
        tipo: 'success',
        texto: isAtivo
          ? `Saída de "${titulo}" registrada.`
          : `"${titulo}" (Inativo) excluído com sucesso.`,
      });
    } catch (error) {
      console.error('Erro ao excluir:', error);
      setFeedbackMsg({
        tipo: 'error',
        texto: `Erro ao excluir "${titulo}": ${error.message || 'Falha na operação.'}`,
      });
    } finally {
      setIsExcluindo(false);
    }
  };

  // Baixa em lote dos selecionados
  const confirmarBaixaLote = async () => {
    if (itensSelecionados.length === 0 || isBaixandoLote) return;
    setIsBaixandoLote(true);
    setFeedbackMsg(null);

    const totalItens = itensSelecionados.length;
    const category = catalog.activeTab;

    try {
      await itemService.bulkDeleteWithMovement(
        category,
        itensSelecionados,
        'Saída (Baixa via Catálogo)'
      );

      const undoMovements = itensSelecionados
        .filter((item) => item.ativo !== false)
        .map((item) => ({
          itemId: item.id,
          payload: movimentacaoService.createMovementPayload(
            category,
            item.id,
            'entrada',
            item.quantidade || 1,
            'Estorno de saída (desfazer baixa em lote)',
          ),
        }));
      registerUndo(category, itensSelecionados, () => {
        catalog.refresh();
      }, undoMovements);

      // Checa reposições automáticas dos ativos
      const itensAtivos = itensSelecionados.filter((item) => item.ativo !== false);
      for (const item of itensAtivos) {
        try {
          const replacements = await itemService.findReplacements(category, {
            titulo: item.titulo,
            artista: item.artista,
            excludeId: item.id,
          });
          if (replacements && replacements.length > 0) {
            adicionarTarefa({
              itemSaida: item,
              reserva: replacements[0],
              totalReservas: replacements.length,
              categoria: category,
            });
          }
        } catch (repErr) {
          console.warn('Erro ao checar reposição para item:', item.id, repErr);
        }
      }

      setFeedbackMsg({
        tipo: 'success',
        texto: `Baixa registrada com sucesso para ${totalItens} ${totalItens === 1 ? 'disco' : 'discos'}!`,
      });

      setItensSelecionados([]);
      setShowConfirmBaixaLote(false);
      catalog.refresh();
    } catch (error) {
      console.error('Erro na baixa em lote:', error);
      setFeedbackMsg({
        tipo: 'error',
        texto: `Erro ao dar baixa nos discos: ${error.message || 'Falha na operação.'}`,
      });
    } finally {
      setIsBaixandoLote(false);
    }
  };

  // Efetiva reposição de cópia reserva
  const handleConfirmarRepor = async () => {
    if (!reposicaoData || isRepondo) return;
    setIsRepondo(true);
    try {
      const { itemSaida, reserva } = reposicaoData;
      const destinoLocal = itemSaida.caixa ? `Caixa ${itemSaida.caixa}` : 'estoque ativo';
      const payloadMovimentacao = movimentacaoService.createMovementPayload(
        catalog.activeTab,
        reserva.id,
        'entrada',
        1,
        `Ativação de cópia reserva para ${destinoLocal}`
      );
      await itemService.promoteReplacement(
        catalog.activeTab,
        reserva.id,
        itemSaida.caixa,
        itemSaida.loja,
        payloadMovimentacao,
      );

      setFeedbackMsg({
        tipo: 'success',
        texto: `"${reserva.titulo}" reposto com sucesso na ${itemSaida.caixa ? `Caixa ${itemSaida.caixa}` : 'sua localização'}!`,
      });
      removerTarefa(`${catalog.activeTab}_${reserva.id}`);
      setReposicaoData(null);
      catalog.refresh();
    } catch (err) {
      console.error(err);
      setFeedbackMsg({ tipo: 'error', texto: `Erro ao repor item: ${err.message}` });
    } finally {
      setIsRepondo(false);
    }
  };

  // Metadados computados
  const totalPaginas = Math.max(1, Math.ceil(catalog.total / PAGINATION.ITEMS_PER_PAGE));
  const itemName =
    catalog.activeTab === 'discos'
      ? 'discos'
      : catalog.activeTab === 'dvds'
      ? 'DVDs'
      : catalog.activeTab === 'vhs'
      ? 'VHS'
      : 'CDs';
  const isVideo = catalog.activeTab === 'dvds' || catalog.activeTab === 'vhs';
  const isDiscos = (activeStore === 'Loja 1' || activeStore === 'Loja 2') && catalog.activeTab === CATEGORY_IDS.DISCOS;
  const localLabel = isDiscos ? 'Caixa' : 'Localização';

  const valorTotalSelecionados = useMemo(() => {
    return itensSelecionados.reduce((acc, item) => acc + (Number(item.preco) || 0), 0);
  }, [itensSelecionados]);

  const idsSelecionados = useMemo(() => {
    return itensSelecionados.map((item) => item.id);
  }, [itensSelecionados]);

  const renderIconeCabecalho = () => {
    switch (catalog.activeTab) {
      case CATEGORY_IDS.DISCOS:
        return <PiVinylRecord size={34} color="var(--accent)" />;
      case CATEGORY_IDS.DVDS:
        return <PiFilmStrip size={34} color="var(--accent)" />;
      case CATEGORY_IDS.VHS:
        return <PiCassetteTape size={34} color="var(--accent)" />;
      default:
        return <PiDisc size={34} color="var(--accent)" />;
    }
  };

  return (
    <div className="pageContainer">
      <style dangerouslySetInnerHTML={{ __html: `.desktop-theme-toggle { display: none !important; }` }} />

      <div className="topHeader">
        <div className="titleGroup">
          {renderIconeCabecalho()}
          <h1>Catálogo Completo</h1>
        </div>

        <div className="headerActions hide-on-mobile">
          <div className="desktop-reposicao-control">
            <span>Reposições</span>
            <ReposicaoBell compact />
          </div>
          <button
            onClick={exportarEstoque}
            disabled={exportando}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              borderRadius: '8px',
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              cursor: exportando ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 500,
              opacity: exportando ? 0.7 : 1,
              transition: '0.2s',
            }}
          >
            <MdDownload size={18} />
            {exportando ? 'Exportando...' : 'Exportar (.xlsx)'}
          </button>
        </div>
      </div>

      <div className="mainCard">
        <div className="tabsRow">
          <CategoryTabs
            activeTab={catalog.activeTab}
            onTabChange={catalog.changeTab}
            additionalProps={{ style: { margin: 0, padding: 0, borderBottom: 'none' } }}
          />
        </div>

        <CatalogFilters
          busca={catalog.busca}
          onBuscaChange={catalog.setBusca}
          onClearBusca={() => catalog.setBusca('')}
          onOpenScanner={() => setIsCoverScannerOpen(true)}
          filtroCaixa={catalog.filtroCaixa}
          onFiltroCaixaChange={catalog.setFiltroCaixa}
          caixas={caixas}
          filtroLoja={catalog.filtroLoja}
          onFiltroLojaChange={catalog.setFiltroLoja}
          activeStore={activeStore}
          mostrarAtivos={catalog.mostrarAtivos}
          onMostrarAtivosChange={catalog.setMostrarAtivos}
          mostrarInativos={catalog.mostrarInativos}
          onMostrarInativosChange={catalog.setMostrarInativos}
          isVideo={isVideo}
          localLabel={localLabel}
        />

        <AlertMessage message={feedbackMsg} onClose={() => setFeedbackMsg(null)} />

        {catalog.error ? (
          <div className="alert alert-error" role="alert" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            <span>{catalog.error}</span>
            <button type="button" className="btn btn-secondary" onClick={catalog.refresh}>
              Tentar novamente
            </button>
          </div>
        ) : catalog.loading ? (
          <p style={{ color: 'var(--text-muted)' }}>Carregando...</p>
        ) : (
          <>
            <div className="tableHeader">
              <span>
                Mostrando {(catalog.pagina - 1) * PAGINATION.ITEMS_PER_PAGE + 1}–
                {Math.min(catalog.pagina * PAGINATION.ITEMS_PER_PAGE, catalog.total)} de {catalog.total} {itemName}
              </span>
            </div>

            <CatalogTable
              itens={catalog.itens}
              activeTab={catalog.activeTab}
              ordenarColuna={catalog.ordenarColuna}
              ordenarDirecao={catalog.ordenarDirecao}
              onSort={catalog.toggleOrdenacao}
              onDelete={solicitarExclusao}
              showLoja={!activeStore}
              localLabel={localLabel}
              selectedIds={idsSelecionados}
              onToggleSelect={toggleSelecionar}
              onToggleSelectAll={toggleSelectAllPage}
            />

            <CatalogPagination
              pagina={catalog.pagina}
              totalPaginas={totalPaginas}
              onPageChange={catalog.setPagina}
            />
          </>
        )}
      </div>

      <CatalogBulkDock
        totalSelecionados={itensSelecionados.length}
        valorTotal={valorTotalSelecionados}
        isSubmitting={isBaixandoLote}
        onClear={limparSelecao}
        onConfirm={() => setShowConfirmBaixaLote(true)}
      />

      <ConfirmModal
        isOpen={!!itemParaExcluir}
        title="Registrar Saída"
        message={
          <div>
            Tem certeza que deseja registrar a saída de{' '}
            <strong style={{ color: 'var(--text, #fff)' }}>&quot;{itemParaExcluir?.titulo}&quot;</strong>?
            <span style={{ display: 'block', marginTop: '8px', fontSize: '13px', opacity: 0.85 }}>
              O item não aparecerá mais no catálogo, mas o histórico de saída será preservado.
            </span>
          </div>
        }
        confirmText="Registrar Saída"
        cancelText="Cancelar"
        variant="danger"
        isSubmitting={isExcluindo}
        onClose={() => setItemParaExcluir(null)}
        onConfirm={confirmarExclusao}
      />

      <ConfirmModal
        isOpen={showConfirmBaixaLote}
        title={`Dar Baixa em ${itensSelecionados.length} ${itensSelecionados.length === 1 ? 'Disco' : 'Discos'}`}
        message={
          <div>
            <p style={{ margin: '0 0 12px 0', fontSize: '14px', lineHeight: 1.5 }}>
              Tem certeza que deseja registrar a baixa e saída de{' '}
              <strong style={{ color: 'var(--text, #fff)' }}>
                {itensSelecionados.length} {itensSelecionados.length === 1 ? 'disco selecionado' : 'discos selecionados'}
              </strong>?
            </p>
            <div
              style={{
                maxHeight: '160px',
                overflowY: 'auto',
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '8px',
                padding: '8px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                marginBottom: '10px',
              }}
            >
              {itensSelecionados.map((item, idx) => (
                <div
                  key={item.id}
                  style={{
                    fontSize: '13px',
                    color: 'var(--text, #fff)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '8px',
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {idx + 1}. {item.artista ? `${item.artista} - ` : ''}
                    <strong>{item.titulo}</strong>
                  </span>
                  <span style={{ color: 'var(--text-muted, #a1a1aa)', flexShrink: 0 }}>
                    {item.caixa ? `Caixa ${item.caixa}` : ''}
                  </span>
                </div>
              ))}
            </div>
            <span style={{ display: 'block', fontSize: '12.5px', color: 'var(--text-muted, #a1a1aa)' }}>
              Os itens serão retirados do estoque ativo e a saída será registrada. Você poderá desfazer a ação imediatamente no alerta de confirmação.
            </span>
          </div>
        }
        confirmText={isBaixandoLote ? 'Dando baixa...' : `Dar Baixa (${itensSelecionados.length})`}
        cancelText="Cancelar"
        variant="danger"
        isSubmitting={isBaixandoLote}
        onClose={() => setShowConfirmBaixaLote(false)}
        onConfirm={confirmarBaixaLote}
      />

      <ReposicaoModal
        isOpen={!!reposicaoData}
        itemSaida={reposicaoData?.itemSaida}
        reserva={reposicaoData?.reserva}
        totalReservas={reposicaoData?.totalReservas}
        isRepondo={isRepondo}
        onConfirmRepor={handleConfirmarRepor}
        onClose={() => setReposicaoData(null)}
      />

      <CoverScannerModal
        isOpen={isCoverScannerOpen}
        onClose={() => setIsCoverScannerOpen(false)}
        onRecognized={handleCoverRecognized}
        title="Buscar Disco por Capa"
      />
    </div>
  );
}
