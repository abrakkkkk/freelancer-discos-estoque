'use client';

import React from 'react';
import { MdOutlineNotes } from 'react-icons/md';

/**
 * Componente para exibição e histórico de observações cronológicas do item
 */
export default function ItemObservacoesSection({
  tipoNome,
  observacoes,
  novaObservacao,
  onNovaObservacaoChange,
  onAdicionarObservacao,
  onExcluirObservacao,
  loading,
}) {
  return (
    <div className="form-section-card" style={{ marginTop: '24px' }}>
      <div className="form-section-header">
        <MdOutlineNotes size={18} color="var(--accent)" />
        <h3 className="form-section-title">Observações do {tipoNome}</h3>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <input
          style={{
            flex: 1,
            padding: '10px 14px',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--bg-card)',
            color: 'var(--text)',
          }}
          placeholder="Digite uma nova observação..."
          value={novaObservacao}
          onChange={(e) => onNovaObservacaoChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onAdicionarObservacao()}
        />
        <button
          className="btn btn-primary"
          onClick={onAdicionarObservacao}
          disabled={!novaObservacao.trim()}
          type="button"
        >
          Adicionar
        </button>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Carregando observações...</p>
      ) : observacoes.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>Nenhuma observação registrada.</p>
      ) : (
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th style={{ width: '180px' }}>Data</th>
                <th>Observação</th>
                <th style={{ width: '40px' }}></th>
              </tr>
            </thead>
            <tbody>
              {observacoes.map((obs) => {
                const dataFormatada = new Date(
                  obs.criado_em.endsWith('Z') ? obs.criado_em : obs.criado_em + 'Z'
                ).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

                return (
                  <tr key={obs.id}>
                    <td
                      data-label="Data"
                      style={{ color: 'var(--text-muted)', fontSize: '13px', whiteSpace: 'nowrap' }}
                    >
                      {dataFormatada}
                    </td>
                    <td data-label="Observação">{obs.observacao}</td>
                    <td data-label="Excluir" style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => onExcluirObservacao(obs)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          fontSize: '16px',
                          padding: '10px',
                        }}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
