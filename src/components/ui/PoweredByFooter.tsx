import { useCompanyProfile } from '@/hooks/useCompanyProfile'

export function PoweredByFooter() {
  const { data: company } = useCompanyProfile()

  // Hide if company explicitly turned it off
  if (company && company.powered_by_visible === false) return null

  const text = company?.powered_by_text || 'Powered by TradeOffice AI'

  return (
    <div className="w-full text-center py-2">
      <a
        href="https://tradeoffice.ai"
        target="_blank"
        rel="noopener noreferrer"
        className="text-[10px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
      >
        {text}
      </a>
    </div>
  )
}
