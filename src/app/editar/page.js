'use client';

import { useState, useEffect, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams, useRouter } from 'next/navigation';
import { TbTools } from 'react-icons/tb';
import { FaMagnifyingGlass, FaBarcode } from 'react-icons/fa6';
import { MdDocumentScanner, MdInventory2 } from 'react-icons/md';
import { PiMusicNotesSimple } from 'react-icons/pi';

import { supabase } from '@/lib/supabase';
import { useCaixas } from '@/hooks/useCaixas';
import { itemService } from '@/services/itemService';
import { movimentacaoService } from '@/services/movimentacaoService';
import { useItemForm } from '@/hooks/useItemForm';
import { useDiscogsSearch } from '@/hooks/useDiscogsSearch';
import { useUndo } from '@/contexts/UndoContext';
import { useStore } from '@/contexts/StoreContext';
import { useReposicao } from '@/contexts/ReposicaoContext';
import { useMobileLeaveConfirm } from '@/hooks/useMobileLeaveConfirm';

import CategoryTabs from '@/components/CategoryTabs';
import AlertMessage from '@/components/AlertMessage';
import StatusSwitch from '@/components/StatusSwitch';
import ConfirmModal from '@/components/ConfirmModal';
import AlbumCover, { setAlbumCoverCache, clearAlbumCoverCache } from '@/components/AlbumCover';
import DiscogsSearchSection from '@/components/DiscogsSearchSection';
import PrensagemSelector from '@/components/PrensagemSelector';
import ItemObservacoesSection from '@/components/ItemObservacoesSection';

import { CATEGORY_IDS, STORE_OPTIONS } from '@/constants/config';
import { formatCaixa, cleanDiscogsString, normalizeCaixa, formatDiscogsQuery } from '@/utils/stringUtils';

const BarcodeScannerModal = dynamic(() => import('@/components/BarcodeScannerModal'), { ssr: false });
const OcrScannerModal = dynamic(() => import('@/components/OcrScannerModal'), { ssr: false });
const CoverScannerModal = dynamic(() => import('@/components/CoverScannerModal'), { ssr: false });

function EditarExcluirContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { activeStore } = useStore();
  const { adicionarTarefa } = useReposicao();
  const { registerUndo } = useUndo();

  const [tipo, setTipo] = useState(searchParams.get('tipo') || CATEGORY_IDS.DISCOS);
  const [tela, setTela] = useState('busca');
  useMobileLeaveConfirm(tela === 'edicao');

  const [termo, setTermo] = useState('');
  const [resultados, setResultados] = useState([]);
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const [mensagem, setMensagem] = useState(null);
  const [confirmarExclusao, setConfirmarExclusao] = useState(null);

  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isOcrOpen, setIsOcrOpen] = useState(false);
  const [isCoverScannerOpen, setIsCoverScannerOpen] = useState(false);
  const [customCaixaMode, setCustomCaixaMode] = useState(false);
  const [scannerTarget, setScannerTarget] = useState('busca'); // 'busca' ou 'discogs'

  const [loadedWithId] = useState(!!searchParams.get('id'));
  const [itemEditando, setItemEditando] = useState(null);
  const [selectedCover, setSelectedCover] = useState(null);
  const [seloPrensagem, setSeloPrensagem] = useState('');
  const [anoPrensagem, setAnoPrensagem] = useState('');

  const [observacoes, setObservacoes] = useState([]);
  const [novaObservacao, setNovaObservacao] = useState('');
  const [loadingObs, setLoadingObs] = useState(false);

  // Pré-carrega o leitor de código de barras
  useEffect(() => {
    import('@/components/BarcodeScannerModal');
  }, []);

  // Auto-dismiss do feedback
  useEffect(() => {
    if (!mensagem) return;
    const timer = setTimeout(() => {
      setMensagem(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [mensagem]);

  const {
    form,
    setForm,
    handleChange,
    handleCaixaBlur,
    sugestoesArtista,
    mostrarSugestoesArtista,
    setMostrarSugestoesArtista,
    sugestoesTitulo,
    mostrarSugestoesTitulo,
    setMostrarSugestoesTitulo,
    selectSuggestion,
    getUnmaskedPreco,
  } = useItemForm(
    {
      artista: '',
      titulo: '',
      ano: '',
      caixa: '',
      preco: '',
      loja: '',
      ativo: true,
    },
    tipo
  );

  const {
    queryDiscogs,
    setQueryDiscogs,
    isSearchingDiscogs,
    discogsResults,
    showDiscogsDropdown,
    setShowDiscogsDropdown,
    searchByQuery,
    searchByBarcode,
    searchByCatno,
    resetDiscogs,
    parseDiscogsItem,
  } = useDiscogsSearch();

  const { caixas } = useCaixas(form.loja || activeStore);

  const tipoNome =
    tipo === CATEGORY_IDS.DISCOS
      ? 'Disco'
      : tipo === CATEGORY_IDS.DVDS
      ? 'DVD'
      : tipo === CATEGORY_IDS.VHS
      ? 'VHS'
      : 'CD';
  const temArtista = tipo !== CATEGORY_IDS.DVDS && tipo !== CATEGORY_IDS.VHS;
  const suportaDiscogs = tipo === CATEGORY_IDS.DISCOS || tipo === CATEGORY_IDS.CDS;

  async function carregarItemPorId(id) {
    try {
      const data = await itemService.getItemById(tipo, id);
      if (data) {
        setResultados([data]);
        abrirEdicao(data);
      }
    } catch (err) {
      console.error('Erro ao carregar item:', err);
    }
  }

  useEffect(() => {
    const urlTipo = searchParams.get('tipo');
    if (urlTipo && urlTipo !== tipo) setTipo(urlTipo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    const id = searchParams.get('id');
    if (id) carregarItemPorId(parseInt(id, 10));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const buscar = async (termoParaBuscar = termo) => {
    const termoLimpo = (typeof termoParaBuscar === 'string' ? termoParaBuscar : termo)?.trim();
    if (!termoLimpo) return;
    try {
      const { data } = await itemService.fetchItems(tipo, {
        busca: termoLimpo,
        mostrarAtivos: true,
        mostrarInativos,
      });
      setResultados(data || []);
      setMensagem(null);
      setConfirmarExclusao(null);
    } catch (err) {
      console.error('Erro na busca de itens:', err);
    }
  };

  const formatarMoeda = (valor) => {
    if (valor == null) return '';
    let str = typeof valor === 'number' ? Math.floor(valor).toString() : String(valor);
    str = str.replace(/\D/g, '');
    if (!str) return '';
    return parseInt(str, 10).toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
  };

  const handleSelectDiscogsResult = (resultado) => {
    const normalizado = parseDiscogsItem(resultado);
    if (!normalizado) return;

    if (normalizado.thumb || normalizado.cover) {
      setSelectedCover({
        thumb: normalizado.thumb,
        cover: normalizado.cover,
      });
    }

    if (normalizado.seloPrensagem) {
      setSeloPrensagem(normalizado.seloPrensagem);
    }
    if (normalizado.anoPrensagem) {
      setAnoPrensagem(normalizado.anoPrensagem);
    }

    setForm((prev) => ({
      ...prev,
      artista: normalizado.artista || prev.artista,
      titulo: normalizado.titulo || prev.titulo,
      ano: normalizado.ano || prev.ano,
    }));

    setShowDiscogsDropdown(false);
    setQueryDiscogs('');
  };

  const handleBarcodeScan = async (codigoBarras) => {
    if (!codigoBarras) return;

    if (scannerTarget === 'discogs') {
      await searchByBarcode(codigoBarras, {
        onSingleResult: (resultado) => {
          handleSelectDiscogsResult(resultado);
          setMensagem({ tipo: 'success', texto: `Código ${codigoBarras} identificado: ${resultado.title}` });
        },
        onResults: (res) => {
          setMensagem({
            tipo: 'success',
            texto: `Código ${codigoBarras}: ${res.length} edições encontradas. Escolha uma abaixo.`,
          });
        },
        onError: (msg) => setMensagem({ tipo: 'error', texto: msg }),
      });
    } else {
      // Busca no acervo local: consulta o Discogs para obter o título ou pesquisa direto pelo código
      try {
        const itemInfo = await searchByBarcode(codigoBarras, {
          onSingleResult: (res) => {
            const parsed = parseDiscogsItem(res);
            const termoFinal = parsed?.titulo || codigoBarras;
            setTermo(termoFinal);
            buscar(termoFinal);
          },
        });
        if (!itemInfo) {
          setTermo(codigoBarras);
          buscar(codigoBarras);
        }
      } catch (_) {
        setTermo(codigoBarras);
        buscar(codigoBarras);
      }
    }
  };

  const handleOcrScan = async (codigoTexto) => {
    if (!codigoTexto) return;

    if (scannerTarget === 'discogs') {
      await searchByCatno(codigoTexto, {
        onSingleResult: (resultado) => {
          handleSelectDiscogsResult(resultado);
          setMensagem({ tipo: 'success', texto: `Catálogo "${codigoTexto}" identificado: ${resultado.title}` });
        },
        onResults: (res) => {
          setMensagem({
            tipo: 'success',
            texto: `Catálogo "${codigoTexto}": ${res.length} edições encontradas.`,
          });
        },
        onError: (msg) => setMensagem({ tipo: 'error', texto: msg }),
      });
    } else {
      try {
        await searchByCatno(codigoTexto, {
          onSingleResult: (res) => {
            const parsed = parseDiscogsItem(res);
            const termoFinal = parsed?.titulo || codigoTexto;
            setTermo(termoFinal);
            buscar(termoFinal);
          },
        });
      } catch (_) {
        setTermo(codigoTexto);
        buscar(codigoTexto);
      }
    }
  };

  const handleCoverRecognized = ({ artista, titulo, ano, preco, coverUrl, confianca }) => {
    if (artista || titulo) {
      const termoBusca = formatDiscogsQuery(artista, titulo);
      const baixaConfianca = String(confianca || '').toLowerCase() === 'baixa';
      setQueryDiscogs(termoBusca);
      if (coverUrl) {
        setSelectedCover({
          thumb: coverUrl,
          cover: coverUrl,
        });
      }
      const precoFormatado = preco ? formatarMoeda(preco) : '';
      if (precoFormatado) {
        setForm((prev) => ({
          ...prev,
          preco: precoFormatado,
        }));
      }
      setMensagem({
        tipo: baixaConfianca ? 'error' : 'success',
        texto: baixaConfianca
          ? 'A identificação da capa ficou incerta. Revise a busca antes de escolher uma prensagem.'
          : `Capa reconhecida: "${termoBusca}"${precoFormatado ? ` • Preço: R$ ${precoFormatado}` : ''}. Selecione a prensagem correta abaixo ou confirme os dados.`,
      });
      if (!baixaConfianca) searchByQuery(termoBusca);
    }
  };

  function abrirEdicao(item) {
    setItemEditando(item);
    setSelectedCover(null);

    // Extrai selo e ano de prensagem caso já estejam na observação [Selo • Ano]
    let selo = '';
    let anoP = '';
    if (item.observacao) {
      const match = item.observacao.match(/^\[([^\]]+)\]/);
      if (match) {
        const parts = match[1].split('•').map((p) => p.trim());
        if (parts.length === 2) {
          selo = parts[0];
          anoP = parts[1];
        } else if (parts.length === 1) {
          if (/^\d{4}$/.test(parts[0])) {
            anoP = parts[0];
          } else {
            selo = parts[0];
          }
        }
      }
    }
    setSeloPrensagem(selo);
    setAnoPrensagem(anoP);

    setForm({
      artista: item.artista || '',
      titulo: item.titulo || '',
      ano: item.ano || '',
      caixa: item.caixa || '',
      preco: formatarMoeda(item.preco),
      loja: item.loja || '',
      ativo: item.ativo !== false,
    });
    setMensagem(null);
    setTela('edicao');
    carregarObservacoes(item.id, item);

    // Discos: pré-busca sugestões no Discogs
    if (tipo === CATEGORY_IDS.DISCOS) {
      const termoBusca = formatDiscogsQuery(item.artista, item.titulo);
      if (termoBusca.trim()) {
        setQueryDiscogs(termoBusca);
        searchByQuery(termoBusca, { isAuto: true });
      }
    } else {
      resetDiscogs();
    }
  }

  const voltarParaBusca = () => {
    if (loadedWithId) {
      router.push('/');
    } else {
      setItemEditando(null);
      setSelectedCover(null);
      setSeloPrensagem('');
      setAnoPrensagem('');
      setTela('busca');
      resetDiscogs();
    }
  };

  const salvar = async () => {
    if (!form.titulo?.trim()) {
      return setMensagem({ tipo: 'error', texto: 'O Título é obrigatório.' });
    }

    const precoSemMascara = getUnmaskedPreco();
    if (precoSemMascara < 0) {
      return setMensagem({ tipo: 'error', texto: 'O preço não pode ser negativo.' });
    }

    const caixaNormalizada = form.caixa?.trim()
      ? normalizeCaixa(form.caixa.trim(), form.loja || activeStore)
      : null;
    const urlCapaEscolhida = selectedCover
      ? selectedCover.cover || selectedCover.thumb
      : itemEditando?.capa_url ?? null;

    const payloadAtualizacao = {
      titulo: form.titulo.trim(),
      preco: precoSemMascara,
      loja: form.loja || null,
      caixa: caixaNormalizada,
      ano: form.ano?.trim() || null,
      ativo: form.ativo !== false,
      capa_url: urlCapaEscolhida ?? null,
    };

    if (temArtista) {
      payloadAtualizacao.artista = form.artista;
    }

    if (tipo === CATEGORY_IDS.DISCOS) {
      const tagPrensagem = [seloPrensagem.trim(), anoPrensagem.trim()].filter(Boolean).join(' • ');
      let observacaoExistente = itemEditando?.observacao || '';
      if (observacaoExistente.startsWith('[')) {
        observacaoExistente = observacaoExistente.replace(/^\[[^\]]+\]\s*/, '');
      }
      const observacaoFinal = tagPrensagem
        ? `[${tagPrensagem}] ${observacaoExistente}`.trim()
        : observacaoExistente;
      payloadAtualizacao.observacao = observacaoFinal || null;
    }

    try {
      const snapshotAntes = JSON.parse(JSON.stringify(itemEditando));
      await itemService.updateItem(tipo, itemEditando.id, payloadAtualizacao);
      const itemAtualizado = { ...itemEditando, ...payloadAtualizacao };
      setItemEditando(itemAtualizado);
      setSelectedCover(null);

      // Sincronização de cache de capa
      if (suportaDiscogs) {
        const anoLimpo = (payloadAtualizacao.ano || '').trim();
        const chaveBuscaCapa = `${(payloadAtualizacao.artista || '').trim()} ${(payloadAtualizacao.titulo || '').trim()} ${anoLimpo}`
          .trim()
          .toLowerCase();

        if (urlCapaEscolhida) {
          setAlbumCoverCache(`${tipo}_${itemEditando.id}`, chaveBuscaCapa, urlCapaEscolhida);
          setAlbumCoverCache(itemEditando.id, chaveBuscaCapa, urlCapaEscolhida);
          if (typeof window !== 'undefined') {
            try {
              sessionStorage.setItem(`cover_${tipo}_${itemEditando.id}_${chaveBuscaCapa}`, urlCapaEscolhida);
              sessionStorage.setItem(`cover_${itemEditando.id}_${chaveBuscaCapa}`, urlCapaEscolhida);
              sessionStorage.setItem(`cover_${chaveBuscaCapa}`, urlCapaEscolhida);
              sessionStorage.setItem(`cover_${tipo}_${itemEditando.id}`, urlCapaEscolhida);
              sessionStorage.setItem(`cover_${itemEditando.id}`, urlCapaEscolhida);
            } catch (_) {}
          }
        } else {
          clearAlbumCoverCache(`${tipo}_${itemEditando.id}`);
          clearAlbumCoverCache(itemEditando.id);
          if (typeof window !== 'undefined') {
            try {
              const prefixoTipo = `cover_${tipo}_${itemEditando.id}`;
              const prefixoLegado = `cover_${itemEditando.id}`;
              Object.keys(sessionStorage).forEach((k) => {
                if (k.startsWith(prefixoTipo) || k.startsWith(prefixoLegado) || k.includes(String(itemEditando.id))) {
                  sessionStorage.removeItem(k);
                }
              });
            } catch (_) {}
          }
        }

        try {
          await fetch('/api/cover', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: itemEditando.id,
              tipo: tipo,
              artista: payloadAtualizacao.artista || '',
              titulo: payloadAtualizacao.titulo || '',
              ano: payloadAtualizacao.ano || '',
              cover: urlCapaEscolhida || null,
              thumb: urlCapaEscolhida || null,
            }),
          });
        } catch (erroCapa) {
          console.warn('Erro ao sincronizar capa no servidor:', erroCapa);
        }
      }

      setMensagem({ tipo: 'success', texto: `${tipoNome} atualizado com sucesso!` });
      setResultados((prev) => prev.map((d) => (d.id === itemEditando.id ? itemAtualizado : d)));
      registerUndo(tipo, [snapshotAntes], () => {
        carregarItemPorId(itemEditando.id);
        buscar();
      });
    } catch (err) {
      setMensagem({ tipo: 'error', texto: err.message });
    }
  };

  const excluir = async (id) => {
    try {
      const itemParaExcluir = resultados.find((d) => d.id === id) || itemEditando;
      const snapshotAntes = JSON.parse(JSON.stringify(itemParaExcluir));
      const isAtivo = itemParaExcluir?.ativo !== false;

      await itemService.deleteItemWithMovement(tipo, itemParaExcluir, 'Saída (Excluído via Edição)');

      if (isAtivo) {
        setMensagem({ tipo: 'success', texto: `Saída do ${tipoNome} registrada.` });

        // REGRA 1.3: Reposição automática para itens ativos
        try {
          const reposicoes = await itemService.findReplacements(tipo, {
            titulo: itemParaExcluir?.titulo,
            artista: itemParaExcluir?.artista,
            excludeId: id,
          });
          if (reposicoes && reposicoes.length > 0) {
            adicionarTarefa({
              itemSaida: itemParaExcluir,
              reserva: reposicoes[0],
              totalReservas: reposicoes.length,
              categoria: tipo,
            });
          }
        } catch (e) {
          console.warn('Erro ao buscar reposições após exclusão:', e);
        }
      } else {
        setMensagem({ tipo: 'success', texto: `${tipoNome} (Inativo) excluído com sucesso.` });
      }

      setConfirmarExclusao(null);
      setResultados((prev) => prev.filter((d) => d.id !== id));
      const undoMovements = isAtivo
        ? [{
            itemId: id,
            payload: movimentacaoService.createMovementPayload(
              tipo,
              id,
              'entrada',
              itemParaExcluir.quantidade || 1,
              'Estorno de saída (desfazer exclusão)',
            ),
          }]
        : [];
      registerUndo(tipo, [snapshotAntes], () => {
        if (itemEditando && itemEditando.id === id) {
          carregarItemPorId(id);
        }
        buscar();
      }, undoMovements);
    } catch (err) {
      setMensagem({ tipo: 'error', texto: err.message });
    }
  };

  const getCampoIdObservacao = () =>
    tipo === 'discos' ? 'disco_id' : tipo === 'dvds' ? 'dvd_id' : tipo === 'cds' ? 'cd_id' : 'vhs_id';

  const carregarObservacoes = async (id, itemFallback) => {
    setLoadingObs(true);
    try {
      const { data } = await supabase
        .from('observacoes_disco')
        .select('*')
        .eq(getCampoIdObservacao(), id)
        .order('criado_em', { ascending: false });

      let lista = data || [];
      const itemAlvo = itemFallback || itemEditando;
      if (lista.length === 0 && itemAlvo?.observacao) {
        lista = [
          {
            id: `legado_${id}`,
            observacao: itemAlvo.observacao,
            criado_em: itemAlvo.created_at || itemAlvo.criado_em || new Date().toISOString(),
            isLegacy: true,
          },
        ];
      }
      setObservacoes(lista);
    } catch (err) {
      console.error('Erro ao carregar observações:', err);
      setObservacoes([]);
    } finally {
      setLoadingObs(false);
    }
  };

  const adicionarObservacao = async () => {
    if (!novaObservacao.trim()) return;
    try {
      const observationText = novaObservacao.trim();
      const data = await movimentacaoService.addObservation(tipo, itemEditando.id, observationText);
      const observationRecord = {
        id: data.id,
        observacao: observationText,
        criado_em: new Date().toISOString(),
      };
      setObservacoes((prev) => [observationRecord, ...prev.filter((o) => !o.isLegacy)]);
      setNovaObservacao('');
      setItemEditando((prev) => ({ ...prev, observacao: observationText }));
    } catch (err) {
      if (err.message && err.message.includes('disco_id') && err.message.includes('not-null')) {
        setMensagem({
          tipo: 'error',
          texto:
            'O banco ainda não está preparado para observações de todas as categorias. Aplique a migration 20261022_atomic_stock_operations.sql antes de publicar esta versão.',
        });
      } else {
        setMensagem({ tipo: 'error', texto: `Erro ao adicionar observação: ${err.message}` });
      }
    }
  };

  const excluirObservacao = async (obsOrId) => {
    const id = typeof obsOrId === 'object' ? obsOrId.id : obsOrId;
    const isLegacy = typeof obsOrId === 'object' ? obsOrId.isLegacy : String(id).startsWith('legado_');
    try {
      if (isLegacy) {
        await itemService.updateItem(tipo, itemEditando.id, { observacao: null });
        setObservacoes((prev) => prev.filter((o) => o.id !== id));
      } else {
        await movimentacaoService.deleteObservation(tipo, itemEditando.id, id);
        setObservacoes((prev) => prev.filter((o) => o.id !== id));
        const remaining = observacoes.filter((observation) => observation.id !== id && !observation.isLegacy);
        setItemEditando((prev) => ({ ...prev, observacao: remaining[0]?.observacao || null }));
      }
    } catch (err) {
      setMensagem({ tipo: 'error', texto: `Erro ao excluir observação: ${err.message}` });
    }
  };

  if (tela === 'edicao' && itemEditando) {
    return (
      <div className="pageContainer">
        <div
          className="topHeader"
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'flex-start',
            gap: '16px',
            flexWrap: 'wrap',
          }}
        >
          <button className="btn btn-secondary btn-back" style={{ flexShrink: 0 }} onClick={voltarParaBusca}>
            ← Voltar
          </button>
          <div
            className="titleGroup"
            style={{ flex: 1, minWidth: '200px', display: 'flex', alignItems: 'center', gap: '12px' }}
          >
            {suportaDiscogs && (
              <AlbumCover
                artista={form.artista}
                titulo={form.titulo}
                ano={form.ano}
                id={itemEditando?.id}
                capaUrl={
                  selectedCover ? selectedCover.thumb || selectedCover.cover : itemEditando?.capa_url
                }
                size={48}
                tipo={tipo}
              />
            )}
            <div>
              <h1 className="page-title" style={{ textAlign: 'left', margin: 0, fontSize: '20px' }}>
                Editando {tipoNome}
              </h1>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                ID #{itemEditando.id} • {itemEditando.loja || 'Sem loja'}
              </span>
            </div>
          </div>
        </div>

        <AlertMessage message={mensagem} onClose={() => setMensagem(null)} />

        <div className="mainCard">
          <div className="form-container-desktop" style={{ marginTop: '16px' }}>
            <div className="form-two-columns">
              {/* Bloco 1: Identificação da Obra */}
            <div className="form-section-card">
              <div className="form-section-header">
                <PiMusicNotesSimple size={18} color="var(--accent)" />
                <h3 className="form-section-title">Identificação da Obra</h3>
              </div>

              {suportaDiscogs && (
                <DiscogsSearchSection
                  query={queryDiscogs}
                  onQueryChange={setQueryDiscogs}
                  onSearch={() =>
                    searchByQuery(queryDiscogs, {
                      onError: (msg) => setMensagem({ tipo: 'error', texto: msg }),
                    })
                  }
                  isSearching={isSearchingDiscogs}
                  results={discogsResults}
                  showDropdown={showDiscogsDropdown}
                  onCloseDropdown={() => setShowDiscogsDropdown(false)}
                  onSelectResult={handleSelectDiscogsResult}
                  onOpenCoverScanner={() => setIsCoverScannerOpen(true)}
                  onOpenBarcodeScanner={() => {
                    setScannerTarget('discogs');
                    setIsScannerOpen(true);
                  }}
                  onOpenOcrScanner={() => {
                    setScannerTarget('discogs');
                    setIsOcrOpen(true);
                  }}
                />
              )}

              <div
                className="form-row"
                style={{
                  position: 'relative',
                  zIndex: mostrarSugestoesArtista || mostrarSugestoesTitulo ? 50 : 1,
                }}
              >
                {temArtista && (
                  <div
                    className="form-group"
                    style={{ position: 'relative', zIndex: mostrarSugestoesArtista ? 60 : 1 }}
                  >
                    <label>Artista</label>
                    <input
                      name="artista"
                      value={form.artista}
                      onChange={handleChange}
                      onFocus={() => {
                        if (sugestoesArtista.length > 0) setMostrarSugestoesArtista(true);
                      }}
                      onBlur={() => setTimeout(() => setMostrarSugestoesArtista(false), 200)}
                      autoComplete="off"
                    />
                    {mostrarSugestoesArtista && (
                      <ul className="sugestoes-dropdown">
                        {sugestoesArtista.map((sug, idx) => (
                          <li
                            key={idx}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              selectSuggestion(sug, 'artista');
                            }}
                          >
                            {sug}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                <div
                  className="form-group"
                  style={{ position: 'relative', zIndex: mostrarSugestoesTitulo ? 60 : 1 }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ marginBottom: 0 }}>Título *</label>
                    {temArtista && (
                      <button
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, titulo: prev.artista }))}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--accent)',
                          cursor: 'pointer',
                          fontSize: '12px',
                        }}
                        title="Copiar artista para o campo título"
                      >
                        Usar Artista
                      </button>
                    )}
                  </div>
                  <input
                    name="titulo"
                    value={form.titulo}
                    onChange={handleChange}
                    onFocus={() => {
                      if (sugestoesTitulo.length > 0) setMostrarSugestoesTitulo(true);
                    }}
                    onBlur={() => setTimeout(() => setMostrarSugestoesTitulo(false), 200)}
                    autoComplete="off"
                  />
                  {mostrarSugestoesTitulo && (
                    <ul className="sugestoes-dropdown">
                      {sugestoesTitulo.map((sug, idx) => (
                        <li
                          key={idx}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            selectSuggestion(sug, 'titulo');
                          }}
                        >
                          {temArtista && sug.artista ? `${sug.artista} — ${sug.titulo}` : sug.titulo}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="form-row">
                <div className="form-group" style={{ maxWidth: '200px' }}>
                  <label>Ano</label>
                  <input
                    name="ano"
                    type="text"
                    value={form.ano || ''}
                    onChange={handleChange}
                    placeholder="Ex: 1982"
                  />
                </div>
              </div>

              {tipo === CATEGORY_IDS.DISCOS && (
                <PrensagemSelector
                  selo={seloPrensagem}
                  onSeloChange={setSeloPrensagem}
                  anoPrensagem={anoPrensagem}
                  onAnoPrensagemChange={setAnoPrensagem}
                />
              )}
            </div>

              {/* Bloco 2: Estoque & Localização */}
              <div className="form-section-card">
              <div className="form-section-header">
                <MdInventory2 size={18} color="var(--accent)" />
                <h3 className="form-section-title">Estoque & Localização</h3>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Loja *</label>
                  <select name="loja" value={form.loja || ''} onChange={handleChange}>
                    <option value="">Nenhuma / Sem Loja</option>
                    {STORE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '4px',
                    }}
                  >
                    <label style={{ marginBottom: 0 }}>
                      {(form.loja === 'Loja 1' || form.loja === 'Loja 2') && itemEditando.categoria === 'discos'
                        ? 'Caixa'
                        : 'Localização'}
                    </label>
                    {(form.loja === 'Loja 1' || form.loja === 'Loja 2') &&
                      itemEditando.categoria === 'discos' && (
                        <button
                          type="button"
                          onClick={() => setCustomCaixaMode(!customCaixaMode)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--accent)',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: 500,
                          }}
                        >
                          {customCaixaMode ? '← Selecionar da lista' : '+ Digitar outra'}
                        </button>
                      )}
                  </div>

                  {(form.loja === 'Loja 1' || form.loja === 'Loja 2') &&
                  itemEditando.categoria === 'discos' &&
                  !customCaixaMode ? (
                    <select name="caixa" value={form.caixa || ''} onChange={handleChange}>
                      <option value="">Selecione a caixa</option>
                      {caixas.map((c) => (
                        <option key={`${c.caixa}-${c.loja}`} value={c.caixa}>
                          {c.label}
                        </option>
                      ))}
                      {form.caixa && !caixas.some((c) => c.caixa === form.caixa) && (
                        <option value={form.caixa}>{form.caixa} (Personalizada)</option>
                      )}
                    </select>
                  ) : (
                    <>
                      <input
                        name="caixa"
                        type="text"
                        list="caixas-list"
                        value={form.caixa || ''}
                        onChange={handleChange}
                        onBlur={() => handleCaixaBlur(form.loja || activeStore)}
                        placeholder={
                          form.loja === 'Loja 2'
                            ? 'Ex: Caixa 5B, 5b...'
                            : form.loja === 'Loja 1' && itemEditando.categoria === 'discos'
                            ? 'Ex: 15'
                            : 'Ex: 15, Estante A...'
                        }
                        autoComplete="off"
                      />
                      <datalist id="caixas-list">
                        {caixas.map((c) => (
                          <option key={`${c.caixa}-${c.loja}`} value={c.caixa}>
                            {c.label} {!activeStore && c.loja ? `(${c.loja})` : ''}
                          </option>
                        ))}
                      </datalist>
                    </>
                  )}
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Preço (R$)</label>
                  <input name="preco" type="text" value={form.preco} onChange={handleChange} />
                </div>
                <div
                  className="form-group"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-end',
                    marginBottom: '8px',
                  }}
                >
                  <StatusSwitch
                    ativo={form.ativo !== false}
                    onChange={(novoAtivo) => setForm((prev) => ({ ...prev, ativo: novoAtivo }))}
                  />
                </div>
              </div>
            </div>

            </div>

            {/* Bloco 3: Observações em Largura Total */}
            <ItemObservacoesSection
              tipoNome={tipoNome}
              observacoes={observacoes}
              novaObservacao={novaObservacao}
              onNovaObservacaoChange={setNovaObservacao}
              onAdicionarObservacao={adicionarObservacao}
              onExcluirObservacao={excluirObservacao}
              loading={loadingObs}
            />

            {/* Ações de Edição */}
            <div className="edit-actions">
              <button
                type="button"
                className="btn btn-danger btn-delete-item"
                onClick={() => setConfirmarExclusao(itemEditando.id)}
              >
                Excluir este item
              </button>
              <button
                type="button"
                className="btn btn-primary btn-save-item"
                onClick={salvar}
              >
                Salvar Alterações
              </button>
            </div>
          </div>
        </div>

        <ConfirmModal
          isOpen={!!confirmarExclusao}
          title={itemEditando?.ativo !== false ? 'Confirmar Saída' : 'Confirmar Exclusão'}
          message={
            <span>
              Tem certeza que deseja {itemEditando?.ativo !== false ? 'registrar a saída de' : 'excluir o item reserva'}{' '}
              <strong>
                {temArtista && itemEditando?.artista ? `${itemEditando.artista} — ` : ''}
                {itemEditando?.titulo}
              </strong>
              ?<br />
              {itemEditando?.ativo !== false
                ? 'Esta ação atualizará o estoque físico e registrará a saída no histórico.'
                : 'Esta ação removerá o item inativo do estoque.'}
            </span>
          }
          confirmText={itemEditando?.ativo !== false ? 'Sim, registrar saída' : 'Sim, excluir'}
          cancelText="Cancelar"
          variant="danger"
          onConfirm={() => {
            const id = confirmarExclusao;
            excluir(id);
            voltarParaBusca();
          }}
          onClose={() => setConfirmarExclusao(null)}
        />

        <BarcodeScannerModal
          isOpen={isScannerOpen}
          onClose={() => setIsScannerOpen(false)}
          onScan={handleBarcodeScan}
        />

        <OcrScannerModal
          isOpen={isOcrOpen}
          onClose={() => setIsOcrOpen(false)}
          onScan={handleOcrScan}
        />

        <CoverScannerModal
          isOpen={isCoverScannerOpen}
          onClose={() => setIsCoverScannerOpen(false)}
          onCoverRecognized={handleCoverRecognized}
        />
      </div>
    );
  }

  return (
    <div className="pageContainer">
      <div className="topHeader">
        <div className="titleGroup">
          <TbTools size={28} color="var(--accent)" />
          <h1 className="page-title">Editar ou Excluir</h1>
        </div>
      </div>

      <div className="mainCard">
        <CategoryTabs
          activeTab={tipo}
          onTabChange={(novaTab) => {
            setTipo(novaTab);
            setResultados([]);
            setMensagem(null);
            setItemEditando(null);
            setTela('busca');
          }}
        />
        <AlertMessage message={mensagem} onClose={() => setMensagem(null)} />

        <div className="filterCard" style={{ marginTop: '16px' }}>
          <div className="form-group" style={{ width: '100%', marginBottom: '10px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FaMagnifyingGlass /> Buscar por{' '}
              {tipo === CATEGORY_IDS.DVDS || tipo === CATEGORY_IDS.VHS ? 'título' : 'artista ou título'}
            </label>
            <div className="discogs-search-row">
              <input
                value={termo}
                onChange={(e) => setTermo(e.target.value)}
                placeholder="Ex: Beatles..."
                onKeyDown={(e) => e.key === 'Enter' && buscar()}
              />
              <button type="button" className="discogs-btn-buscar" onClick={() => buscar()}>
                <FaMagnifyingGlass size={13} /> Buscar
              </button>
            </div>
            <div className="discogs-scanners-row">
              <button
                type="button"
                onClick={() => {
                  setScannerTarget('busca');
                  setIsScannerOpen(true);
                }}
                className="discogs-scanner-chip"
                title="Escanear código de barras para localizar no estoque"
              >
                <FaBarcode size={14} /> Barras
              </button>
              <button
                type="button"
                onClick={() => {
                  setScannerTarget('busca');
                  setIsOcrOpen(true);
                }}
                className="discogs-scanner-chip"
                title="Ler código de catálogo com a câmera (OCR)"
              >
                <MdDocumentScanner size={16} /> OCR
              </button>
            </div>
          </div>

          <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              id="mostrarInativos"
              checked={mostrarInativos}
              onChange={(e) => setMostrarInativos(e.target.checked)}
              style={{ width: 'auto', accentColor: 'var(--accent)' }}
            />
            <label
              htmlFor="mostrarInativos"
              style={{ fontSize: '13px', cursor: 'pointer', color: 'var(--text)' }}
            >
              Incluir inativos na busca
            </label>
          </div>
        </div>

        {resultados.length > 0 && (
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Localização</th>
                  {temArtista && <th>Artista</th>}
                  <th>Título</th>
                  <th style={{ whiteSpace: 'nowrap' }}>Loja</th>
                  <th style={{ whiteSpace: 'nowrap' }}>Preço</th>
                  <th>Status</th>
                  <th style={{ width: '80px' }}>Ação</th>
                </tr>
              </thead>
              <tbody>
                {resultados
                  .filter((item) => mostrarInativos || item.ativo !== false)
                  .map((item) => (
                    <tr key={item.id} style={item.ativo === false ? { opacity: 0.5 } : {}}>
                      <td data-label="Local">{formatCaixa(item.caixa, item.loja)}</td>
                      {temArtista && <td data-label="Artista">{item.artista}</td>}
                      <td data-label="Título">{item.titulo}</td>
                      <td data-label="Loja" style={{ whiteSpace: 'nowrap' }}>
                        {item.loja ? (
                          <span className={`loja-badge ${item.loja === 'Loja 1' ? 'loja-badge-1' : item.loja === 'Loja 2' ? 'loja-badge-2' : ''}`}>
                            {item.loja}
                          </span>
                        ) : '—'}
                      </td>
                      <td data-label="Preço" style={{ whiteSpace: 'nowrap', color: 'var(--price, #6EE7B7)', fontWeight: 600 }}>
                        R$ {Number(item.preco || 0).toFixed(2).replace('.', ',')}
                      </td>
                      <td data-label="Status">
                        <span className={`badge ${item.ativo !== false ? 'badge-entrada' : 'badge-saida'}`}>
                          {item.ativo !== false ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td data-label="Ação">
                        <button className="btn btn-primary" onClick={() => abrirEdicao(item)}>
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleBarcodeScan}
      />

      <OcrScannerModal
        isOpen={isOcrOpen}
        onClose={() => setIsOcrOpen(false)}
        onScan={handleOcrScan}
      />

      <CoverScannerModal
        isOpen={isCoverScannerOpen}
        onClose={() => setIsCoverScannerOpen(false)}
        onCoverRecognized={handleCoverRecognized}
      />
    </div>
  );
}

export default function EditarExcluir() {
  return (
    <Suspense fallback={<p>Carregando...</p>}>
      <EditarExcluirContent />
    </Suspense>
  );
}
