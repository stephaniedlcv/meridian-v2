import { useLocation } from 'wouter'

const colors = {
  teal: '#2DD4BF',
  text: '#EAFBF7',
  textMuted: '#5F8E85',
  cardBg: 'rgba(232,248,245,0.055)',
  cardBorder: 'rgba(103,232,249,0.13)',
}

const fonts = {
  ui: '"Plus Jakarta Sans", sans-serif',
}

const navItems = [
  { path: '/dashboard', label: 'Home', icon: '◉' },
  { path: '/labs/upload', label: 'Labs', icon: '🧪' },
  { path: '/labs/history', label: 'History', icon: '📊' },
  { path: '/profile', label: 'Profile', icon: '◎' },
]

export default function NavBar() {
  const [pathname, navigate] = useLocation()

  return (
    <nav style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: 'rgba(6,19,22,0.95)',
      borderTop: `1px solid ${colors.cardBorder}`,
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      zIndex: 100,
      padding: '8px 0',
    }}>
      <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
        {navItems.map((item) => {
          const isActive = pathname === item.path || pathname.startsWith(item.path + '/')
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '8px 16px', fontFamily: fonts.ui, transition: 'all 0.2s ease' }}
            >
              <span style={{ fontSize: '20px', filter: isActive ? 'none' : 'grayscale(100%) opacity(0.5)' }}>{item.icon}</span>
              <span style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.05em', color: isActive ? colors.teal : colors.textMuted }}>
                {item.label}
              </span>
              {isActive && <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: colors.teal, marginTop: '-2px' }} />}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
