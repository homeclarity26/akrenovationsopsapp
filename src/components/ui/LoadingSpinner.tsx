export function LoadingSpinner() {
  return (
    <div
      className="min-h-[50vh] flex items-center justify-center"
      style={{ background: 'var(--bg)' }}
    >
      <div
        className="w-8 h-8 rounded-full border-2 animate-spin"
        style={{
          borderColor: 'var(--border)',
          borderTopColor: 'var(--rust)',
        }}
      />
    </div>
  )
}
