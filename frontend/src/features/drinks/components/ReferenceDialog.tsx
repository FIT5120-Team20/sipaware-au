/**
 * Native modal boundary for reference help/delete sheets. Browser focus trapping,
 * Escape remain native; return focus explicitly when React removes the dialog.
 */
import { useEffect, useId, useRef, type ReactNode } from 'react'

export function ReferenceDialog({ title, children, onClose, alert = false, className = '', descriptionId }: {
  title: string; children: ReactNode; onClose: () => void; alert?: boolean; className?: string; descriptionId?: string
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const id = useId()

  useEffect(() => {
    const element = dialog.current
    if (!element) return

    const opener = document.activeElement
    element.showModal()
    heading.current?.focus({ preventScroll: true })
    element.scrollTop = 0

    return () => {
      if (element.open) element.close()
      // React may detach the dialog before passive cleanup. Native close then
      // cannot restore focus; only return to a surviving, visible opener.
      if (opener instanceof HTMLElement && opener.isConnected && !opener.closest('[hidden], [inert]')) {
        opener.focus({ preventScroll: true })
      }
    }
  }, [])

  return <dialog ref={dialog} className={'reference-flow-dialog' + (className ? ' ' + className : '')} aria-labelledby={id} aria-describedby={descriptionId}
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
