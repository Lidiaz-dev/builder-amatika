import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * Infobulles simples : tout élément portant `data-tip="…"` affiche ce texte au survol
 * (ou au focus clavier), dans une bulle positionnée par-dessus la page pour ne jamais être coupée.
 */
export default function TooltipLayer() {
  const [tip, setTip] = useState<{ text: string; el: HTMLElement } | null>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const bubble = useRef<HTMLDivElement>(null)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    const target = (e: Event) => (e.target instanceof Element ? (e.target.closest('[data-tip]') as HTMLElement | null) : null)
    const show = (e: Event) => {
      const el = target(e)
      window.clearTimeout(timer.current)
      if (!el) return
      const text = el.dataset.tip
      if (!text) return
      timer.current = window.setTimeout(() => setTip({ text, el }), e.type === 'focusin' ? 0 : 350)
    }
    const hide = (e: Event) => {
      const el = target(e)
      const to = (e as MouseEvent).relatedTarget
      if (el && to instanceof Node && el.contains(to)) return
      window.clearTimeout(timer.current)
      setTip(null)
      setPos(null)
    }
    const close = () => { window.clearTimeout(timer.current); setTip(null); setPos(null) }
    document.addEventListener('mouseover', show)
    document.addEventListener('mouseout', hide)
    document.addEventListener('focusin', show)
    document.addEventListener('focusout', hide)
    document.addEventListener('pointerdown', close)
    window.addEventListener('scroll', close, true)
    return () => {
      document.removeEventListener('mouseover', show)
      document.removeEventListener('mouseout', hide)
      document.removeEventListener('focusin', show)
      document.removeEventListener('focusout', hide)
      document.removeEventListener('pointerdown', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [])

  useLayoutEffect(() => {
    if (!tip || !bubble.current) return
    const a = tip.el.getBoundingClientRect()
    const b = bubble.current.getBoundingClientRect()
    const left = Math.min(Math.max(8, a.left + a.width / 2 - b.width / 2), window.innerWidth - b.width - 8)
    const below = a.bottom + 8
    const top = below + b.height > window.innerHeight - 8 ? a.top - b.height - 8 : below
    setPos({ top, left })
  }, [tip])

  if (!tip || !tip.el.isConnected) return null
  // Dans une fenêtre modale, la bulle doit être rendue dans la modale pour passer au-dessus.
  const host = tip.el.closest('dialog[open]') ?? document.body
  return createPortal(
    <div ref={bubble} className="tip-bubble" role="tooltip" style={pos ?? { top: -9999, left: -9999 }}>
      {tip.text}
    </div>,
    host,
  )
}
