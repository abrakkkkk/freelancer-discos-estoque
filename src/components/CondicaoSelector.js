'use client';

import React from 'react';
import { IoChevronDown } from 'react-icons/io5';

export const CONDICOES = [
  { value: 'capa_pirata', label: 'Capa Pirata' },
  { value: 'capa_avariada', label: 'Capa Avariada' },
  { value: 'midia_arranhada', label: 'Mídia Arranhada' },
  { value: 'midia_avariada', label: 'Mídia Avariada' },
  { value: 'midia_incompleta', label: 'Mídia Incompleta' },
  { value: 'disco_empenado', label: 'Disco Empenado', soDiscos: true },
];

export default function CondicaoSelector({ condicoes = [], onChange, ehDisco = false }) {
  const alternar = (valor) =>
    onChange(condicoes.includes(valor) ? condicoes.filter((c) => c !== valor) : [...condicoes, valor]);

  return (
    <details
      className={`adicionar-prensagem-box prensagem-collapsible${condicoes.length ? ' has-data' : ''}`}
    >
      <summary className="prensagem-header">
        <span className="prensagem-title">Condição</span>
        <span className="prensagem-optional-label">Opcional</span>
        <IoChevronDown className="prensagem-disclosure-icon" aria-hidden="true" />
        {condicoes.length > 0 && (
          <span className="prensagem-filled-indicator">
            {condicoes.length === 1 ? '1 marcada' : `${condicoes.length} marcadas`}
          </span>
        )}
      </summary>
      <div className="prensagem-chips-row">
        {CONDICOES.filter((c) => ehDisco || !c.soDiscos).map(({ value, label }) => (
          <button
            key={value}
            type="button"
            aria-pressed={condicoes.includes(value)}
            onClick={() => alternar(value)}
            className={`adicionar-selo-btn ${condicoes.includes(value) ? 'active' : ''}`}
          >
            {label}
          </button>
        ))}
      </div>
    </details>
  );
}
