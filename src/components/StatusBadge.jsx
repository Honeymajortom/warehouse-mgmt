import { ROLE_COLORS, STATUS_COLORS } from '../constants/permissions';

export function RoleBadge({ role }) {
  const style = ROLE_COLORS[role] || ROLE_COLORS.viewer;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.04em',
      background: style.bg, color: style.text, border: `1px solid ${style.border}`,
    }}>
      {role === 'admin' && '🔒'} {role === 'operator' && '⚙️'} {role === 'viewer' && '👁️'} {role}
    </span>
  );
}

export function StatusBadge({ status }) {
  const style = STATUS_COLORS[status] || STATUS_COLORS.pending;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.04em',
      background: style.bg, color: style.text, border: `1px solid ${style.border}`,
    }}>
      {status === 'approved' && '✓'} {status === 'pending' && '⏳'} {status === 'rejected' && '✕'} {status}
    </span>
  );
}