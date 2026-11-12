'use client';

import React from 'react';
import { FaMagnifyingGlass, FaBarcode } from 'react-icons/fa6';
import { MdDocumentScanner } from 'react-icons/md';
import { IoCamera } from 'react-icons/io5';
import { PiVinylRecord } from 'react-icons/pi';
import { extractSeloPrensagem } from '@/utils/discogsClient';

/**
 * Componente unificado para busca de edições e prensagens no Discogs com scanners integrados
 */
export default function DiscogsSearchSection({
  query,
  onQueryChange,
  onSearch,
  isSearching,
  results,
  showDropdown,
  onCloseDropdown,
  onSelectResult,
  onOpenCoverScanner,
  onOpenBarcodeScanner,
  onOpenOcrScanner,
}) {
  return (
    <div className="form-row" style={{ position: 'relative', zIndex: showDropdown ? 70 : 1 }}>
      <div className="form-group" style={{ width: '100%', marginBottom: '16px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <FaMagnifyingGlass /> Buscar no Discogs
        </label>
        
        <div className="discogs-search-row">
          <input
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onSearch();
              }
            }}
            placeholder="Ex: 6328 286, COLP 12225..."
            autoComplete="off"
          />
          <button
            type="button"
            onClick={onSearch}
            className="discogs-btn-buscar"
            disabled={isSearching}
          >
            <FaMagnifyingGlass size={13} /> {isSearching ? 'Buscando...' : 'Buscar'}
          </button>
        </div>

        <div className="discogs-scanners-row">
          {onOpenCoverScanner && (
            <button
              type="button"
              onClick={onOpenCoverScanner}
              className="discogs-scanner-chip"
              title="Reconhecer capa frontal do disco"
            >
              <IoCamera size={15} /> Capa
            </button>
          )}
          {onOpenBarcodeScanner && (
            <button
              type="button"
              onClick={onOpenBarcodeScanner}
              className="discogs-scanner-chip"
              title="Escanear código de barras (CDs e Vinis modernos)"
            >
              <FaBarcode size={14} /> Barras
            </button>
          )}
          {onOpenOcrScanner && (
            <button
              type="button"
              onClick={onOpenOcrScanner}
              className="discogs-scanner-chip"
              title="Ler código de catálogo com a câmera (ex: COLP, SMOFB, 6349)"
            >
              <MdDocumentScanner size={16} /> OCR
            </button>
          )}
        </div>

        {showDropdown && results && results.length > 0 && (
          <ul
            className="sugestoes-dropdown"
            style={{ top: '100%', left: 0, right: 0, maxHeight: '300px', overflowY: 'auto' }}
          >
            <li
              className="sugestoes-header"
              style={{
                background: 'var(--bg-card)',
                padding: '8px',
                fontSize: '12px',
                borderBottom: '1px solid var(--border)',
                textAlign: 'right',
              }}
            >
              <button
                type="button"
                onClick={onCloseDropdown}
                style={{
                  color: 'var(--text-muted)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Fechar (X)
              </button>
            </li>
            {results.map((result) => {
              const seloIdentificado = extractSeloPrensagem(result);

              return (
                <li
                  key={result.id}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onSelectResult(result);
                  }}
                  style={{
                    padding: '8px 10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    background: result.isExactMatch ? 'rgba(56, 161, 105, 0.05)' : undefined,
                    borderLeft: result.isExactMatch ? '3px solid rgba(56, 161, 105, 0.6)' : undefined,
                    cursor: 'pointer',
                  }}
                >
                  {result.thumb ? (
                    <img
                      src={result.thumb}
                      alt=""
                      style={{
                        width: '42px',
                        height: '42px',
                        objectFit: 'cover',
                        borderRadius: 'var(--radius-sm)',
                        flexShrink: 0,
                        background: '#18181b',
                        border: '1px solid var(--border)',
                      }}
                      loading="lazy"
                    />
                  ) : (
                    <div
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <PiVinylRecord size={22} color="var(--text-muted)" />
                    </div>
                  )}
                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '6px',
                      }}
                    >
                      <span
                        className="sugestoes-title"
                        style={{
                          fontWeight: '600',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {result.title}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                        {result.isExactMatch && (
                          <span className="badge-match-discogs">MATCH EXATO</span>
                        )}
                        {seloIdentificado && (
                          <span className="badge-selo-discogs">
                            {seloIdentificado.toUpperCase()}
                          </span>
                        )}
                      </div>
                    </div>
                    <span
                      className="sugestoes-meta"
                      style={{
                        fontSize: '12px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {result.year && `${result.year} • `}
                      {result.catno && `${result.catno} • `}
                      {result.country && `${result.country} • `}
                      {result.format?.join(', ')}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
