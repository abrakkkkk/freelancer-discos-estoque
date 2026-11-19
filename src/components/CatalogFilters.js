'use client';

import { useState } from 'react';
import { FiSearch, FiSliders, FiX } from 'react-icons/fi';
import { IoCamera, IoClose } from 'react-icons/io5';
import { STORE_OPTIONS } from '@/constants/config';

// Mesmas ordens da vitrine. O valor junta coluna e direção ("preco:asc").
const ORDENS = [
  { valor: 'preco:asc', label: 'Menor preço' },
  { valor: 'preco:desc', label: 'Maior preço' },
  { valor: 'artista:asc', label: 'Artista A–Z', soMusica: true },
  { valor: 'titulo:asc', label: 'Título A–Z' },
];

// Ordem escolhida clicando no topo de uma coluna da tabela (computador).
const ORDEM_DA_TABELA = {
  'caixa:asc': 'Caixa 1–99',
  'caixa:desc': 'Caixa 99–1',
  'artista:desc': 'Artista Z–A',
  'titulo:desc': 'Título Z–A',
  'ano:asc': 'Mais antigos',
  'ano:desc': 'Mais novos',
  'loja:asc': 'Loja 1–2',
  'loja:desc': 'Loja 2–1',
};

/**
 * Busca e filtros do catálogo. No celular, os filtros ficam atrás do botão "Filtros"
 * (como na vitrine); a partir de 769px aparecem sempre, em linha.
 */
export default function CatalogFilters({
  busca,
  onBuscaChange,
  onClearBusca,
  onOpenScanner,
  filtroCaixa,
  onFiltroCaixaChange,
  caixas = [],
  filtroLoja,
  onFiltroLojaChange,
  activeStore,
  mostrarAtivos,
  onMostrarAtivosChange,
  mostrarInativos,
  onMostrarInativosChange,
  ordenarColuna,
  ordenarDirecao,
  onOrdenacaoChange,
  isVideo = false,
  isDiscos = false,
  localLabel = 'Localização',
}) {
  const [aberto, setAberto] = useState(false);
  const placeholderBusca = isVideo
    ? 'Ex: O Poderoso Chefão, Matrix...'
    : 'Ex: Beatles, Abbey Road, Roberto Carlos...';

  const ordens = ORDENS.filter((o) => !(isVideo && o.soMusica));
  const valorOrdem = ordenarColuna && ordenarDirecao ? `${ordenarColuna}:${ordenarDirecao}` : '';
  const ordemDaTabela = valorOrdem && !ordens.some((o) => o.valor === valorOrdem);
  const labelOrdemTabela = ORDEM_DA_TABELA[valorOrdem] || valorOrdem;
  const labelOrdem = ordemDaTabela ? labelOrdemTabela : ordens.find((o) => o.valor === valorOrdem)?.label;

  const caixaAtiva = caixas.find((c) => String(c.caixa) === String(filtroCaixa));
  const labelCaixa = caixaAtiva?.label || filtroCaixa;
  const exibicaoMudou = !mostrarAtivos || mostrarInativos;
  const labelExibicao = mostrarAtivos && mostrarInativos ? 'Ativos e inativos' : mostrarInativos ? 'Inativos' : 'Nenhum';

  const lojaVisivel = !activeStore && filtroLoja;
  const contagem = (lojaVisivel ? 1 : 0) + (filtroCaixa ? 1 : 0) + (valorOrdem ? 1 : 0) + (exibicaoMudou ? 1 : 0);

  const limparTudo = () => {
    if (!activeStore) onFiltroLojaChange('');
    onFiltroCaixaChange('');
    onOrdenacaoChange(null, null);
    onMostrarAtivosChange(true);
    onMostrarInativosChange(false);
  };

  return (
    <div className="filterCard catalog-filters-card">
      <div
        className={`filtersRow${activeStore ? ' filtersRow-store-selected' : ''}${aberto ? ' filtersRow-aberto' : ''}`}
      >
        <div className="filterGroup" style={{ flex: '1 1 100%' }}>
          <label htmlFor="busca-catalogo">Buscar por {isVideo ? 'título' : 'artista ou título'}</label>
          <div className="search-bar-row">
            <div className="searchInputWrapper">
              <FiSearch size={18} className="searchIconLeft" />
              <input
                id="busca-catalogo"
                type="text"
                className="searchInputWithLeftIcon"
                placeholder={placeholderBusca}
                value={busca}
                onChange={(e) => onBuscaChange(e.target.value)}
              />
              {busca && (
                <button
                  type="button"
                  onClick={onClearBusca}
                  className="search-clear-btn"
                  title="Limpar busca"
                  aria-label="Limpar busca"
                >
                  <IoClose size={16} />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={onOpenScanner}
              className="catalog-camera-btn"
              title="Buscar disco por foto da capa"
              aria-label="Buscar disco por foto da capa"
            >
              <IoCamera size={20} />
            </button>
            <button
              type="button"
              className={`catalog-filtros-btn${contagem > 0 ? ' catalog-filtros-btn-ativo' : ''}`}
              aria-expanded={aberto}
              aria-controls="catalogo-filtros"
              onClick={() => setAberto((v) => !v)}
            >
              <FiSliders size={17} aria-hidden="true" />
              <span>Filtros</span>
              {contagem > 0 && (
                <span className="catalog-filtros-contagem" aria-label={`${contagem} ativos`}>
                  {contagem}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="filterGroup filterGroup-opcao" id="catalogo-filtros">
          <label htmlFor="filtro-caixa">
            <span className="rotulo-filtrar-por">Filtrar por </span>
            <span className="rotulo-nome">{localLabel.toLowerCase()}</span>
          </label>
          <select id="filtro-caixa" value={filtroCaixa} onChange={(e) => onFiltroCaixaChange(e.target.value)}>
            <option value="">Todas</option>
            {caixas.map((caixaOption) => (
              <option
                key={`${caixaOption.caixa}-${caixaOption.loja}`}
                value={caixaOption.caixa}
              >
                {caixaOption.label} {!activeStore && caixaOption.loja ? `(${caixaOption.loja})` : ''}
              </option>
            ))}
          </select>
        </div>

        {!activeStore && (
          <div className="filterGroup filterGroup-opcao">
            <label htmlFor="filtro-loja">
              <span className="rotulo-filtrar-por">Filtrar por </span>
              <span className="rotulo-nome">loja</span>
            </label>
            <select id="filtro-loja" value={filtroLoja} onChange={(e) => onFiltroLojaChange(e.target.value)}>
              <option value="">Todas</option>
              {STORE_OPTIONS.map((opcaoLoja) => (
                <option key={opcaoLoja.value} value={opcaoLoja.value}>
                  {opcaoLoja.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="filterGroup filterGroup-opcao filterGroup-ordenar">
          <label htmlFor="filtro-ordem">Ordenar</label>
          <select
            id="filtro-ordem"
            value={valorOrdem}
            onChange={(e) => {
              const [coluna, direcao] = e.target.value.split(':');
              onOrdenacaoChange(coluna || null, direcao || null);
            }}
          >
            <option value="">{isDiscos ? 'Por caixa' : 'Padrão'}</option>
            {ordens.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.label}
              </option>
            ))}
            {ordemDaTabela && <option value={valorOrdem}>{labelOrdemTabela}</option>}
          </select>
        </div>

        <div className="filterGroup filterGroup-opcao filterGroup-exibicao" style={{ flex: '0 0 auto' }}>
          <label>Exibição</label>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', height: '100%' }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                color: 'var(--text)',
                fontSize: '13px',
                fontWeight: 500,
              }}
            >
              <input
                type="checkbox"
                checked={mostrarAtivos}
                onChange={(e) => onMostrarAtivosChange(e.target.checked)}
                style={{ accentColor: 'var(--accent)' }}
              />
              Ativos
            </label>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                color: 'var(--text)',
                fontSize: '13px',
                fontWeight: 500,
              }}
            >
              <input
                type="checkbox"
                checked={mostrarInativos}
                onChange={(e) => onMostrarInativosChange(e.target.checked)}
                style={{ accentColor: 'var(--accent)' }}
              />
              Inativos
            </label>
          </div>
        </div>
      </div>

      {/* Só no celular: o que está filtrado, com o painel fechado. */}
      {contagem > 0 && (
        <div className={`catalog-filtros-ativos${aberto ? ' catalog-filtros-ativos-aberto' : ''}`}>
          {lojaVisivel && (
            <button
              type="button"
              className="catalog-filtro-chip"
              aria-label={`Remover filtro ${filtroLoja}`}
              onClick={() => onFiltroLojaChange('')}
            >
              <span>{filtroLoja}</span>
              <FiX size={13} aria-hidden="true" />
            </button>
          )}
          {filtroCaixa && (
            <button
              type="button"
              className="catalog-filtro-chip"
              aria-label={`Remover filtro ${labelCaixa}`}
              onClick={() => onFiltroCaixaChange('')}
            >
              <span>{labelCaixa}</span>
              <FiX size={13} aria-hidden="true" />
            </button>
          )}
          {valorOrdem && (
            <button
              type="button"
              className="catalog-filtro-chip"
              aria-label="Remover ordenação"
              onClick={() => onOrdenacaoChange(null, null)}
            >
              <span>{labelOrdem}</span>
              <FiX size={13} aria-hidden="true" />
            </button>
          )}
          {exibicaoMudou && (
            <button
              type="button"
              className="catalog-filtro-chip"
              aria-label="Voltar a mostrar só os ativos"
              onClick={() => {
                onMostrarAtivosChange(true);
                onMostrarInativosChange(false);
              }}
            >
              <span>{labelExibicao}</span>
              <FiX size={13} aria-hidden="true" />
            </button>
          )}
          {(contagem >= 2 || aberto) && (
            <button type="button" className="catalog-filtros-limpar" onClick={limparTudo}>
              Limpar filtros
            </button>
          )}
        </div>
      )}
    </div>
  );
}
