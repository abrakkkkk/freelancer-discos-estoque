"use client";

import { useUndo } from '@/contexts/UndoContext';
import { MdUndo, MdClose } from 'react-icons/md';
import { useEffect, useState } from 'react';

export default function UndoToast() {
  const { hasUndo, isUndoing, performUndo, clearUndo } = useUndo();
  const [visible, setVisible] = useState(hasUndo);

  if (hasUndo && !visible) {
    setVisible(true);
  }

  useEffect(() => {
    if (hasUndo) {
      const timer = setTimeout(() => {
        setVisible(false);
        setTimeout(clearUndo, 300); // clear after fade out
      }, 30000);
      return () => clearTimeout(timer);
    } else if (visible) {
      setVisible(false);
    }
  }, [hasUndo, clearUndo, visible]);

  if (!hasUndo && !visible) {
    return null;
  }

  return (
    <div 
      className={`undo-toast ${visible ? 'show' : ''}`}
      style={{
        position: 'fixed',
        bottom: '80px',
        left: '50%',
        transform: visible ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(100px)',
        opacity: visible ? 1 : 0,
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border)',
        boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
        borderRadius: 'var(--radius-lg)',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        zIndex: 9999,
        transition: 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.22s ease-out',
        width: 'max-content',
        maxWidth: '90vw'
      }}
    >
      <span style={{ fontSize: '14px', fontWeight: 500 }}>
        Ação realizada
      </span>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button 
          className="btn btn-primary" 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '6px', 
            padding: '6px 12px', 
            fontSize: '13px',
            borderRadius: 'var(--radius-sm)'
          }} 
          onClick={performUndo}
          disabled={isUndoing}
        >
          <MdUndo size={16} /> 
          {isUndoing ? "Desfazendo..." : "Desfazer"}
        </button>
        <button 
          onClick={() => {
            setVisible(false);
            setTimeout(clearUndo, 300);
          }}
          style={{ 
            background: 'none', 
            border: 'none', 
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          aria-label="Fechar"
        >
          <MdClose size={20} />
        </button>
      </div>
    </div>
  );
}
