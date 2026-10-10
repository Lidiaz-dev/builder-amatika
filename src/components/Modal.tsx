import { useEffect, useRef, type ReactNode } from 'react'

interface Props {
  open: boolean
  title: string
  kicker?: string
  onClose: () => void
  children: ReactNode
  /** Boutons du pied de fenêtre (le bouton Fermer est ajouté si absent). */
  actions?: ReactNode
  wide?: boolean
}

/** Fenêtre modale contrôlée, au style des cartes d'unité. */
export default function Modal({ open, title, kicker, onClose, children, actions, wide }: Props) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className={`info-dialog ${wide ? 'wide' : ''}`}
      aria-label={title}
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {open && (
        <div className="info-dialog-body">
          <header className="unit-band">
            <h3>{title}</h3>
            {kicker && <span className="unit-role">{kicker}</span>}
          </header>
          <div className="unit-body">{children}</div>
          <footer className="unit-actions">
            {actions}
            <button type="button" className="btn small ghost" onClick={onClose}>Fermer</button>
          </footer>
        </div>
      )}
    </dialog>
  )
}
