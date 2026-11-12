'use client';

import { useState, useRef, useEffect } from 'react';
import { MdNotificationsNone, MdNotifications, MdCheckCircle, MdClose } from 'react-icons/md';
import { useReposicao } from '@/contexts/ReposicaoContext';

export default function ReposicaoBell({ compact = false }) {
  const { tarefas, totalPendentes, removerTarefa, executarReposicao, limparTodas } = useReposicao();
  const [isOpen, setIsOpen] = useState(false);
  const [loadingId, setLoadingId] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 12 });
  const containerRef = useRef(null);

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const updateDropdownPosition = () => {
      const anchor = containerRef.current?.getBoundingClientRect();
      if (!anchor) return;

      const viewportWidth = window.innerWidth;
      const panelWidth = Math.min(340, viewportWidth - 24);
      const isMobile = viewportWidth <= 768;
      const left = isMobile
        ? (viewportWidth - panelWidth) / 2
        : Math.min(Math.max(12, anchor.left + anchor.width / 2 - panelWidth / 2), viewportWidth - panelWidth - 12);

      setDropdownPosition({ top: anchor.bottom + 8, left });
    };

    updateDropdownPosition();
    window.addEventListener('resize', updateDropdownPosition);
    window.addEventListener('scroll', updateDropdownPosition, true);
    return () => {
      window.removeEventListener('resize', updateDropdownPosition);
      window.removeEventListener('scroll', updateDropdownPosition, true);
    };
  }, [isOpen]);

  const handleRepor = async (taskId) => {
    if (loadingId) return;
    setLoadingId(taskId);
    setFeedback(null);
    try {
      const res = await executarReposicao(taskId);
      setFeedback({
        tipo: 'success',
        texto: `"${res.titulo}" reposto com sucesso!`,
      });
      setTimeout(() => setFeedback(null), 3500);
    } catch (err) {
      console.error(err);
      setFeedback({
        tipo: 'error',
        texto: err.message || 'Falha ao repor item.',
      });
      setTimeout(() => setFeedback(null), 4000);
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      {/* Botão do Sininho */}
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        title={totalPendentes > 0 ? `${totalPendentes} reposição(ões) pendente(s)` : 'Sem reposições pendentes'}
        aria-label="Notificações de reposição"
        style={{
          position: 'relative',
          background: totalPendentes > 0 ? 'rgba(245, 158, 11, 0.12)' : 'rgba(255, 255, 255, 0.05)',
          border: totalPendentes > 0 ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid var(--border, rgba(255, 255, 255, 0.1))',
          borderRadius: 'var(--radius-sm)',
          width: compact ? '26px' : '38px',
          height: compact ? '26px' : '38px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: totalPendentes > 0 ? '#f59e0b' : 'var(--text-muted, #a1a1aa)',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          padding: 0,
          touchAction: 'manipulation',
        }}
      >
        {totalPendentes > 0 ? (
          <MdNotifications size={compact ? 15 : 21} />
        ) : (
          <MdNotificationsNone size={compact ? 15 : 21} />
        )}

        {totalPendentes > 0 && (
          <span
            style={{
              position: 'absolute',
              top: compact ? '-3px' : '-4px',
              right: compact ? '-3px' : '-4px',
              background: '#f59e0b',
              color: '#000000',
              fontSize: compact ? '9.5px' : '11px',
              fontWeight: 600,
              minWidth: compact ? '15px' : '18px',
              height: compact ? '15px' : '18px',
              padding: '0 3px',
              borderRadius: 'var(--radius-full)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.4)',
              lineHeight: 1,
            }}
          >
            {totalPendentes > 99 ? '99+' : totalPendentes}
          </span>
        )}
      </button>

      {/* Dropdown / Menu Flutuante */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            width: 'min(340px, calc(100vw - 24px))',
            boxSizing: 'border-box',
            background: 'var(--bg-card, #18181b)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: '0 16px 36px rgba(0, 0, 0, 0.5), 0 0 16px rgba(0, 0, 0, 0.3)',
            zIndex: 99999,
            overflow: 'hidden',
            animation: 'fadeIn 0.15s ease-out',
          }}
        >
          {/* Header do Dropdown */}
          <div
            style={{
              padding: '12px 14px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(255, 255, 255, 0.02)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#f4f4f5' }}>
                Reposições Pendentes
              </span>
              {totalPendentes > 0 && (
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    background: 'rgba(245, 158, 11, 0.16)',
                    color: '#f59e0b',
                    padding: '1px 6px',
                    borderRadius: 'var(--radius-xs)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                  }}
                >
                  {totalPendentes}
                </span>
              )}
            </div>

            {totalPendentes > 0 && (
              <button
                type="button"
                onClick={limparTodas}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted, #a1a1aa)',
                  fontSize: '11.5px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  padding: '2px 6px',
                  borderRadius: 'var(--radius-sm)',
                  transition: 'color 0.15s ease',
                }}
              >
                Limpar todas
              </button>
            )}
          </div>

          {/* Feedback de Ação */}
          {feedback && (
            <div
              style={{
                padding: '8px 12px',
                fontSize: '12px',
                fontWeight: 500,
                background: feedback.tipo === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                color: feedback.tipo === 'success' ? '#34d399' : '#f87171',
                borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {feedback.tipo === 'success' ? <MdCheckCircle size={15} /> : '⚠️'}
              <span>{feedback.texto}</span>
            </div>
          )}

          {/* Lista de Tarefas */}
          <div
            style={{
              maxHeight: '360px',
              overflowY: 'auto',
              padding: totalPendentes === 0 ? '24px 16px' : '8px 10px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            {totalPendentes === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted, #71717a)' }}>
                <div style={{ marginBottom: '8px', opacity: 0.6 }}>
                  <MdNotificationsNone size={36} />
                </div>
                <div style={{ fontSize: '13px', fontWeight: 500, color: '#e4e4e7', marginBottom: '4px' }}>
                  Nenhuma reposição pendente
                </div>
                <div style={{ fontSize: '11.5px', lineHeight: 1.4 }}>
                  Ao excluir itens que possuam cópia <strong>inativa</strong>, as tarefas de reposição aparecerão aqui.
                </div>
              </div>
            ) : (
              tarefas.map(t => {
                const isItemLoading = loadingId === t.id;
                return (
                  <div
                    key={t.id}
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.07)',
                      borderRadius: 'var(--radius-md)',
                      padding: '10px 12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    {/* Linha de Título e Fechar */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff', lineHeight: 1.25 }}>
                          {t.reserva?.titulo || t.itemSaida?.titulo}
                        </div>
                        {t.reserva?.artista && (
                          <div style={{ fontSize: '11.5px', color: '#a1a1aa', marginTop: '2px' }}>
                            {t.reserva.artista}
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => removerTarefa(t.id)}
                        title="Dispensar tarefa"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#71717a',
                          cursor: 'pointer',
                          padding: '2px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: 'var(--radius-sm)',
                        }}
                      >
                        <MdClose size={16} />
                      </button>
                    </div>

                    {/* Detalhes de Localização */}
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px',
                        fontSize: '11px',
                        color: '#a1a1aa',
                        background: 'rgba(0, 0, 0, 0.2)',
                        padding: '6px 8px',
                        borderRadius: 'var(--radius-sm)',
                      }}
                    >
                      <div>
                        Saída de:{' '}
                        <strong style={{ color: '#e4e4e7' }}>
                          {t.itemSaida?.caixa ? `Caixa ${t.itemSaida.caixa}` : 'Ativo'}
                        </strong>
                        {t.itemSaida?.loja ? ` (${t.itemSaida.loja})` : ''}
                      </div>
                      <div>
                        Reserva em:{' '}
                        <strong style={{ color: '#fbbf24' }}>
                          {t.reserva?.caixa ? `Caixa ${t.reserva.caixa}` : 'Inativo'}
                        </strong>
                        {t.reserva?.loja ? ` (${t.reserva.loja})` : ''}
                      </div>
                    </div>

                    {/* Botão de 1 Clique */}
                    <button
                      type="button"
                      onClick={() => handleRepor(t.id)}
                      disabled={isItemLoading}
                      style={{
                        width: '100%',
                        minHeight: '36px',
                        padding: '6px 12px',
                        borderRadius: 'var(--radius-sm)',
                        border: 'none',
                        background: '#10b981',
                        color: '#ffffff',
                        fontSize: '12.5px',
                        fontWeight: 600,
                        cursor: isItemLoading ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        touchAction: 'manipulation',
                        opacity: isItemLoading ? 0.7 : 1,
                        transition: 'background 0.15s ease',
                      }}
                    >
                      <MdCheckCircle size={16} />
                      {isItemLoading
                        ? 'Repondo...'
                        : `Repor na ${t.itemSaida?.caixa ? `Caixa ${t.itemSaida.caixa}` : 'Caixa'}`}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
