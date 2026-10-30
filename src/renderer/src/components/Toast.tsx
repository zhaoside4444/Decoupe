import { useEffect } from 'react'
import { X } from 'lucide-react'

export interface ToastAction {
  label: string
  run: () => void | Promise<void>
}

export interface ToastState {
  id: number
  message: string
  action?: ToastAction
}

interface ToastProps {
  toast: ToastState
  onClose: () => void
}

export function Toast({ toast, onClose }: ToastProps) {
  useEffect(() => {
    const timer = window.setTimeout(onClose, toast.action ? 10000 : 5000)
    return () => window.clearTimeout(timer)
  }, [toast.id, toast.action, onClose])

  return (
    <div className="toast" role="status">
      <span>{toast.message}</span>
      {toast.action && (
        <button
          type="button"
          className="toast-action"
          onClick={() => {
            void toast.action?.run()
            onClose()
          }}
        >
          {toast.action.label}
        </button>
      )}
      <button type="button" className="toast-close" aria-label="Fermer" onClick={onClose}>
        <X size={13} />
      </button>
    </div>
  )
}
