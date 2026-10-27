import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

const IMAGE = `${import.meta.env.BASE_URL}img/accueil-02.jpg`

/** Carte d'accueil affichée à l'ouverture d'une bande. */
export default function CrewWelcome({ name, onClose }: { name: string; onClose: () => void }) {
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div className="crew-welcome" role="dialog" aria-label={name} onClick={onClose}>
      {missing ? <span className="crew-welcome-fallback">❦</span> : <img src={IMAGE} alt="" onError={() => setMissing(true)} />}
      <p>{name} vous salue.</p>
    </div>,
    document.body,
  )
}
