"use client";

import { useEffect, useState } from 'react';
import { MdCheckCircle } from 'react-icons/md';

export default function SuccessModal({ isOpen, message, onClose }) {
  const [rendered, setRendered] = useState(isOpen);

  if (isOpen && !rendered) {
    setRendered(true);
  }

  useEffect(() => {
    if (!isOpen && rendered) {
      const timer = setTimeout(() => setRendered(false), 300);
      return () => clearTimeout(timer);
    }
    if (isOpen) {
      const timer = setTimeout(() => onClose(), 3500);
      return () => clearTimeout(timer);
    }
  }, [isOpen, onClose, rendered]);

  if (!isOpen && !rendered) return null;

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        opacity: isOpen ? 1 : 0,
        transition: 'opacity 0.3s ease',
      }}
      onClick={onClose}
    >
      <div 
        style={{
          background: 'var(--bg-card, #ffffff)',
          padding: '32px 40px',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
          transform: isOpen ? 'scale(1) translateY(0)' : 'scale(0.9) translateY(20px)',
          opacity: isOpen ? 1 : 0,
          transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease-out',
          maxWidth: '400px',
          textAlign: 'center',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div 
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(72, 187, 120, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#48bb78',
            marginBottom: '8px'
          }}
        >
          <MdCheckCircle size={40} />
        </div>
        
        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600', color: 'var(--text)' }}>
          Sucesso!
        </h2>
        
        <p style={{ margin: 0, fontSize: '15px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
          {message}
        </p>

        <button 
          onClick={onClose}
          className="btn btn-primary"
          style={{ marginTop: '12px', width: '100%' }}
        >
          OK
        </button>
      </div>
    </div>
  );
}
