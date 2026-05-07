import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, requirePermission }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Loading...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;

  // Status checks
  if (user.status === 'pending') return <Navigate to="/pending-approval" replace />;
  if (user.status === 'rejected') return <Navigate to="/access-denied" replace />;

  // Permission check
  if (requirePermission) {
    const hasPerm = user.role === 'admin' || user.permissions?.includes(requirePermission) || user.permissions?.includes('*');
    if (!hasPerm) return <Navigate to="/dashboard" replace />;
  }

  return children;
}