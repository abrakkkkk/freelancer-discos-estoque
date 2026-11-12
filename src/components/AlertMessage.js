import { IoClose } from 'react-icons/io5';

export default function AlertMessage({ message, type = 'error', onClose }) {
  if (!message) return null;
  
  // Accept either an object { tipo: 'error', texto: '...' } or string
  const alertType = message.tipo || type;
  const alertText = message.texto || message;

  return (
    <div 
      className={`alert alert-${alertType}`}
      style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        gap: '12px',
        animation: 'fadeIn 0.2s ease-out'
      }}
    >
      <span style={{ flex: 1 }}>{alertText}</span>
      {onClose && (
        <button
          onClick={onClose}
          type="button"
          aria-label="Fechar aviso"
          style={{
            background: 'none',
            border: 'none',
            color: 'inherit',
            cursor: 'pointer',
            padding: '4px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 'var(--radius-md)',
            opacity: 0.8,
            transition: 'opacity 0.15s'
          }}
        >
          <IoClose size={18} />
        </button>
      )}
    </div>
  );
}

