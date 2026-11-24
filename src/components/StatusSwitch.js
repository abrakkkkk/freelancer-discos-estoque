'use client';

/**
 * StatusSwitch - Alternador moderno e compacto entre Ativo e Inativo
 * 
 * @param {boolean} ativo - Estado atual (true = Ativo, false = Inativo)
 * @param {function} onChange - Callback (novoAtivo: boolean) => void
 * @param {string} label - Rótulo opcional para o campo
 */
export default function StatusSwitch({ ativo = true, onChange, label = "Status" }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {label && (
        <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-muted, #a1a1aa)' }}>
          {label}
        </label>
      )}
      <div
        role="group"
        aria-label={label}
        style={{
          display: 'inline-flex',
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 'var(--radius-sm)',
          padding: '3px',
          width: 'fit-content',
          position: 'relative',
          userSelect: 'none',
          boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.2)',
        }}
      >
        <button
          type="button"
          onClick={() => onChange?.(true)}
          style={{
            padding: '6px 16px',
            fontSize: '12.5px',
            fontWeight: ativo ? 600 : 500,
            borderRadius: 'var(--radius-xs)',
            border: ativo ? '1px solid var(--success-border)' : '1px solid transparent',
            background: ativo ? 'var(--success-bg)' : 'transparent',
            color: ativo ? 'var(--success)' : 'var(--text-muted)',
            cursor: 'pointer',
            transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            touchAction: 'manipulation',
          }}
        >
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: ativo ? 'var(--success)' : '#3f3f46',
              transition: 'background 0.18s ease',
            }}
          />
          Ativo
        </button>

        <button
          type="button"
          onClick={() => onChange?.(false)}
          style={{
            padding: '6px 16px',
            fontSize: '12.5px',
            fontWeight: !ativo ? 600 : 500,
            borderRadius: 'var(--radius-xs)',
            border: !ativo ? '1px solid var(--warning-border)' : '1px solid transparent',
            background: !ativo ? 'var(--warning-bg)' : 'transparent',
            color: !ativo ? 'var(--warning)' : 'var(--text-muted)',
            cursor: 'pointer',
            transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            touchAction: 'manipulation',
          }}
        >
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: !ativo ? 'var(--warning)' : '#3f3f46',
              transition: 'background 0.18s ease',
            }}
          />
          Inativo
        </button>
      </div>
    </div>
  );
}
