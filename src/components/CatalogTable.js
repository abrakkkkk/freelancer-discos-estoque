import Link from 'next/link';
import { FaEdit, FaSortUp, FaSortDown, FaSort } from "react-icons/fa";
import { MdDelete } from "react-icons/md";
import { FiCheck } from "react-icons/fi";
import AlbumCover from '@/components/AlbumCover';
import { useTouchGuardTap } from '@/hooks/useTouchGuardTap';
import { getStoreBadgeColor } from '@/constants/config';

function AudioCardRow({
  d,
  isSelected,
  onToggleSelect,
  onDelete,
  activeTab,
  showLoja,
  localLabel,
  getEdicaoTag,
  getDisplayCaixa,
  itemName
}) {
  const touchProps = useTouchGuardTap(() => {
    if (onToggleSelect) onToggleSelect(d);
  });

  const edicaoTag = getEdicaoTag(d);
  const edicaoTemAno = Boolean(
    edicaoTag && (
      /\b(19\d{2}|20\d{2})\b/.test(edicaoTag) ||
      (d.ano && edicaoTag.includes(String(d.ano).trim()))
    )
  );
  const isLoja1 = d.loja === 'Loja 1';
  const meta = [edicaoTag, !edicaoTemAno && d.ano].filter(Boolean).join(' · ');
  const mostrarLoja = showLoja && d.loja;
  const corLoja = getStoreBadgeColor(d.loja);

  return (
    <tr 
      key={d.id} 
      {...touchProps}
      className={`catalog-row card-disco card-disco-loja2 ${isLoja1 ? 'card-disco-loja1' : ''} ${isSelected ? 'catalog-row-selected' : ''}`}
      style={{
        ...(d.ativo === false ? { opacity: 0.5 } : {}),
        cursor: 'pointer'
      }}
    >
      <td data-label="Selecionar" className="desktop-only cell-desktop-col" style={{ textAlign: 'center', width: '40px' }}>
        <input 
          type="checkbox" 
          checked={isSelected} 
          onChange={() => onToggleSelect && onToggleSelect(d)} 
          style={{ cursor: 'pointer', width: '18px', height: '18px', accentColor: 'var(--accent)' }} 
        />
      </td>

      <td data-label="Capa" className="cell-capa">
        <div className="catalog-cover-wrapper">
          <AlbumCover artista={d.artista} titulo={d.titulo} ano={d.ano} id={d.id} capaUrl={d.capa_url} size={70} tipo={activeTab} />
          {isSelected && (
            <div className="catalog-cover-check-badge" aria-label="Item selecionado">
              <FiCheck size={14} color="#fff" strokeWidth={3} />
            </div>
          )}
        </div>
      </td>

      {/* Informações limpas para exibição mobile */}
      <td data-label="Info" className="cell-disco-info">
        <div className="disco-header-row">
          <span className="disco-titulo">{d.titulo || <span className="text-empty">—</span>}</span>
        </div>
        {d.artista && <span className="disco-artista">{d.artista}</span>}
        {(meta || d.ativo === false) && (
          <span className="disco-meta">
            {meta && (
              <span className="disco-meta-texto">
                {edicaoTag && <span className="edicao-dot" aria-hidden="true" />}
                {meta}
              </span>
            )}
            {d.ativo === false && <span className="disco-status-inativo">Inativo</span>}
          </span>
        )}
        <div className="disco-valores-row">
          <span className="disco-valor-preco">R$ {Number(d.preco || 0).toFixed(2).replace('.', ',')}</span>
          {(d.caixa || mostrarLoja) && (
            <span className="disco-local" style={corLoja ? { '--loja-cor': corLoja } : undefined}>
              {[d.caixa && getDisplayCaixa(d), mostrarLoja && d.loja].filter(Boolean).join(' · ')}
            </span>
          )}
        </div>
      </td>

      {/* Células mantidas no DOM para compatibilidade desktop */}
      <td data-label="Local" className="desktop-only cell-desktop-col">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'flex-start' }}>
          <span>{getDisplayCaixa(d)}</span>
          {edicaoTag && (
            <span 
              className="cell-desktop-edicao disco-edicao-tag"
              title={`Edição: ${edicaoTag}`}
            >
              {edicaoTag}
            </span>
          )}
        </div>
      </td>
      <td data-label="Artista" className={`desktop-only cell-desktop-col ${!d.artista ? "empty-artist" : ""}`}>
        {d.artista || <span className="text-empty">—</span>}
      </td>
      <td data-label="Título" className="desktop-only cell-desktop-col">{d.titulo || <span className="text-empty">—</span>}</td>
      <td data-label="Ano" className="desktop-only cell-desktop-col">
        {d.ano ? (
          <span className="cell-desktop-ano">
            {d.ano}
          </span>
        ) : (
          <span className="text-empty">—</span>
        )}
      </td>
      {showLoja && (
        <td data-label="Loja" className="desktop-only cell-desktop-col">
          <span className={`cell-desktop-loja ${d.loja === 'Loja 1' ? 'loja-badge-1' : d.loja === 'Loja 2' ? 'loja-badge-2' : 'loja-badge-anexo'}`}>
            {d.loja}
          </span>
        </td>
      )}
      <td data-label="Preço" className="desktop-only cell-desktop-col cell-desktop-preco">R$ {Number(d.preco || 0).toFixed(2).replace('.', ',')}</td>
      <td data-label="Status" className="desktop-only cell-desktop-col">
        <span className={`badge ${d.ativo ? 'badge-entrada' : 'badge-estoque-superior'}`} style={{ borderRadius: 'var(--radius-xs)', padding: '4px 10px', fontSize: '12px' }}>
          {d.ativo ? 'Ativo' : 'Inativo'}
        </span>
      </td>
      <td data-label="Ação">
        <div className="actionBtnRow">
          <Link href={`/editar?id=${d.id}&tipo=${activeTab}`} title={`Editar ${itemName.slice(0, -1)}`} className="iconBtn">
            <FaEdit size={14} />
          </Link>
          <button 
            onClick={() => onDelete(d.id, d.titulo || d.artista || 'Item')} 
            title={`Excluir ${itemName.slice(0, -1)}`}
            className="iconBtn delete"
          >
            <MdDelete size={16} />
          </button>
        </div>
      </td>
    </tr>
  );
}

function StandardRow({
  d,
  isSelected,
  onToggleSelect,
  onDelete,
  activeTab,
  showLoja,
  hasCover,
  isVideo,
  getDisplayCaixa,
  itemName
}) {
  const touchProps = useTouchGuardTap(() => {
    if (onToggleSelect) onToggleSelect(d);
  });

  return (
    <tr 
      key={d.id} 
      {...touchProps}
      className={`catalog-row ${isSelected ? 'catalog-row-selected' : ''}`} 
      style={{
        ...(d.ativo === false ? { opacity: 0.5 } : {}),
        cursor: 'pointer'
      }}
    >
      <td data-label="Selecionar" className="desktop-only cell-desktop-col" style={{ textAlign: 'center', width: '40px' }}>
        <input 
          type="checkbox" 
          checked={isSelected} 
          onChange={() => onToggleSelect && onToggleSelect(d)} 
          style={{ cursor: 'pointer', width: '18px', height: '18px', accentColor: 'var(--accent)' }} 
        />
      </td>
      {hasCover && (
        <td data-label="Capa" className="cell-capa">
          <div className="catalog-cover-wrapper">
            <AlbumCover artista={d.artista} titulo={d.titulo} ano={d.ano} id={d.id} capaUrl={d.capa_url} size={44} tipo={activeTab} />
            {isSelected && (
              <div className="catalog-cover-check-badge" aria-label="Item selecionado">
                <FiCheck size={12} color="#fff" strokeWidth={3} />
              </div>
            )}
          </div>
        </td>
      )}
      <td data-label="Local">{getDisplayCaixa(d)}</td>
      {!isVideo && (
        <td data-label="Artista" className={!d.artista ? "empty-artist" : ""}>
          {d.artista || <span className="text-empty">—</span>}
        </td>
      )}
      <td data-label="Título">{d.titulo || <span className="text-empty">—</span>}</td>
      <td data-label="Ano">
        {d.ano ? (
          <span className="cell-desktop-ano">
            {d.ano}
          </span>
        ) : (
          <span className="text-empty">—</span>
        )}
      </td>
      {showLoja && (
        <td data-label="Loja">
          {d.loja ? (
            <span className={`cell-desktop-loja ${d.loja === 'Loja 1' ? 'loja-badge-1' : d.loja === 'Loja 2' ? 'loja-badge-2' : 'loja-badge-anexo'}`}>
              {d.loja}
            </span>
          ) : (
            <span className="text-empty">—</span>
          )}
        </td>
      )}
      <td data-label="Preço" className="cell-desktop-preco">R$ {Number(d.preco || 0).toFixed(2).replace('.', ',')}</td>
      <td data-label="Status">
        <span className={`badge ${d.ativo ? 'badge-entrada' : 'badge-estoque-superior'}`} style={{ borderRadius: 'var(--radius-xs)', padding: '4px 10px', fontSize: '12px' }}>
          {d.ativo ? 'Ativo' : 'Inativo'}
        </span>
      </td>
      <td data-label="Ação">
        <div className="actionBtnRow">
          <Link href={`/editar?id=${d.id}&tipo=${activeTab}`} title={`Editar ${itemName.slice(0, -1)}`} className="iconBtn">
            <FaEdit size={14} />
          </Link>
          <button 
            onClick={() => onDelete(d.id, d.titulo || d.artista || 'Item')} 
            title={`Excluir ${itemName.slice(0, -1)}`}
            className="iconBtn delete"
          >
            <MdDelete size={16} />
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function CatalogTable({ 
  itens, 
  activeTab, 
  ordenarColuna, 
  ordenarDirecao, 
  onSort, 
  onDelete,
  showLoja = true,
  localLabel = 'Localização',
  selectedIds = [],
  onToggleSelect,
  onToggleSelectAll
}) {
  const isVideo = activeTab === 'dvds' || activeTab === 'vhs';
  const itemName = activeTab === 'discos' ? 'discos' : activeTab === 'dvds' ? 'DVDs' : activeTab === 'vhs' ? 'VHS' : 'CDs';
  const hasCover = activeTab === 'discos' || activeTab === 'cds';
  const isAudioCard = activeTab === 'discos' || activeTab === 'cds';

  const renderSortIcon = (coluna) => {
    if (ordenarColuna !== coluna) {
      return <FaSort size={12} style={{ marginLeft: '6px', opacity: 0.35 }} />;
    }
    return ordenarDirecao === 'asc' 
      ? <FaSortUp size={12} style={{ marginLeft: '6px', color: 'var(--accent)' }} />
      : <FaSortDown size={12} style={{ marginLeft: '6px', color: 'var(--accent)' }} />;
  };

  const getDisplayCaixa = (d) => {
    if (!d.caixa) return <span className="text-empty">—</span>;
    const isNumeric = !isNaN(Number(d.caixa)) && String(d.caixa).trim() !== '';
    if (d.loja === 'Loja 1' && isNumeric) {
      return `Caixa ${d.caixa}`;
    }
    return d.caixa;
  };

  const getEdicaoTag = (d) => {
    if (!d || !d.observacao) return null;
    const match = d.observacao.match(/^\[([^\]]+)\]/);
    return match ? match[1] : null;
  };

  if (itens.length === 0) {
    return <div className="empty-state">Nenhum {itemName.slice(0, -1)} encontrado.</div>;
  }

  const isAllCurrentPageSelected = itens.length > 0 && itens.every(d => selectedIds.includes(d.id));

  return (
    <div className="tableContainer">
      <table className="styledTable">
        <thead>
          <tr>
            <th className="desktop-only cell-desktop-col" style={{ width: '40px', textAlign: 'center' }}>
              <input 
                type="checkbox" 
                checked={isAllCurrentPageSelected} 
                onChange={() => onToggleSelectAll && onToggleSelectAll(itens)}
                style={{ cursor: 'pointer', width: '18px', height: '18px', accentColor: 'var(--accent)' }}
                title="Selecionar todos da página atual"
              />
            </th>
            {hasCover && (
              <th style={{ width: '64px', textAlign: 'center' }}>CAPA</th>
            )}
            <th>
              <div style={{display: 'flex', alignItems: 'center', cursor: 'pointer'}} onClick={() => onSort('caixa')}>
                {localLabel.toUpperCase()} {renderSortIcon('caixa')}
              </div>
            </th>
            {!isVideo && (
              <th onClick={() => onSort('artista')} style={{cursor: 'pointer'}}>
                <div style={{display: 'flex', alignItems: 'center'}}>
                  ARTISTA {renderSortIcon('artista')}
                </div>
              </th>
            )}
            <th onClick={() => onSort('titulo')} style={{cursor: 'pointer'}}>
              <div style={{display: 'flex', alignItems: 'center'}}>
                TÍTULO {renderSortIcon('titulo')}
              </div>
            </th>
            <th onClick={() => onSort('ano')} style={{cursor: 'pointer'}}>
              <div style={{display: 'flex', alignItems: 'center'}}>
                ANO {renderSortIcon('ano')}
              </div>
            </th>
            {showLoja && (
              <th onClick={() => onSort('loja')} style={{cursor: 'pointer'}}>
                <div style={{display: 'flex', alignItems: 'center'}}>
                  LOJA {renderSortIcon('loja')}
                </div>
              </th>
            )}
            <th onClick={() => onSort('preco')} style={{cursor: 'pointer'}}>
              <div style={{display: 'flex', alignItems: 'center'}}>
                PREÇO {renderSortIcon('preco')}
              </div>
            </th>
            <th>STATUS</th>
            <th>AÇÕES</th>
          </tr>
        </thead>
        <tbody>
          {itens.map((d) => {
            const isSelected = selectedIds.includes(d.id);

            if (isAudioCard) {
              return (
                <AudioCardRow 
                  key={d.id}
                  d={d}
                  isSelected={isSelected}
                  onToggleSelect={onToggleSelect}
                  onDelete={onDelete}
                  activeTab={activeTab}
                  showLoja={showLoja}
                  localLabel={localLabel}
                  getEdicaoTag={getEdicaoTag}
                  getDisplayCaixa={getDisplayCaixa}
                  itemName={itemName}
                />
              );
            }

            return (
              <StandardRow
                key={d.id}
                d={d}
                isSelected={isSelected}
                onToggleSelect={onToggleSelect}
                onDelete={onDelete}
                activeTab={activeTab}
                showLoja={showLoja}
                hasCover={hasCover}
                isVideo={isVideo}
                getDisplayCaixa={getDisplayCaixa}
                itemName={itemName}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
