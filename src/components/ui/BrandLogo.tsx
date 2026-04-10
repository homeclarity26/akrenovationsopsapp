interface BrandLogoProps {
  variant: 'platform' | 'company'
  companyName?: string | null
  logoUrl?: string | null
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

const SIZES = {
  sm: { logo: 'w-7 h-7 text-[10px]', name: 'text-sm', sub: 'text-[10px]' },
  md: { logo: 'w-8 h-8 text-xs', name: 'text-base', sub: 'text-xs' },
  lg: { logo: 'w-10 h-10 text-sm', name: 'text-xl', sub: 'text-xs' },
}

export function BrandLogo({ variant, companyName, logoUrl, className = '', size = 'md' }: BrandLogoProps) {
  const s = SIZES[size]

  if (variant === 'company' && (companyName || logoUrl)) {
    return (
      <div className={`flex items-center gap-2.5 ${className}`}>
        {logoUrl ? (
          <img src={logoUrl} alt={companyName ?? ''} className={`${s.logo} rounded-lg object-cover`} />
        ) : (
          <div className={`${s.logo} rounded-lg bg-[var(--rust)] flex items-center justify-center`}>
            <span className="text-white font-bold tracking-wide">
              {getInitials(companyName ?? '')}
            </span>
          </div>
        )}
        <span className={`font-display text-white ${s.name} font-medium`}>
          {companyName}
        </span>
      </div>
    )
  }

  // Platform variant (default / fallback)
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div className={`${s.logo} rounded-lg bg-[var(--rust)] flex items-center justify-center`}>
        <span className="text-white font-bold tracking-wide">T</span>
      </div>
      <span className={`font-display text-white ${s.name} font-medium`}>
        Trade<span className="font-semibold">Office</span>{' '}
        <span className="text-white/70 font-normal">AI</span>
      </span>
    </div>
  )
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase()
}
