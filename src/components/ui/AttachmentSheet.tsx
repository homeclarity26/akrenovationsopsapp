/**
 * AttachmentSheet — role-aware bottom sheet for attachments.
 *
 * Options differ by role:
 *   - Admin:    photo, receipt, document, file
 *   - Employee: photo, receipt, photo-stocktake, file
 *   - Client:   photo, file
 *
 * Each option triggers a hidden file input with the appropriate `accept` attr.
 * Camera options use `capture="environment"` where applicable.
 */

import { useCallback, useRef } from 'react'
import { Camera, Receipt, FileText, File, Package, X } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AttachmentOption {
  id: string
  label: string
  icon: React.ReactNode
  accept: string
  /** Use camera capture. */
  capture?: 'environment' | 'user'
}

interface AttachmentSheetProps {
  onSelect: (files: FileList, optionId: string) => void
  onClose: () => void
  className?: string
}

// ---------------------------------------------------------------------------
// Option sets by role
// ---------------------------------------------------------------------------

const ADMIN_OPTIONS: AttachmentOption[] = [
  { id: 'photo', label: 'Photo', icon: <Camera size={22} />, accept: 'image/*', capture: 'environment' },
  { id: 'receipt', label: 'Receipt', icon: <Receipt size={22} />, accept: 'image/*', capture: 'environment' },
  { id: 'document', label: 'Document', icon: <FileText size={22} />, accept: '.pdf,.doc,.docx,.xls,.xlsx' },
  { id: 'file', label: 'File', icon: <File size={22} />, accept: '*/*' },
]

const EMPLOYEE_OPTIONS: AttachmentOption[] = [
  { id: 'photo', label: 'Photo', icon: <Camera size={22} />, accept: 'image/*', capture: 'environment' },
  { id: 'receipt', label: 'Receipt', icon: <Receipt size={22} />, accept: 'image/*', capture: 'environment' },
  { id: 'photo-stocktake', label: 'Stock Photo', icon: <Package size={22} />, accept: 'image/*', capture: 'environment' },
  { id: 'file', label: 'File', icon: <File size={22} />, accept: '*/*' },
]

const CLIENT_OPTIONS: AttachmentOption[] = [
  { id: 'photo', label: 'Photo', icon: <Camera size={22} />, accept: 'image/*', capture: 'environment' },
  { id: 'file', label: 'File', icon: <File size={22} />, accept: '*/*' },
]

function getOptionsForRole(role: string | undefined): AttachmentOption[] {
  switch (role) {
    case 'admin':
      return ADMIN_OPTIONS
    case 'employee':
      return EMPLOYEE_OPTIONS
    case 'client':
      return CLIENT_OPTIONS
    // platform_owner has no attachment flow — they don't interact with projects
    default:
      return CLIENT_OPTIONS
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AttachmentSheet({ onSelect, onClose, className }: AttachmentSheetProps) {
  const { user } = useAuth()
  const options = getOptionsForRole(user?.role)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const activeOptionRef = useRef<AttachmentOption | null>(null)

  const handleOptionClick = useCallback((option: AttachmentOption) => {
    activeOptionRef.current = option
    const input = fileInputRef.current
    if (!input) return
    input.accept = option.accept
    if (option.capture) {
      input.setAttribute('capture', option.capture)
    } else {
      input.removeAttribute('capture')
    }
    input.click()
  }, [])

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (files && files.length > 0 && activeOptionRef.current) {
        onSelect(files, activeOptionRef.current.id)
      }
      // Reset so re-selecting the same file fires onChange again
      e.target.value = ''
    },
    [onSelect],
  )

  return (
    <div className={cn('bg-white rounded-t-2xl shadow-xl p-4 pb-8', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-[var(--text)]">Attach</h3>
        <button
          onClick={onClose}
          className="p-2 -m-2 rounded-lg hover:bg-gray-100 min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="Close attachments"
        >
          <X size={18} className="text-[var(--text-secondary)]" />
        </button>
      </div>

      {/* Options grid */}
      <div className="grid grid-cols-4 gap-3">
        {options.map((opt) => (
          <button
            key={opt.id}
            onClick={() => handleOptionClick(opt)}
            className={cn(
              'flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl',
              'min-h-[72px] bg-gray-50 hover:bg-gray-100 transition-colors',
              'text-[var(--text-secondary)]',
            )}
          >
            {opt.icon}
            <span className="text-[10px] font-medium">{opt.label}</span>
          </button>
        ))}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  )
}
