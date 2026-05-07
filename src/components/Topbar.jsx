import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { RoleBadge } from './StatusBadge';

export default function Topbar({ onMenuClick }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showDropdown, setShowDropdown] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header style={{
      height: 64, background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 24px', position: 'sticky', top: 0, zIndex: 30,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <button onClick={onMenuClick} style={{
          display: 'none', background: 'none', border: 'none', fontSize: 20,
          color: 'var(--text-secondary)', cursor: 'pointer', padding: 4,
        }} className="mobile-menu-btn">☰</button>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
          Dashboard
        </h2>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <RoleBadge role={user?.role} />
        
        <div style={{ position: 'relative' }}>
          <button onClick={() => setShowDropdown(!showDropdown)} style={{
            display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none',
            cursor: 'pointer', padding: '6px 10px', borderRadius: 10,
            transition: 'background 0.2s',
          }} onMouseEnter={e => e.target.style.background = 'var(--hover-bg)'} onMouseLeave={e => e.target.style.background = 'transparent'}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 700, color: '#fff',
            }}>
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{user?.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{user?.email}</div>
            </div>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>▼</span>
          </button>

          {showDropdown && (
            <>
              <div onClick={() => setShowDropdown(false)} style={{ position: 'fixed', inset: 0, zIndex: 60 }} />
              <div style={{
                position: 'absolute', right: 0, top: 'calc(100% + 8px)',
                background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                borderRadius: 12, padding: 6, minWidth: 180, zIndex: 70,
                boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
              }}>
                <button onClick={() => { setShowDropdown(false); navigate('/profile'); }} style={{
                  width: '100%', textAlign: 'left', padding: '8px 12px', borderRadius: 8,
                  border: 'none', background: 'none', color: 'var(--text-secondary)',
                  fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
                }} onMouseEnter={e => e.target.style.background = 'var(--hover-bg)'} onMouseLeave={e => e.target.style.background = 'transparent'}>
                  👤 Profile
                </button>
                <div style={{ height: 1, background: 'var(--border)', margin: '4px 6px' }} />
                <button onClick={handleLogout} style={{
                  width: '100%', textAlign: 'left', padding: '8px 12px', borderRadius: 8,
                  border: 'none', background: 'none', color: 'var(--danger-text)',
                  fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
                }} onMouseEnter={e => e.target.style.background = 'var(--badge-red-bg)'} onMouseLeave={e => e.target.style.background = 'transparent'}>
                  🚪 Logout
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      <style>{`
        @media (max-width: 768px) {
          .mobile-menu-btn { display: block !important; }
        }
      `}</style>
    </header>
  );
}