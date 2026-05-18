/**
 * Onboarding cinematic layout
 *
 * Provides a fixed ambient background that matches the landing page's
 * AmbientBackground system exactly. Because this layout persists across all
 * onboarding route transitions (Next.js layouts do not re-mount), the
 * atmospheric environment is continuous — the teal orbs stay in place while
 * only the page content fades and changes.
 *
 * Each onboarding page:
 *   - Does NOT set a background color on its root element (leaves it transparent)
 *   - Does NOT render its own ambient orb divs
 */
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Fixed cinematic background — persists between all onboarding pages */}
      <div
        aria-hidden
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          background: '#061316',
          pointerEvents: 'none',
          overflow: 'hidden',
        }}
      >
        {/* Primary top-left orb — matches landing AmbientBackground */}
        <div style={{
          position: 'absolute', top: '-18%', left: '-12%',
          width: '58%', height: '58%',
          background: 'radial-gradient(circle, rgba(45,212,191,0.13) 0%, transparent 70%)',
          filter: 'blur(100px)',
        }} />
        {/* Secondary bottom-right orb */}
        <div style={{
          position: 'absolute', bottom: '-18%', right: '-12%',
          width: '58%', height: '58%',
          background: 'radial-gradient(circle, rgba(103,232,249,0.11) 0%, transparent 70%)',
          filter: 'blur(100px)',
        }} />
        {/* Center atmospheric glow */}
        <div style={{
          position: 'absolute', top: '30%', left: '20%',
          width: '32%', height: '28%',
          background: 'radial-gradient(circle, rgba(45,212,191,0.055) 0%, transparent 70%)',
          filter: 'blur(60px)',
        }} />
        {/* Bottom atmospheric fade — grounds the scene */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: '48%',
          background: 'linear-gradient(to top, rgba(6,19,22,0.70) 0%, rgba(6,19,22,0.20) 60%, transparent 100%)',
        }} />
        {/* Top edge fade */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '32%',
          background: 'linear-gradient(to bottom, rgba(6,19,22,0.32) 0%, transparent 100%)',
        }} />
      </div>

      {/* Page content — rendered above the fixed background */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        {children}
      </div>
    </>
  )
}
