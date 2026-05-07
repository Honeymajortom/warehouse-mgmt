export default function ConfirmModal({ isOpen, title, message, confirmText, confirmVariant = 'danger', onConfirm, onCancel }) {
  if (!isOpen) return null;
  const variantColors = {
    danger: { bg: 'var(--danger)', hover: 'var(--danger-hover)' },
    primary: { bg: 'var(--accent)', hover: 'var(--accent-hover)' },
    success: { bg: 'var(--success)', hover: 'var(--success-hover)' },
  };
  const vc = variantColors[confirmVariant];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div style={{
        background: 'var(--bg-elevated)', border: '1px solid var(--border)',
        borderRadius: 16, padding: 28, width: '100%', maxWidth: 400,
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 18, color: 'var(--text-primary)' }}>{title}</h3>
        <p style={{ margin: '0 0 24px', fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{message}</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{
            padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)',
            background: 'transparent', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>Cancel</button>
          <button onClick={onConfirm} style={{
            padding: '8px 16px', borderRadius: 8, border: 'none',
            background: vc.bg, color: '#fff', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit', transition: 'opacity 0.2s',
          }} onMouseEnter={e => e.target.style.opacity = 0.9} onMouseLeave={e => e.target.style.opacity = 1}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}