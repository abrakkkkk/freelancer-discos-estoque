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
            border: ativo ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid transparent',
            background: ativo ? 'rgba(16, 185, 129, 0.16)' : 'transparent',
            color: ativo ? '#34d399' : 'var(--text-muted, #71717a)',
            cursor: 'pointer',
            transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
            boxShadow: ativo ? '0 1px 4px rgba(16, 185, 129, 0.2)' : 'none',
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
              background: ativo ? '#34d399' : 'rgba(255, 255, 255, 0.2)',
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
            border: !ativo ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid transparent',
            background: !ativo ? 'rgba(245, 158, 11, 0.16)' : 'transparent',
            color: !ativo ? '#fbbf24' : 'var(--text-muted, #71717a)',
            cursor: 'pointer',
            transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
            boxShadow: !ativo ? '0 1px 4px rgba(245, 158, 11, 0.2)' : 'none',
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
              background: !ativo ? '#fbbf24' : 'rgba(255, 255, 255, 0.2)',
              transition: 'background 0.18s ease',
            }}
          />
          Inativo
        </button>
      </div>
    </div>
  );
}
