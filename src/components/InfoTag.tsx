import { useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { openDialog } from '../lib/dialog'

interface Props {
  label: string
  /** Petite mention à droite du titre de la fenêtre (arbre, type de sort…). */
  kicker?: string
  className?: string
  /** Bouton facultatif à côté de l'étiquette (ex. retirer un sort). */
  after?: ReactNode
  children: ReactNode
}

/** Étiquette cliquable qui ouvre une fenêtre de détail. */
export default function InfoTag({ label, kicker, className = '', after, children }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const close = () => dialog.current?.close()

  return (
    <>
      <span className={`tag-wrap ${after ? 'with-after' : ''}`}>
        {/* Pas un vrai bouton : il reste utilisable dans une bande verrouillée (fieldset désactivé). */}
        <span
          role="button"
          tabIndex={0}
          className={`tag info-tag ${className}`}
          onClick={() => openDialog(dialog.current)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              openDialog(dialog.current)
            }
          }}
        >
          {label}
        </span>
        {after}
      </span>
      {createPortal(
      <dialog
        ref={dialog}
        className="info-dialog"
        aria-label={label}
        // Un clic sur le fond (hors du contenu) ferme la fenêtre.
        onClick={(e) => e.target === e.currentTarget && close()}
      >
        <div className="info-dialog-body">
          <header className="unit-band">
            <h3>{label}</h3>
            {kicker && <span className="unit-role">{kicker}</span>}
          </header>
          <div className="unit-body">{children}</div>
          <footer className="unit-actions">
            <button type="button" className="btn small" onClick={close}>Fermer</button>
          </footer>
        </div>
      </dialog>,
      document.body,
      )}
    </>
  )
}
