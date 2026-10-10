// Teintes de cire : vermillon, sang de bœuf, ocre, bronze, vert bouteille, sapin, ardoise, prune, lie-de-vin.
const WAX_HUES = [6, 352, 32, 22, 85, 150, 205, 285, 330]

/** Sceau de cire avec l'initiale de la faction, en attendant de vraies illustrations. */
export default function FactionSeal({ id, name, size = 44 }: { id: string; name: string; size?: number }) {
  let hash = 0
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) % 9973
  const initial = name.normalize('NFD').replace(/[̀-ͯ]/g, '')[0]?.toUpperCase() ?? '?'
  return (
    <span
      className="seal"
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: size * 0.48, ['--seal-hue' as string]: `${WAX_HUES[hash % WAX_HUES.length]}` }}
    >
      {initial}
    </span>
  )
}
