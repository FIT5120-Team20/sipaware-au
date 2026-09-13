/**
 * Native modal boundary for reference help/delete sheets. Browser focus trapping,
 * Escape and focus restoration remain native; no personal state is persisted.
 */
import { useEffect, useId, useRef, type ReactNode } from 'react'

export function ReferenceDialog({ title, children, onClose, alert = false }: {
  title: string; children: ReactNode; onClose: () => void; alert?: boolean
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const id = useId()

  useEffect(() => {
    const element = dialog.current
    if (!element) return

    element.showModal()
    heading.current?.focus({ preventScroll: true })
    element.scrollTop = 0

    return () => { if (element.open) element.close() }
  }, [])

  return <dialog ref={dialog} className="reference-flow-dialog" aria-labelledby={id}
    role={alert ? 'alertdialog' : 'dialog'}
    onCancel={event => { event.preventDefault(); onClose() }}
    onClick={event => { if (event.target === event.currentTarget) onClose() }}>
    <div className="reference-flow-dialog-body">
      <div className="reference-sheet-handle" aria-hidden="true" />
      <h2 ref={heading} id={id} tabIndex={-1}>{title}</h2>
      {children}
    </div>
  </dialog>
}