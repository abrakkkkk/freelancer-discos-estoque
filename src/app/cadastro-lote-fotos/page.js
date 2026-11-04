'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { FaCamera } from 'react-icons/fa6';
import { MdCheckCircle } from 'react-icons/md';

import { useCaixas } from '@/hooks/useCaixas';
import { useStore } from '@/contexts/StoreContext';
import { itemService } from '@/services/itemService';
import { movimentacaoService } from '@/services/movimentacaoService';
import { loteFotosService } from '@/services/loteFotosService';
import { parseDiscogsItem } from '@/utils/discogsClient';
import { normalizeCaixa } from '@/utils/stringUtils';
import { prepararFoto } from '@/utils/imageUtils';
import { CATEGORY_IDS, SEM_CAPA } from '@/constants/config';

import AlertMessage from '@/components/AlertMessage';
import LoteConfigCard from '@/components/LoteConfigCard';
import LoteActionsBar from '@/components/LoteActionsBar';
import LoteItemCard from '@/components/LoteItemCard';
import LoteDiscogsModal from '@/components/LoteDiscogsModal';

export default function CadastroLoteFotos() {
  const { activeStore } = useStore();

  // Configuração padrão do lote
  const [tipo, setTipo] = useState(CATEGORY_IDS.DISCOS);
  const [loja, setLoja] = useState(activeStore || 'Loja 1');
  const [caixaPadrao, setCaixaPadrao] = useState('');
  const [precoPadrao, setPrecoPadrao] = useState('');

  const { caixas } = useCaixas(loja || activeStore);

  // Lista de itens do lote e estados de progresso
  const [itens, setItens] = useState([]);
  const [isProcessando, setIsProcessando] = useState(false);
  const [progresso, setProgresso] = useState({ atual: 0, total: 0 });
  const [statusProgresso, setStatusProgresso] = useState('');
  const [isSalvando, setIsSalvando] = useState(false);
  const [progressoSalvar, setProgressoSalvar] = useState({ atual: 0, total: 0 });
  const [mensagem, setMensagem] = useState(null);
  const [sucessoFinal, setSucessoFinal] = useState(null);

  // Modal de busca manual de prensagem para um item específico
  const [itemParaPesquisa, setItemParaPesquisa] = useState(null);

  const fileInputRef = useRef(null);

  // Sincroniza loja padrão se mudar o contexto global
  useEffect(() => {
    if (activeStore && !loja) {
      setLoja(activeStore);
    }
  }, [activeStore, loja]);

  // Auto-dismiss de feedback
  useEffect(() => {
    if (!sucessoFinal) return;
    const timer = setTimeout(() => {
      setSucessoFinal(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [sucessoFinal]);

  useEffect(() => {
    if (!mensagem) return;
    const timer = setTimeout(() => {
      setMensagem(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [mensagem]);

  // Reprocessamento de um único item
  const reprocessarItem = async (itemId) => {
    const itemAlvo = itens.find((it) => it.id === itemId);
    if (!itemAlvo) return;

    let dataUrl = itemAlvo.dataUrl;
    if (!dataUrl && itemAlvo.file) {
      try {
        const fotoPreparada = await prepararFoto(itemAlvo.file, 800, 160);
        dataUrl = fotoPreparada.dataUrl;
      } catch (e) {
        console.error('Erro ao regerar dataUrl para reprocessar:', e);
      }
    }

    if (!dataUrl) {
      setMensagem({ tipo: 'error', texto: 'Não foi possível carregar a imagem para reprocessamento.' });
      return;
    }

    setItens((prev) =>
      prev.map((it) => (it.id === itemId ? { ...it, processandoItem: true } : it))
    );

    try {
      const dadosGemini = await loteFotosService.reconhecerFoto(dataUrl, setStatusProgresso);
      const artistaGemini = (dadosGemini?.artista || '').trim();
      const tituloGemini = (dadosGemini?.titulo || '').trim();
      const anoGemini = (dadosGemini?.ano || '').trim();
      const confianca = dadosGemini?.confianca || (artistaGemini || tituloGemini ? 'media' : 'baixa');

      const dadosEnriquecidos = await loteFotosService.enriquecerComDiscogs(
        artistaGemini,
        tituloGemini,
        anoGemini
      );
      const temDados = Boolean(dadosEnriquecidos.titulo || dadosEnriquecidos.artista);

      setItens((prev) =>
        prev.map((it) => {
          if (it.id !== itemId) return it;
          return {
            ...it,
            dataUrl,
            artista: dadosEnriquecidos.artista || it.artista,
            titulo: dadosEnriquecidos.titulo || it.titulo,
            ano: dadosEnriquecidos.ano || it.ano,
            preco: (dadosGemini?.preco ? String(dadosGemini.preco) : it.preco) || '',
            selo: dadosEnriquecidos.selo || it.selo,
            capaUrl: dadosEnriquecidos.capaUrl || it.capaUrl,
            confianca,
            reconhecido: temDados,
            selecionado: temDados ? true : it.selecionado,
            processandoItem: false,
          };
        })
      );
    } catch (erro) {
      console.error('Erro ao reprocessar item:', erro);
      setItens((prev) =>
        prev.map((it) => (it.id === itemId ? { ...it, processandoItem: false } : it))
      );
    }
  };

  // Reprocessamento de itens vazios em lote
  const reprocessarVazios = async () => {
    const vazios = itens.filter(
      (it) => !it.titulo?.trim() && !it.artista?.trim() && (it.dataUrl || it.file)
    );
    if (vazios.length === 0) return;

    setIsProcessando(true);
    setProgresso({ atual: 0, total: vazios.length });

    for (let i = 0; i < vazios.length; i++) {
      const item = vazios[i];
      setProgresso({ atual: i + 1, total: vazios.length });
      setStatusProgresso(`Reprocessando foto ${i + 1} de ${vazios.length}...`);
      if (i > 0) await new Promise((r) => setTimeout(r, 1000));
      await reprocessarItem(item.id);
    }

    setIsProcessando(false);
    setStatusProgresso('');
  };

  // Seleção e processamento de arquivos fotográficos
  const handleFilesSelected = async (evento) => {
    const arquivos = Array.from(evento.target.files || []);
    if (arquivos.length === 0) return;

    setMensagem(null);
    setSucessoFinal(null);
    setIsProcessando(true);
    setProgresso({ atual: 0, total: arquivos.length });
    setStatusProgresso('');

    let pacingMs = 1000;
    let reconhecidosTotal = 0;

    for (let i = 0; i < arquivos.length; i++) {
      setProgresso({ atual: i + 1, total: arquivos.length });
      setStatusProgresso(
        `Analisando foto ${i + 1} de ${arquivos.length} (${reconhecidosTotal} identificados)...`
      );
      const arquivo = arquivos[i];

      if (i > 0) {
        await new Promise((r) => setTimeout(r, pacingMs));
      }

      try {
        const { dataUrl, thumbUrl, erro } = await prepararFoto(arquivo, 800, 160);
        if (erro || !dataUrl) {
          throw new Error(erro || 'Falha ao processar miniatura da foto');
        }

        const tempoInicio = Date.now();
        const dadosGemini = await loteFotosService.reconhecerFoto(dataUrl, setStatusProgresso);
        const tempoDecorrido = Date.now() - tempoInicio;

        if (!dadosGemini) {
          pacingMs = Math.min(pacingMs + 600, 2500);
        } else if (tempoDecorrido > 4000) {
          pacingMs = Math.min(pacingMs + 300, 2000);
        } else {
          pacingMs = Math.max(pacingMs - 200, 800);
        }

        const artistaGemini = (dadosGemini?.artista || '').trim();
        const tituloGemini = (dadosGemini?.titulo || '').trim();
        const anoGemini = (dadosGemini?.ano || '').trim();
        const confianca = dadosGemini?.confianca || (artistaGemini || tituloGemini ? 'media' : 'baixa');

        const dadosEnriquecidos = await loteFotosService.enriquecerComDiscogs(
          artistaGemini,
          tituloGemini,
          anoGemini
        );
        const temDados = Boolean(dadosEnriquecidos.titulo || dadosEnriquecidos.artista);
        if (temDados) reconhecidosTotal++;

        const novoItem = {
          id: `item-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 4)}`,
          file: arquivo,
          dataUrl,
          fotoPreview: thumbUrl || dataUrl,
          artista: dadosEnriquecidos.artista,
          titulo: dadosEnriquecidos.titulo,
          ano: dadosEnriquecidos.ano,
          preco: (dadosGemini?.preco ? String(dadosGemini.preco) : precoPadrao) || '',
          caixa: caixaPadrao || '',
          selo: dadosEnriquecidos.selo,
          capaUrl: dadosEnriquecidos.capaUrl,
          confianca,
          reconhecido: temDados,
          processandoItem: false,
          discogsResults: dadosEnriquecidos.discogsMatch ? [dadosEnriquecidos.discogsMatch] : [],
          selecionado: temDados,
        };

        setItens((prev) => [...prev, novoItem]);
      } catch (err) {
        console.error(`Erro ao processar arquivo ${arquivo.name}:`, err);
        let previewFallback = '';
        try {
          previewFallback = URL.createObjectURL(arquivo);
        } catch (_) {}

        setItens((prev) => [
          ...prev,
          {
            id: `item-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 4)}`,
            file: arquivo,
            dataUrl: null,
            fotoPreview: previewFallback,
            artista: '',
            titulo: '',
            ano: '',
            preco: precoPadrao || '',
            caixa: caixaPadrao || '',
            selo: '',
            capaUrl: null,
            confianca: 'baixa',
            reconhecido: false,
            processandoItem: false,
            discogsResults: [],
            selecionado: false,
          },
        ]);
      }
    }

    setIsProcessando(false);
    setStatusProgresso('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Limpeza de lote liberando URLs blob de memória
  const limparLote = () => {
    itens.forEach((item) => {
      if (item.fotoPreview?.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(item.fotoPreview);
        } catch (_) {}
      }
    });
    setItens([]);
  };

  const todosSelecionados = itens.length > 0 && itens.every((item) => item.selecionado);

  const toggleSelecionarTudo = () => {
    const novoValor = !todosSelecionados;
    setItens((prev) => prev.map((item) => ({ ...item, selecionado: novoValor })));
  };

  const toggleItem = (id) => {
    setItens((prev) =>
      prev.map((item) => (item.id === id ? { ...item, selecionado: !item.selecionado } : item))
    );
  };

  const atualizarItem = (id, campo, valor) => {
    setItens((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [campo]: valor } : item))
    );
  };

  const removerItem = (id) => {
    setItens((prev) => {
      const itemRemovido = prev.find((item) => item.id === id);
      if (itemRemovido?.fotoPreview?.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(itemRemovido.fotoPreview);
        } catch (_) {}
      }
      return prev.filter((item) => item.id !== id);
    });
  };

  const aplicarResultadoPesquisaDiscogs = (resultado) => {
    if (!itemParaPesquisa) return;

    const itemNormalizado = parseDiscogsItem(resultado);
    if (!itemNormalizado) return;

    setItens((prev) =>
      prev.map((item) => {
        if (item.id === itemParaPesquisa.id) {
          return {
            ...item,
            artista: itemNormalizado.artista || item.artista,
            titulo: itemNormalizado.titulo || item.titulo,
            ano: itemNormalizado.ano || item.ano,
            selo: itemNormalizado.seloPrensagem || item.selo,
            capaUrl: itemNormalizado.thumb || itemNormalizado.cover || item.capaUrl,
            confianca: 'alta',
            selecionado: true,
          };
        }
        return item;
      })
    );

    setItemParaPesquisa(null);
  };

  // Salvar itens aprovados com auditoria e movimentação de entrada
  const salvarAprovados = async () => {
    const aprovados = itens.filter((item) => item.selecionado && item.titulo?.trim());
    if (aprovados.length === 0) {
      return setMensagem({ tipo: 'error', texto: 'Nenhum disco selecionado com título preenchido.' });
    }

    setIsSalvando(true);
    setProgressoSalvar({ atual: 0, total: aprovados.length });
    setMensagem(null);

    let salvosCount = 0;
    const idsSalvos = [];

    for (let i = 0; i < aprovados.length; i++) {
      setProgressoSalvar({ atual: i + 1, total: aprovados.length });
      const item = aprovados[i];

      try {
        const caixaFinal = item.caixa?.trim()
          ? normalizeCaixa(item.caixa.trim(), loja)
          : caixaPadrao
          ? normalizeCaixa(caixaPadrao, loja)
          : null;
        const precoNumerico = Number(String(item.preco || '0').replace(/\D/g, '')) || 0;

        let observacaoFinal = null;
        if (item.selo?.trim() || item.ano?.trim()) {
          const tagPrensagem = [item.selo?.trim(), item.ano?.trim()].filter(Boolean).join(' • ');
          if (tagPrensagem) observacaoFinal = `[${tagPrensagem}]`;
        }

        const payloadItem = {
          titulo: item.titulo.trim(),
          artista: item.artista?.trim() || null,
          ano: item.ano?.trim() || null,
          preco: precoNumerico,
          loja: loja || null,
          caixa: caixaFinal,
          observacao: observacaoFinal,
          ativo: true,
          capa_url: item.capaUrl || SEM_CAPA,
        };

        const payloadMovimentacao = movimentacaoService.createMovementPayload(
          tipo,
          null,
          'entrada',
          1,
          'Cadastro em lote por fotos'
        );
        await itemService.addItem(tipo, payloadItem, payloadMovimentacao);

        salvosCount++;
        idsSalvos.push(item.id);
      } catch (err) {
        console.error(`Erro ao cadastrar disco ${item.titulo}:`, err);
      }
    }

    setIsSalvando(false);
    setItens((prev) => prev.filter((item) => !idsSalvos.includes(item.id)));
    const restantes = itens.length - salvosCount;
    setSucessoFinal(
      restantes > 0
        ? `${salvosCount} disco(s) cadastrado(s) com sucesso na ${loja}! (${restantes} foto(s) pendente(s) continuam na lista).`
        : `${salvosCount} disco(s) cadastrado(s) com sucesso na ${loja}!`
    );
  };

  const totalSelecionados = itens.filter((i) => i.selecionado).length;
  const vaziosCount = itens.filter((i) => !i.titulo?.trim() && !i.artista?.trim()).length;

  return (
    <div
      className="pageContainer"
      style={{
        maxWidth: '1000px',
        margin: '0 auto',
        paddingBottom: 'calc(var(--bottom-nav-height, 62px) + 32px)',
      }}
    >
      {/* Top Header */}
      <div className="lote-fotos-top-header">
        <div className="titleGroup" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <FaCamera size={22} color="var(--accent)" />
          <h1 className="page-title" style={{ margin: 0, fontSize: '20px', letterSpacing: '-0.025em' }}>
            Cadastro por Fotos
          </h1>
        </div>
        <Link href="/" className="btn lote-fotos-back-btn">
          Voltar
        </Link>
      </div>

      {mensagem && (
        <AlertMessage message={mensagem} onClose={() => setMensagem(null)} />
      )}

      {sucessoFinal && (
        <div className="lote-fotos-success-alert">
          <MdCheckCircle size={20} />
          <span style={{ fontWeight: 600, fontSize: '13px' }}>{sucessoFinal}</span>
        </div>
      )}

      {/* Configuração Rápida do Lote */}
      <LoteConfigCard
        loja={loja}
        onLojaChange={setLoja}
        caixaPadrao={caixaPadrao}
        onCaixaPadraoChange={setCaixaPadrao}
        precoPadrao={precoPadrao}
        onPrecoPadraoChange={setPrecoPadrao}
        tipo={tipo}
        onTipoChange={setTipo}
        caixas={caixas}
      />

      {/* Área de Captura / Upload de Fotos */}
      <div
        onClick={() => !isProcessando && fileInputRef.current?.click()}
        className={`lote-fotos-dropzone ${isProcessando ? 'is-processing' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={handleFilesSelected}
          style={{ display: 'none' }}
          disabled={isProcessando}
        />
        <div className="lote-fotos-dropzone-icon">
          <FaCamera size={18} color="#ffffff" />
        </div>
        <div className="lote-fotos-dropzone-text">
          {isProcessando
            ? statusProgresso || `Processando foto ${progresso.atual} de ${progresso.total}...`
            : 'Adicionar fotos (câmera ou galeria)'}
        </div>
        {isProcessando && (
          <div className="lote-fotos-progress-track">
            <div
              className="lote-fotos-progress-bar"
              style={{ width: `${(progresso.atual / (progresso.total || 1)) * 100}%` }}
            ></div>
          </div>
        )}
      </div>

      {/* Lista de Discos Identificados */}
      {itens.length > 0 && (
        <div>
          <LoteActionsBar
            todosSelecionados={todosSelecionados}
            onToggleSelectAll={toggleSelecionarTudo}
            totalSelecionados={totalSelecionados}
            totalItens={itens.length}
            vaziosCount={vaziosCount}
            onRetryEmpty={reprocessarVazios}
            onClear={limparLote}
            onSubmit={salvarAprovados}
            isProcessando={isProcessando}
            isSalvando={isSalvando}
            progressoSalvar={progressoSalvar}
          />

          <div className="lote-fotos-list">
            {itens.map((item, idx) => (
              <LoteItemCard
                key={item.id}
                item={item}
                indice={idx}
                caixaPadrao={caixaPadrao}
                isProcessandoLote={isProcessando}
                isSalvando={isSalvando}
                onToggleSelect={toggleItem}
                onUpdateField={atualizarItem}
                onRemove={removerItem}
                onRetryItem={reprocessarItem}
                onSearchDiscogs={setItemParaPesquisa}
              />
            ))}
          </div>
        </div>
      )}

      {/* Modal de Busca Manual no Discogs */}
      <LoteDiscogsModal
        item={itemParaPesquisa}
        onClose={() => setItemParaPesquisa(null)}
        onApplyResult={aplicarResultadoPesquisaDiscogs}
      />
    </div>
  );
}
