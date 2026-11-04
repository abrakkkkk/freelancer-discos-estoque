'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { IoIosAddCircleOutline } from 'react-icons/io';
import { MdInventory2 } from 'react-icons/md';
import { PiMusicNotesSimple } from 'react-icons/pi';

import StatusSwitch from '@/components/StatusSwitch';
import CategoryTabs from '@/components/CategoryTabs';
import AlertMessage from '@/components/AlertMessage';
import DiscogsSearchSection from '@/components/DiscogsSearchSection';
import PrensagemSelector from '@/components/PrensagemSelector';

import { useMobileLeaveConfirm } from '@/hooks/useMobileLeaveConfirm';
import { useCaixas } from '@/hooks/useCaixas';
import { useItemForm } from '@/hooks/useItemForm';
import { useDiscogsSearch } from '@/hooks/useDiscogsSearch';
import { itemService } from '@/services/itemService';
import { movimentacaoService } from '@/services/movimentacaoService';
import { useStore } from '@/contexts/StoreContext';
import { CATEGORY_IDS, STORE_OPTIONS, SEM_CAPA } from '@/constants/config';
import { formatDiscogsQuery, normalizeCaixa } from '@/utils/stringUtils';

const BarcodeScannerModal = dynamic(() => import('@/components/BarcodeScannerModal'), { ssr: false });
const OcrScannerModal = dynamic(() => import('@/components/OcrScannerModal'), { ssr: false });
const CoverScannerModal = dynamic(() => import('@/components/CoverScannerModal'), { ssr: false });

const FORMULARIO_INICIAL = {
  artista: '',
  titulo: '',
  ano: '',
  caixa: '',
  loja: '',
  preco: '',
  observacao: '',
  ativo: true,
};

export default function AdicionarItem() {
  useMobileLeaveConfirm();

  const [activeTab, setActiveTab] = useState(CATEGORY_IDS.DISCOS);
  const { activeStore } = useStore();
  const [customCaixaMode, setCustomCaixaMode] = useState(false);
  const [mensagem, setMensagem] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [selectedCover, setSelectedCover] = useState(null);
  const [seloPrensagem, setSeloPrensagem] = useState('');
  const [anoPrensagem, setAnoPrensagem] = useState('');
  const [prensagemResetKey, setPrensagemResetKey] = useState(0);

  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isOcrOpen, setIsOcrOpen] = useState(false);
  const [isCoverScannerOpen, setIsCoverScannerOpen] = useState(false);

  const artistaInputRef = useRef(null);
  const tituloInputRef = useRef(null);

  // Pré-carrega o leitor de código de barras para abertura instantânea
  useEffect(() => {
    import('@/components/BarcodeScannerModal');
  }, []);

  // Auto-dismiss de feedback após 5 segundos
  useEffect(() => {
    if (!mensagem) return;
    const timer = setTimeout(() => {
      setMensagem(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [mensagem]);

  const formularioInicialComLoja = {
    ...FORMULARIO_INICIAL,
    loja: activeStore || '',
  };

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
    formatarPreco,
  } = useItemForm(formularioInicialComLoja, activeTab);

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

  const isVideo = activeTab === CATEGORY_IDS.DVDS || activeTab === CATEGORY_IDS.VHS;
  const suportaDiscogs = activeTab === CATEGORY_IDS.DISCOS || activeTab === CATEGORY_IDS.CDS;

  const handleTabChange = (novaTab) => {
    setPrensagemResetKey((key) => key + 1);
    setActiveTab(novaTab);
    setMensagem(null);
    setForm({ ...FORMULARIO_INICIAL, loja: activeStore || '', ativo: true });
    setSelectedCover(null);
    setSeloPrensagem('');
    setAnoPrensagem('');
    setMostrarSugestoesArtista(false);
    setMostrarSugestoesTitulo(false);
    resetDiscogs();
  };

  const validarFormulario = () => {
    if (!isVideo && !form.artista?.trim()) return 'Preencha o artista.';
    if (!form.titulo?.trim()) return 'O Título é obrigatório.';
    if (form.ativo !== false && !form.loja) return 'Selecione uma loja.';
    if (getUnmaskedPreco() < 0) return 'O preço não pode ser negativo.';
    return null;
  };

  const handleSelectDiscogsResult = (resultado) => {
    const itemNormalizado = parseDiscogsItem(resultado);
    if (!itemNormalizado) return;

    if (itemNormalizado.thumb || itemNormalizado.cover) {
      setSelectedCover({
        thumb: itemNormalizado.thumb,
        cover: itemNormalizado.cover,
      });
    }

    if (itemNormalizado.seloPrensagem) {
      setSeloPrensagem(itemNormalizado.seloPrensagem);
    }
    if (itemNormalizado.anoPrensagem) {
      setAnoPrensagem(itemNormalizado.anoPrensagem);
    }

    setForm((prev) => ({
      ...prev,
      artista: itemNormalizado.artista || prev.artista,
      titulo: itemNormalizado.titulo || prev.titulo,
      ano: itemNormalizado.ano || prev.ano,
    }));

    setShowDiscogsDropdown(false);
    setQueryDiscogs('');
  };

  const handleCoverRecognized = async ({ artista, titulo, ano, preco, confianca }) => {
    if (!artista && !titulo && !preco) return;
    const baixaConfianca = String(confianca || '').toLowerCase() === 'baixa';

    let artistaNormalizado = (artista || '').trim();
    if (/^(v[aá]rios(\s+artistas)?|various(\s+artists)?|trilha\s+sonora(\s+original)?)$/i.test(artistaNormalizado)) {
      artistaNormalizado = 'Various';
    }

    const termoBusca = formatDiscogsQuery(artistaNormalizado, titulo);
    const precoFormatado = preco ? formatarPreco(preco) : '';

    setForm((prev) => ({
      ...prev,
      artista: artistaNormalizado || prev.artista,
      titulo: titulo || prev.titulo,
      ano: ano || prev.ano,
      ...(precoFormatado ? { preco: precoFormatado } : {}),
    }));

    setQueryDiscogs(termoBusca);
    setMensagem({
      tipo: baixaConfianca ? 'error' : 'success',
      texto: baixaConfianca
        ? `A identificação da capa ficou incerta. Revise artista e título antes de buscar.${precoFormatado ? ` Preço reconhecido: R$ ${precoFormatado}.` : ''}`
        : `Capa identificada: "${termoBusca}"${ano ? ` (${ano})` : ''}${precoFormatado ? ` • Preço: R$ ${precoFormatado}` : ''}. Buscando prensagens...`,
    });

    if (termoBusca && !baixaConfianca) {
      await searchByQuery(termoBusca, {
        onResults: () => {
          setMensagem({
            tipo: 'success',
            texto: `Capa identificada: "${termoBusca}"${precoFormatado ? ` • Preço: R$ ${precoFormatado}` : ''}. Selecione a prensagem correta abaixo ou confirme os dados.`,
          });
        },
        onError: () => {
          setMensagem({
            tipo: 'success',
            texto: `Capa identificada: "${termoBusca}"${precoFormatado ? ` • Preço: R$ ${precoFormatado}` : ''}. Nenhuma prensagem encontrada; campos preenchidos.`,
          });
        },
      });
    }
  };

  const handleBarcodeScan = async (codigoBarras) => {
    if (!codigoBarras) return;
    setMensagem(null);

    await searchByBarcode(codigoBarras, {
      onSingleResult: (resultado) => {
        handleSelectDiscogsResult(resultado);
        setMensagem({ tipo: 'success', texto: `Código ${codigoBarras} identificado: ${resultado.title}` });
      },
      onResults: (resultados) => {
        setMensagem({
          tipo: 'success',
          texto: `Código ${codigoBarras}: ${resultados.length} edições encontradas. Escolha uma abaixo.`,
        });
      },
      onError: (erroTexto) => setMensagem({ tipo: 'error', texto: erroTexto }),
    });
  };

  const handleOcrScan = async (codigoCatalogo) => {
    if (!codigoCatalogo) return;
    setMensagem(null);

    await searchByCatno(codigoCatalogo, {
      onSingleResult: (resultado) => {
        handleSelectDiscogsResult(resultado);
        setMensagem({ tipo: 'success', texto: `Catálogo "${codigoCatalogo}" identificado: ${resultado.title}` });
      },
      onResults: (resultados) => {
        setMensagem({
          tipo: 'success',
          texto: `Catálogo "${codigoCatalogo}": ${resultados.length} edições encontradas. Escolha uma abaixo.`,
        });
      },
      onError: (erroTexto) => setMensagem({ tipo: 'error', texto: erroTexto }),
    });
  };

  const handleSubmit = async (evento) => {
    evento.preventDefault();
    if (isSubmitting) return;

    setMensagem(null);
    const erroValidacao = validarFormulario();
    if (erroValidacao) {
      setMensagem({ tipo: 'error', texto: erroValidacao });
      return;
    }

    setIsSubmitting(true);
    try {
      const caixaFinal = form.caixa?.trim()
        ? normalizeCaixa(form.caixa.trim(), form.loja || activeStore)
        : null;
      const capaEscolhida = selectedCover?.cover || selectedCover?.thumb || SEM_CAPA;

      let observacaoFinal = form.observacao?.trim() || null;
      if (activeTab === CATEGORY_IDS.DISCOS && (seloPrensagem.trim() || anoPrensagem.trim())) {
        const tagPrensagem = [seloPrensagem.trim(), anoPrensagem.trim()].filter(Boolean).join(' • ');
        observacaoFinal = tagPrensagem ? `[${tagPrensagem}] ${observacaoFinal || ''}`.trim() : observacaoFinal;
      }

      const itemPayload = {
        titulo: form.titulo.trim(),
        preco: getUnmaskedPreco(),
        loja: form.loja || null,
        observacao: observacaoFinal,
        caixa: caixaFinal,
        ano: form.ano?.trim() || null,
        ativo: form.ativo !== false,
        capa_url: capaEscolhida,
      };

      if (!isVideo) {
        itemPayload.artista = form.artista.trim();
      }

      const payloadMovimentacao = movimentacaoService.createMovementPayload(
        activeTab,
        null,
        'entrada',
        1,
        'Cadastro inicial'
      );
      const campoIdObservacao =
        activeTab === 'discos'
          ? 'disco_id'
          : activeTab === 'dvds'
          ? 'dvd_id'
          : activeTab === 'cds'
          ? 'cd_id'
          : 'vhs_id';
      const observacaoInicial = form.observacao?.trim()
        ? { [campoIdObservacao]: null, observacao: form.observacao.trim() }
        : null;

      const itemCriado = await itemService.addItem(
        activeTab,
        itemPayload,
        payloadMovimentacao,
        observacaoInicial,
      );

      // Sincronização assíncrona de capa sem bloquear interface
      // Sem capa escolhida não sincroniza: o POST faria uma busca automática e gravaria capa aleatória
      const urlCapaParaCache = selectedCover?.cover || selectedCover?.thumb;
      if (suportaDiscogs && urlCapaParaCache) {
        const chaveBuscaCapa = `${(itemPayload.artista || '').trim()} ${(itemPayload.titulo || '').trim()}`.toLowerCase();

        if (urlCapaParaCache && typeof window !== 'undefined') {
          try {
            sessionStorage.setItem(`cover_${activeTab}_${itemCriado.id}_${chaveBuscaCapa}`, urlCapaParaCache);
            sessionStorage.setItem(`cover_${itemCriado.id}_${chaveBuscaCapa}`, urlCapaParaCache);
            sessionStorage.setItem(`cover_${chaveBuscaCapa}`, urlCapaParaCache);
            sessionStorage.setItem(`cover_${activeTab}_${itemCriado.id}`, urlCapaParaCache);
            sessionStorage.setItem(`cover_${itemCriado.id}`, urlCapaParaCache);
          } catch (_) {}
        }

        fetch('/api/cover', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: itemCriado.id,
            tipo: activeTab,
            artista: itemPayload.artista || '',
            titulo: itemPayload.titulo || '',
            ano: itemPayload.ano || '',
            cover: selectedCover?.cover || null,
            thumb: selectedCover?.thumb || null,
          }),
        }).catch(() => {});
      }

      setSelectedCover(null);

      const nomeTipo =
        activeTab === 'discos' ? 'Disco' : activeTab === 'dvds' ? 'DVD' : activeTab === 'vhs' ? 'VHS' : 'CD';
      const textoLocalizacao = form.caixa ? ` em "${form.caixa}"` : '';
      const textoStatus = form.ativo === false ? ' [Inativo]' : '';
      const textoLoja = form.loja ? ` (${form.loja})` : '';

      setMensagem({
        tipo: 'success',
        texto: `"${form.titulo}" adicionado como ${nomeTipo}${textoStatus}${textoLocalizacao}${textoLoja}.`,
      });

      setForm({
        ...FORMULARIO_INICIAL,
        caixa: caixaFinal || form.caixa,
        loja: form.loja,
        ativo: form.ativo !== false,
      });
      setSeloPrensagem('');
      setAnoPrensagem('');
      setPrensagemResetKey((key) => key + 1);
      resetDiscogs();

      setTimeout(() => {
        if (isVideo) {
          tituloInputRef.current?.focus();
        } else {
          artistaInputRef.current?.focus();
        }
      }, 50);
    } catch (erro) {
      console.error(erro);
      setMensagem({ tipo: 'error', texto: `Erro: ${erro.message}` });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="pageContainer">
      <div className="topHeader">
        <div className="titleGroup">
          <IoIosAddCircleOutline size={28} color="var(--accent)" />
          <h1 className="page-title">Adicionar Item</h1>
        </div>
      </div>

      <div className="mainCard">
        <CategoryTabs activeTab={activeTab} onTabChange={handleTabChange} />
        <AlertMessage message={mensagem} onClose={() => setMensagem(null)} />

        <form onSubmit={handleSubmit} className="form-container-desktop" style={{ marginTop: '24px' }}>
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
                onOpenBarcodeScanner={() => setIsScannerOpen(true)}
                onOpenOcrScanner={() => setIsOcrOpen(true)}
              />
            )}

            <div
              className="form-row"
              style={{
                position: 'relative',
                zIndex: mostrarSugestoesArtista || mostrarSugestoesTitulo ? 50 : 1,
              }}
            >
              {!isVideo && (
                <div
                  className="form-group"
                  style={{ position: 'relative', zIndex: mostrarSugestoesArtista ? 60 : 1 }}
                >
                  <label>Artista *</label>
                  <input
                    ref={artistaInputRef}
                    name="artista"
                    value={form.artista}
                    onChange={handleChange}
                    aria-required="true"
                    onFocus={() => {
                      if (sugestoesArtista.length > 0) setMostrarSugestoesArtista(true);
                    }}
                    onBlur={() => setTimeout(() => setMostrarSugestoesArtista(false), 200)}
                    autoComplete="off"
                  />
                  {mostrarSugestoesArtista && (
                    <ul className="sugestoes-dropdown">
                      {sugestoesArtista.map((sugestao, idx) => (
                        <li
                          key={idx}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            selectSuggestion(sugestao, 'artista');
                          }}
                        >
                          {sugestao}
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
                  {!isVideo && (
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
                  ref={tituloInputRef}
                  name="titulo"
                  value={form.titulo}
                  onChange={handleChange}
                  aria-required="true"
                  onFocus={() => {
                    if (sugestoesTitulo.length > 0) setMostrarSugestoesTitulo(true);
                  }}
                  onBlur={() => setTimeout(() => setMostrarSugestoesTitulo(false), 200)}
                  autoComplete="off"
                />
                {mostrarSugestoesTitulo && (
                  <ul className="sugestoes-dropdown">
                    {sugestoesTitulo.map((sugestao, idx) => (
                      <li
                        key={idx}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          selectSuggestion(sugestao, 'titulo');
                        }}
                      >
                        {!isVideo && sugestao.artista
                          ? `${sugestao.artista} — ${sugestao.titulo}`
                          : sugestao.titulo}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group" style={{ maxWidth: '200px' }}>
                <label>Ano (Opcional)</label>
                <input
                  name="ano"
                  type="text"
                  value={form.ano || ''}
                  onChange={handleChange}
                  placeholder="Ex: 1982"
                />
              </div>
            </div>

            {activeTab === CATEGORY_IDS.DISCOS && (
              <PrensagemSelector
                key={prensagemResetKey}
                selo={seloPrensagem}
                onSeloChange={setSeloPrensagem}
                anoPrensagem={anoPrensagem}
                onAnoPrensagemChange={setAnoPrensagem}
                collapsible
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
                <label>Loja {form.ativo !== false ? '*' : '(Opcional)'}</label>
                <select
                  name="loja"
                  value={form.loja}
                  onChange={handleChange}
                  aria-required={form.ativo !== false}
                >
                  <option value="">Selecione uma loja</option>
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
                    {(form.loja === 'Loja 1' || form.loja === 'Loja 2') && activeTab === CATEGORY_IDS.DISCOS
                      ? 'Caixa'
                      : 'Localização'}{' '}
                    (Opcional)
                  </label>
                  {(form.loja === 'Loja 1' || form.loja === 'Loja 2') && activeTab === CATEGORY_IDS.DISCOS && (
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
                activeTab === CATEGORY_IDS.DISCOS &&
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
                          : form.loja === 'Loja 1' && activeTab === CATEGORY_IDS.DISCOS
                          ? 'Ex: 15'
                          : 'Ex: 15, Estante A, Prateleira 3...'
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
                <label>Preço (R$) (Opcional)</label>
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

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Observação (Opcional)</label>
              <textarea
                name="observacao"
                value={form.observacao}
                onChange={handleChange}
                rows="3"
                style={{ width: '100%', resize: 'vertical' }}
                placeholder="Qualquer detalhe adicional sobre o item..."
              ></textarea>
            </div>
          </div>
        </div>

          <div className="form-submit-row" style={{ marginTop: '20px' }}>
            <button
              type="submit"
              className="btn btn-primary submit-item-btn"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? 'Adicionando...'
                : `Adicionar ${
                    activeTab === 'discos'
                      ? 'Disco'
                      : activeTab === 'dvds'
                      ? 'DVD'
                      : activeTab === 'vhs'
                      ? 'VHS'
                      : 'CD'
                  }`}
            </button>
          </div>
        </form>
      </div>

      <CoverScannerModal
        isOpen={isCoverScannerOpen}
        onClose={() => setIsCoverScannerOpen(false)}
        onRecognized={handleCoverRecognized}
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
    </div>
  );
}
