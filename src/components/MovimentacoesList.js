'use client';

import React from 'react';
import { MdHistory } from 'react-icons/md';
import { formatCaixa } from '@/utils/stringUtils';
import { formatarDataHoraRelativa } from '@/utils/dateUtils';

/**
 * Extrai os dados do item associado à movimentação (suporta discos, dvds, cds e vhs)
 */
export function extrairDadosItemMovimentacao(movimentacao) {
  const item =
    movimentacao.discos ||
    movimentacao.dvds ||
    movimentacao.cds ||
    movimentacao.vhs;

  return {
    caixa: item?.caixa || '',
    artista: movimentacao.discos?.artista || movimentacao.cds?.artista || '',
    titulo:
      movimentacao.discos?.titulo ||
      movimentacao.dvds?.titulo ||
      movimentacao.cds?.titulo ||
      movimentacao.vhs?.titulo ||
      'Item sem título',
    loja: item?.loja || '',
  };
}

/**
 * Componente de listagem responsiva de movimentações (feed mobile e tabela desktop)
 */
export default function MovimentacoesList({
  itens,
  loading,
  totalItens,
  temFiltrosAtivos,
  activeStore,
}) {
  if (loading) {
    return (
      <p style={{ fontSize: '13px', color: 'var(--text-muted)', padding: '24px 0', textAlign: 'center' }}>
        Carregando movimentações...
      </p>
    );
  }

  if (totalItens === 0) {
    return (
      <div
        style={{
          padding: '40px 16px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
        }}
      >
        <MdHistory size={32} color="var(--text-muted)" style={{ opacity: 0.3 }} />
        <div style={{ fontSize: '13.5px', fontWeight: 500, color: '#e4e4e7' }}>
          Nenhuma movimentação encontrada
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          {temFiltrosAtivos
            ? 'Tente ajustar os filtros ou a busca.'
            : 'Não há registros para o período selecionado.'}
        </div>
      </div>
    );
  }

  return (
    <>
      {/* 1. Feed para dispositivos móveis (<= 768px) */}
      <div className="mov-feed-list">
        {itens.map((movimentacao) => {
          const item = extrairDadosItemMovimentacao(movimentacao);
          const ehEntrada = movimentacao.tipo === 'entrada';
          const ehSaida = movimentacao.tipo === 'saida';

          const classeStatus = ehEntrada
            ? 'mov-status-entrada'
            : ehSaida
            ? 'mov-status-saida'
            : 'mov-status-exclusao';

          const rotuloStatus = ehEntrada ? '+ Entrada' : ehSaida ? '− Saída' : '✖ Exclusão';

          const detalhes = [
            item.artista && item.artista !== '—' ? item.artista : null,
            item.caixa && item.caixa !== '—' ? formatCaixa(item.caixa, item.loja) : null,
            !activeStore && item.loja && item.loja !== '—' ? item.loja : null,
            formatarDataHoraRelativa(movimentacao.criado_em),
          ]
            .filter(Boolean)
            .join(' • ');

          return (
            <div key={movimentacao.id} className="mov-row-item">
              <div className="mov-item-content">
                <span className="mov-item-title" title={item.titulo}>
                  {item.titulo}
                </span>
                <span className="mov-item-subtitle" title={detalhes}>
                  {detalhes}
                </span>
              </div>

              <span className={`mov-item-status ${classeStatus}`}>{rotuloStatus}</span>
            </div>
          );
        })}
      </div>

      {/* 2. Tabela estruturada para Desktop (> 768px) */}
      <div className="mov-table-desktop">
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th style={{ width: '130px' }}>Tipo</th>
              <th style={{ width: '160px' }}>Local</th>
              <th style={{ width: '160px' }}>Data</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((movimentacao) => {
              const item = extrairDadosItemMovimentacao(movimentacao);
              const ehEntrada = movimentacao.tipo === 'entrada';
              const ehSaida = movimentacao.tipo === 'saida';

              const classeStatus = ehEntrada
                ? 'mov-status-entrada'
                : ehSaida
                ? 'mov-status-saida'
                : 'mov-status-exclusao';

              const rotuloStatus = ehEntrada ? '↓ Entrada' : ehSaida ? '↑ Saída' : '✖ Exclusão';

              return (
                <tr key={movimentacao.id}>
                  <td>
                    <div style={{ fontWeight: 500, color: '#ffffff', lineHeight: 1.3 }}>
                      {item.titulo}
                    </div>
                    {item.artista && item.artista !== '—' && (
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {item.artista}
                      </div>
                    )}
                  </td>
                  <td>
                    <span className={classeStatus} style={{ fontWeight: 500, fontSize: '12.5px' }}>
                      {rotuloStatus}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '12.5px' }}>
                    {formatCaixa(item.caixa, item.loja)}
                    {!activeStore && item.loja && (
                      <span style={{ marginLeft: '6px', color: 'var(--accent)', fontWeight: 500 }}>
                        ({item.loja})
                      </span>
                    )}
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '12px', whiteSpace: 'nowrap' }}>
                    {formatarDataHoraRelativa(movimentacao.criado_em)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
