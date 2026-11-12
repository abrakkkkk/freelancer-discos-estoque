'use client';

import { useEffect, useState } from 'react';
import { MdWarningAmber, MdDeleteOutline } from 'react-icons/md';

export default function ConfirmModal({
  isOpen,
  title = 'Confirmação',
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'danger', // 'danger' | 'warning' | 'primary'
  isSubmitting = false,
  onConfirm,
  onClose,
}) {
  const [rendered, setRendered] = useState(isOpen);

  if (isOpen && !rendered) {
    setRendered(true);
  }

  useEffect(() => {
    if (!isOpen && rendered) {
      const timer = setTimeout(() => setRendered(false), 250);
      return () => clearTimeout(timer);
    }
  }, [isOpen, rendered]);

  // Suporte a teclas de atalho: ESC para cancelar, Enter para confirmar
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter' && !isSubmitting) {
        e.preventDefault();
        onConfirm();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onConfirm, onClose]);

  if (!isOpen && !rendered) return null;

  const isDanger = variant === 'danger';
  const iconColor = isDanger ? '#e53e3e' : '#dd6b20';
  const iconBg = isDanger ? 'rgba(229, 62, 62, 0.12)' : 'rgba(221, 107, 32, 0.12)';

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        padding: '16px',
        opacity: isOpen ? 1 : 0,
        transition: 'opacity 0.25s ease',
      }}
      onClick={isSubmitting ? undefined : onClose}
    >
      <div
        style={{
          background: 'var(--bg-card, #1c1c21)',
          border: '1px solid var(--border, rgba(255, 255, 255, 0.1))',
          padding: '28px 24px',
          borderRadius: '16px',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.5)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '14px',
          transform: isOpen ? 'scale(1) translateY(0)' : 'scale(0.92) translateY(12px)',
          opacity: isOpen ? 1 : 0,
          transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          maxWidth: '420px',
          maxHeight: 'calc(100vh - 40px)',
          overflowY: 'auto',
          width: '100%',
          textAlign: 'center',
          WebkitOverflowScrolling: 'touch',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: iconBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: iconColor,
            marginBottom: '4px',
            flexShrink: 0,
          }}
        >
          {isDanger ? <MdDeleteOutline size={30} /> : <MdWarningAmber size={30} />}
        </div>

        <h2
          style={{
            margin: 0,
            fontSize: '19px',
            fontWeight: 600,
            color: 'var(--text, #ffffff)',
            letterSpacing: '-0.3px',
          }}
        >
          {title}
        </h2>

        <div
          style={{
            margin: 0,
            fontSize: '14px',
            color: 'var(--text-muted, #a1a1aa)',
            lineHeight: '1.55',
            wordBreak: 'break-word',
          }}
        >
          {message}
        </div>

        <div
          style={{
            display: 'flex',
            gap: '12px',
            width: '100%',
            marginTop: '12px',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="btn btn-secondary"
            style={{
              flex: 1,
              padding: '12px 16px',
              minHeight: '44px',
              borderRadius: '10px',
              fontSize: '15px',
              fontWeight: 500,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting ? 0.6 : 1,
              touchAction: 'manipulation',
            }}
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            style={{
              flex: 1,
              padding: '12px 16px',
              minHeight: '44px',
              borderRadius: '10px',
              fontSize: '15px',
              fontWeight: 500,
              background: isDanger ? 'var(--accent, #c53030)' : 'var(--accent-hover, #9b2c2c)',
              color: '#ffffff',
              border: 'none',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting ? 0.7 : 1,
              transition: 'background 0.2s, opacity 0.2s',
              touchAction: 'manipulation',
            }}
          >
            {isSubmitting ? 'Processando...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
