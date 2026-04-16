import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useCompanyProfile } from '@/hooks/useCompanyProfile'

interface BrandTheme {
  primary: string
  accent: string
  bg: string
}

const DEFAULTS: BrandTheme = {
  primary: '#1e3a5f',
  accent: '#c45a3c',
  bg: '#faf8f5',
}

interface ThemeContextValue {
  brand: BrandTheme
}

const ThemeContext = createContext<ThemeContextValue>({ brand: DEFAULTS })

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { data: company } = useCompanyProfile()
  const [brand, setBrand] = useState<BrandTheme>(DEFAULTS)

  useEffect(() => {
    const next: BrandTheme = {
      primary: company?.brand_color_primary ?? DEFAULTS.primary,
      accent: company?.brand_color_accent ?? DEFAULTS.accent,
      bg: company?.brand_color_bg ?? DEFAULTS.bg,
    }
    setBrand(next)

    const root = document.documentElement
    root.style.setProperty('--navy', next.primary)
    root.style.setProperty('--rust', next.accent)
    root.style.setProperty('--bg', next.bg)
    root.style.setProperty('--cream', next.bg)
  }, [company?.brand_color_primary, company?.brand_color_accent, company?.brand_color_bg])

  // Favicon
  useEffect(() => {
    if (!company?.brand_favicon_url) return
    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']")
    if (!link) {
      link = document.createElement('link')
      link.rel = 'icon'
      document.head.appendChild(link)
    }
    // Validate favicon URL — only allow http(s) to prevent javascript: / data: injection
    try {
      const parsed = new URL(company.brand_favicon_url)
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return
    } catch {
      return // malformed URL — skip
    }
    link.href = company.brand_favicon_url
  }, [company?.brand_favicon_url])

  return (
    <ThemeContext.Provider value={{ brand }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
