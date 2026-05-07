import { useAuth } from '../context/AuthContext';

export default function PermissionGuard({ permission, children, fallback = null }) {
  const { hasPermission } = useAuth();
  const allowed = hasPermission(permission);

  if (!allowed) {
    if (fallback === 'tooltip') {
      return (
        <div style={{ position: 'relative', display: 'inline-block' }} className="permission-tooltip-wrapper">
          <div style={{ opacity: 0.5, pointerEvents: 'none', filter: 'grayscale(0.8)' }}>
            {children}
          </div>
          <div className="permission-tooltip" style={{
            position: 'absolute', bottom: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)',
            background: 'var(--bg-elevated)', color: 'var(--text-secondary)', padding: '6px 10px',
            borderRadius: 6, fontSize: 12, whiteSpace: 'nowrap', border: '1px solid var(--border)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 100, opacity: 0, pointerEvents: 'none',
            transition: 'opacity 0.2s',
          }}>
            You don't have permission
            <div style={{
              position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
              width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent',
              borderTop: '5px solid var(--border)',
            }} />
          </div>
          <style>{`
            .permission-tooltip-wrapper:hover .permission-tooltip { opacity: 1; }
          `}</style>
        </div>
      );
    }
    return fallback;
  }

  return children;
}