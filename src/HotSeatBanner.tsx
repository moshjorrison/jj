type HotSeatBannerProps = {
  playerName: string
  onDismiss: () => void
}

export function HotSeatBanner({ playerName, onDismiss }: HotSeatBannerProps) {
  return (
    <div
      style={{
        position: 'fixed',
        top: 'max(16px, env(safe-area-inset-top))',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 90,
        background: 'rgba(15,61,34,0.95)',
        border: '1px solid rgba(251,191,36,0.5)',
        borderRadius: 12,
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
        maxWidth: 'min(420px, 92vw)',
      }}
    >
      <div style={{ color: 'white', fontSize: 14, lineHeight: 1.4 }}>
        <strong style={{ color: '#fbbf24' }}>{playerName}&apos;s turn</strong>
        <div style={{ opacity: 0.85, marginTop: 2 }}>
          Pass the device — only they should see the bottom hand.
        </div>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        style={{
          padding: '8px 14px',
          borderRadius: 8,
          border: 'none',
          background: '#fbbf24',
          color: '#0f3d22',
          fontWeight: 800,
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        Ready
      </button>
    </div>
  )
}
