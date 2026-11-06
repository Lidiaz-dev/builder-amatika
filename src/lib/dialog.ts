/**
 * Ouvre une fenêtre modale en gardant le focus sur la fenêtre elle-même : sinon le navigateur
 * le place sur le premier élément focalisable (souvent un renvoi de règle, dont la bulle s'ouvre).
 */
export function openDialog(d: HTMLDialogElement | null) {
  if (!d || d.open) return
  d.tabIndex = -1
  d.showModal()
  d.focus()
}
