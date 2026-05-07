// src/components/PermissionMatrix.jsx
import { useState, useMemo } from 'react';
import { MODULES, ACTIONS } from '../constants/permissions';

export default function PermissionMatrix({ user, onSave, onCancel }) {
  const [perms, setPerms] = useState(() => {
    if (user.permissions?.includes('*')) {
      return MODULES.flatMap(m => ACTIONS.map(a => `${m.key}:${a}`));
    }
    return user.permissions || [];
  });
  const [activeModule, setActiveModule] = useState(MODULES[0].key);

  const togglePerm = (perm) => {
    setPerms(prev => prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]);
  };

  const toggleModule = (modKey, checked) => {
    const modulePerms = ACTIONS.map(a => `${modKey}:${a}`);
    if (checked) {
      setPerms(prev => [...new Set([...prev, ...modulePerms])]);
    } else {
      setPerms(prev => prev.filter(p => !modulePerms.includes(p)));
    }
  };

  const isModuleChecked = (modKey) => ACTIONS.every(a => perms.includes(`${modKey}:${a}`));
  const isModuleIndeterminate = (modKey) => {
    const hasSome = ACTIONS.some(a => perms.includes(`${modKey}:${a}`));
    return hasSome && !isModuleChecked(modKey);
  };

  const grouped = useMemo(() => {
    const g = {};
    MODULES.forEach(m => {
      g[m.key] = ACTIONS.filter(a => perms.includes(`${m.key}:${a}`));
    });
    return g;
  }, [perms]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div style={{
        background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 20,
        width: '100%', maxWidth: 720, maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        {/* Header */}
        <div style={{ padding: '24px 28px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <h3 style={{ margin: 0, fontSize: 18, color: 'var(--text-primary)' }}>Assign Permissions</h3>
            <button onClick={onCancel} style={{ background: 'none', border: 'none', fontSize: 20, color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}>✕</button>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
            Configuring access for <strong style={{ color: 'var(--text-primary)' }}>{user.name}</strong> ({user.email})
          </p>
        </div>

        {/* Content */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 400 }}>
          {/* Module List */}
          <div style={{ width: 200, borderRight: '1px solid var(--border)', overflowY: 'auto', padding: '12px 8px' }}>
            {MODULES.map(mod => {
              const count = grouped[mod.key]?.length || 0;
              const active = activeModule === mod.key;
              return (
                <button key={mod.key} onClick={() => setActiveModule(mod.key)} style={{
                  width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 10, marginBottom: 4,
                  border: 'none', background: active ? 'var(--accent-bg)' : 'transparent', cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <span style={{ fontSize: 16 }}>{mod.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: active ? 700 : 600, color: active ? 'var(--accent-text)' : 'var(--text-primary)' }}>{mod.label}</div>
                    {count > 0 && (
                      <div style={{ fontSize: 10, color: active ? 'var(--accent-text)' : 'var(--text-muted)', marginTop: 2 }}>
                        {count} permission{count !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Actions Grid */}
          <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
            {MODULES.filter(m => m.key === activeModule).map(mod => (
              <div key={mod.key}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 24 }}>{mod.icon}</span>
                    <div>
                      <h4 style={{ margin: 0, fontSize: 16, color: 'var(--text-primary)' }}>{mod.label}</h4>
                      <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>Manage access levels for this module</p>
                    </div>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', userSelect: 'none' }}>
                    <input
                      type="checkbox"
                      checked={isModuleChecked(mod.key)}
                      ref={el => { if (el) el.indeterminate = isModuleIndeterminate(mod.key); }}
                      onChange={e => toggleModule(mod.key, e.target.checked)}
                      style={{ width: 16, height: 16, accentColor: 'var(--accent)', cursor: 'pointer' }}
                    />
                    Grant All
                  </label>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
                  {ACTIONS.map(action => {
                    const permKey = `${mod.key}:${action}`;
                    const checked = perms.includes(permKey);
                    return (
                      <label key={action} style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px',
                        background: checked ? 'var(--accent-bg)' : 'var(--bg-base)',
                        border: `1px solid ${checked ? 'var(--accent-br)' : 'var(--border)'}`,
                        borderRadius: 12, cursor: 'pointer', transition: 'all 0.2s', userSelect: 'none',
                      }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => togglePerm(permKey)}
                          style={{ width: 18, height: 18, accentColor: 'var(--accent)', cursor: 'pointer', flexShrink: 0 }}
                        />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: checked ? 'var(--accent-text)' : 'var(--text-primary)', textTransform: 'capitalize' }}>
                            {action}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, textTransform: 'lowercase' }}>
                            {mod.key}:{action}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>

                {/* Visual summary */}
                <div style={{ marginTop: 24, padding: 16, background: 'var(--bg-base)', borderRadius: 12, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>Active Permissions</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {ACTIONS.filter(a => perms.includes(`${mod.key}:${a}`)).map(a => (
                      <span key={a} style={{
                        padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                        background: 'var(--accent-bg)', color: 'var(--accent-text)', border: '1px solid var(--accent-br)', textTransform: 'capitalize',
                      }}>
                        {a}
                      </span>
                    ))}
                    {!ACTIONS.some(a => perms.includes(`${mod.key}:${a}`)) && (
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No permissions granted for this module.</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 28px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {perms.length} total permission{perms.length !== 1 ? 's' : ''} selected
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onCancel} style={{
              padding: '9px 18px', borderRadius: 10, border: '1px solid var(--border)',
              background: 'transparent', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>Cancel</button>
            <button onClick={() => onSave(perms)} style={{
              padding: '9px 18px', borderRadius: 10, border: 'none',
              background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            }}>
              Update Permissions
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}