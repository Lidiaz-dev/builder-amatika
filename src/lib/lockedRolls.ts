/**
 * Tirages aléatoires faits par le site, verrouillés : une fois le dé lancé (ou la carte piochée),
 * on ne peut plus relancer pour obtenir un meilleur résultat. Conservés dans le navigateur,
 * pour tenir même en rechargeant la page.
 */
const STORE = 'amatika.locked-rolls'

type Store = Record<string, unknown>

function read(): Store {
  try {
    return JSON.parse(localStorage.getItem(STORE) ?? '{}') as Store
  } catch {
    return {}
  }
}

function write(s: Store) {
  try {
    localStorage.setItem(STORE, JSON.stringify(s))
  } catch {
    // stockage indisponible : le verrou ne tient que le temps de la page
  }
}

export function getLocked<T>(key: string): T | undefined {
  return read()[key] as T | undefined
}

export function setLocked<T>(key: string, value: T) {
  write({ ...read(), [key]: value })
}

export function clearLocked(key: string) {
  const s = read()
  delete s[key]
  write(s)
}

/** Efface tous les verrous qui commencent par `prefix` (rapport terminé, par exemple). */
export function clearLockedPrefix(prefix: string) {
  write(Object.fromEntries(Object.entries(read()).filter(([k]) => !k.startsWith(prefix))))
}
