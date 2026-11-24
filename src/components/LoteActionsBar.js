'use client';

import React from 'react';
import { FaCheck, FaCheckDouble } from 'react-icons/fa6';
import { IoRefresh } from 'react-icons/io5';

/**
 * Barra de ações em massa para o lote de fotos (seleção múltipla, tentar vazios, limpar e submissão)
 */
export default function LoteActionsBar({
  todosSelecionados,
  onToggleSelectAll,
  totalSelecionados,
  totalItens,
  vaziosCount,
  onRetryEmpty,
  onClear,
  onSubmit,
  isProcessando,
  isSalvando,
  progressoSalvar,
}) {
  return (
    <div className="lote-fotos-actions-bar">
      <label className="lote-fotos-select-all-label">
        <input
          type="checkbox"
          checked={todosSelecionados}
          onChange={onToggleSelectAll}
          style={{ width: '18px', height: '18px', accentColor: 'var(--accent)', cursor: 'pointer' }}
        />
        <FaCheckDouble size={13} color="var(--accent-text)" />
        Selecionar Tudo ({totalSelecionados}/{totalItens})
      </label>

      <div className="lote-fotos-actions-tools">
        {vaziosCount > 0 && (
          <button
            type="button"
            className="btn lote-fotos-btn-vazios"
            onClick={onRetryEmpty}
            disabled={isSalvando || isProcessando}
            title="Tentar reconhecer novamente fotos que ficaram vazias"
          >
            <IoRefresh
              size={14}
              style={{ animation: isProcessando ? 'spin 1s linear infinite' : 'none' }}
            />
            Tentar Vazios ({vaziosCount})
          </button>
        )}

        <button
          type="button"
          className="btn lote-fotos-btn-secondary"
          onClick={onClear}
          disabled={isSalvando || isProcessando}
        >
          Limpar
        </button>

        <button
          type="button"
          className="btn btn-primary lote-fotos-btn-submit"
          onClick={onSubmit}
          disabled={isSalvando || totalSelecionados === 0}
        >
          {isSalvando ? (
            `Salvando (${progressoSalvar.atual}/${progressoSalvar.total})...`
          ) : (
            <>
              <FaCheck size={12} /> Cadastrar ({totalSelecionados})
            </>
          )}
        </button>
      </div>
    </div>
  );
}
