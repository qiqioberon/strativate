'use client'

import { CheckCircle2, CircleAlert, CircleInfo, TriangleAlert, X } from 'lucide-react'
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'

export type ToastVariant = 'success' | 'error' | 'warning' | 'info'
type ToastInput = { message: string; variant?: ToastVariant; duration?: number }
type ToastItem = Required<Pick<ToastInput, 'message' | 'variant'>> & { id: number }
type ToastContextValue = { show: (toast: ToastInput) => void }

const ToastContext = createContext<ToastContextValue | null>(null)

const iconByVariant = {
  success: CheckCircle2,
  error: CircleAlert,
  warning: TriangleAlert,
  info: CircleInfo,
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(0)

  const dismiss = useCallback((id: number) => {
    setToasts(current => current.filter(toast => toast.id !== id))
  }, [])

  const show = useCallback(({ message, variant = 'info', duration = 4200 }: ToastInput) => {
    const id = ++nextId.current
    setToasts(current => [...current.slice(-2), { id, message, variant }])
    window.setTimeout(() => dismiss(id), duration)
  }, [dismiss])

  const value = useMemo(() => ({ show }), [show])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="global-toast-viewport" aria-label="Notifikasi" aria-live="polite" aria-relevant="additions">
        {toasts.map(toast => {
          const Icon = iconByVariant[toast.variant]
          return (
            <div
              className={`global-toast global-toast--${toast.variant}`}
              key={toast.id}
              role={toast.variant === 'error' ? 'alert' : 'status'}
            >
              <Icon aria-hidden="true" size={18} />
              <span>{toast.message}</span>
              <button type="button" onClick={() => dismiss(toast.id)} aria-label="Tutup notifikasi">
                <X aria-hidden="true" size={16} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used inside ToastProvider.')
  return context
}
