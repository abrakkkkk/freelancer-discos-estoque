'use client';

import { useEffect, useState } from 'react';
import { MdCheckCircle, MdLayers } from 'react-icons/md';

export default function ReposicaoModal({
  isOpen,
  itemSaida,
  reserva,
  totalReservas = 1,
  isRepondo = false,
  onConfirmRepor,
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

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isRepondo) {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isRepondo, onClose]);

  if (!isOpen && !rendered) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        padding: '16px',
        opacity: isOpen ? 1 : 0,
        transition: 'opacity 0.25s ease',
      }}
      onClick={isRepondo ? undefined : onClose}
    >
      <div
        style={{
          background: 'var(--bg-card, #18181b)',
          border: '1px solid rgba(245, 158, 11, 0.35)',
          padding: '24px 20px',
          borderRadius: '16px',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.6), 0 0 24px rgba(245, 158, 11, 0.08)',
          width: '100%',
          maxWidth: '440px',
          maxHeight: 'calc(100vh - 32px)',
          overflowY: 'auto',
          transform: isOpen ? 'scale(1) translateY(0)' : 'scale(0.96) translateY(8px)',
          transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'rgba(245, 158, 11, 0.15)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '22px',
              flexShrink: 0,
            }}
          >
            <MdLayers size={22} color="#f59e0b" />
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: '17px', fontWeight: 600, margin: 0, color: '#f4f4f5' }}>
              Reposição Disponível!
            </h2>
            <p style={{ fontSize: '12px', color: '#a1a1aa', margin: '2px 0 0 0' }}>
              Há cópia reserva inativa cadastrada
            </p>
          </div>
        </div>

        {/* Card do Item Reserva */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '10px',
            padding: '12px 14px',
            marginBottom: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>
                {reserva?.titulo || itemSaida?.titulo}
              </div>
              {reserva?.artista && (
                <div style={{ fontSize: '12px', color: '#a1a1aa', marginTop: '1px' }}>
                  {reserva.artista}
                </div>
              )}
            </div>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: '#f59e0b',
                background: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.28)',
                padding: '2px 8px',
                borderRadius: '6px',
                whiteSpace: 'nowrap',
              }}
            >
              {totalReservas === 1 ? '1 cópia' : `${totalReservas} cópias`}
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '12px',
              paddingTop: '6px',
              borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            <span style={{ color: '#a1a1aa' }}>
              Localização atual: <strong style={{ color: '#fff' }}>{reserva?.caixa ? `Caixa ${reserva.caixa}` : 'Sem caixa'}</strong>
              {reserva?.loja ? ` (${reserva.loja})` : ''}
            </span>
            {reserva?.preco && (
              <span style={{ fontWeight: 600, color: 'var(--price)' }}>
                R$ {Number(reserva.preco).toFixed(2).replace('.', ',')}
              </span>
            )}
          </div>
        </div>

        <p style={{ fontSize: '13px', color: '#d4d4d8', margin: '0 0 20px 0', lineHeight: 1.4 }}>
          Deseja ativar esta cópia <strong>inativa</strong> e colocá-la na{' '}
          <strong>{itemSaida?.caixa ? `Caixa ${itemSaida.caixa}` : 'mesma caixa'}</strong>?
        </p>

        {/* Botões de Ação */}
        <div style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>
          <button
            type="button"
            onClick={onConfirmRepor}
            disabled={isRepondo}
            style={{
              width: '100%',
              minHeight: '46px',
              padding: '10px 16px',
              borderRadius: '8px',
              border: 'none',
              background: '#10b981',
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: 600,
              cursor: isRepondo ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              touchAction: 'manipulation',
              opacity: isRepondo ? 0.7 : 1,
            }}
          >
            <MdCheckCircle size={18} />
            {isRepondo ? 'Repondo...' : `Repor Agora na ${itemSaida?.caixa ? `Caixa ${itemSaida.caixa}` : 'Caixa'}`}
          </button>

          <button
            type="button"
            onClick={onClose}
            disabled={isRepondo}
            style={{
              width: '100%',
              minHeight: '44px',
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              background: 'transparent',
              color: '#a1a1aa',
              fontSize: '13px',
              fontWeight: 500,
              cursor: isRepondo ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              touchAction: 'manipulation',
            }}
          >
            Apenas Concluir Saída
          </button>
        </div>
      </div>
    </div>
  );
}
