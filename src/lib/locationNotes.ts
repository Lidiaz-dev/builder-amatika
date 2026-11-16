/**
 * Forces et faiblesses de chaque lieu d'intérêt, d'après les paquets actuels.
 * Hypothèses : 41,8 PO par objet, 100 PO par cristal (prix de vente), 50 % de réussite aux tests.
 * À refaire si les cartes de lieux ou le prix du cristal changent.
 */
export interface LocationNote {
  id: string
  gain: string
  risk: string
  pros: string[]
  cons: string[]
}

export const LOCATION_NOTES: LocationNote[] = [
  {
    id: 'cimetiere',
    gain: '81 PO',
    risk: '25 %',
    pros: ['Le plus rentable.', 'Très riche en objets (la moitié de sa valeur).'],
    cons: ['Les pièges les plus forts en moyenne (Force 6,2).', 'Tests uniquement de Commandement.', '4 cartes vides.'],
  },
  {
    id: 'magique',
    gain: '78 PO',
    risk: '36 %',
    pros: ['La meilleure source de cristaux (58 % de sa valeur).', 'Aucun test pour l’ouvrir.'],
    cons: ['Le plus dangereux : plus d’une carte sur trois est un piège ou un monstre, pièges jusqu’à Force 9.', 'Moins rentable que le Cimetière, pour bien plus de risque.'],
  },
  {
    id: 'ruines',
    gain: '75 PO',
    risk: '19 %',
    pros: ['Pièges faibles (Force 4) et peu de tests.', '4 cartes pour piocher dans un autre lieu au choix, dont 2 avec deux résultats au choix.'],
    cons: ['Un monstre une fois sur dix.', '4 cartes vides.'],
  },
  {
    id: 'coffre',
    gain: '73 PO',
    risk: '13 %',
    pros: ['Le plus sûr : aucun monstre, une seule carte vide.', 'Butin bien réparti entre or, objets et cristaux.'],
    cons: ['Souvent un test pour l’ouvrir (9 cartes, dont 3 avec outils de crochetage). Sans outils : 71 PO.'],
  },
  {
    id: 'ville',
    gain: '70 PO',
    risk: '15 %',
    pros: ['Très sûre : 2 monstres seulement, pièges faibles (Force 4).', 'Beaucoup d’or et d’objets.'],
    cons: ['Peu de cristaux.'],
  },
  {
    id: 'rivage',
    gain: '68 PO',
    risk: '21 %',
    pros: ['3 cartes « tirez 2 cartes ».', 'Riche en cristaux (63 % de sa valeur).'],
    cons: ['Le plus souvent vide (6 cartes).', 'Presque pas d’or, gains irréguliers.'],
  },
  {
    id: 'naturel',
    gain: '67 PO',
    risk: '19 %',
    pros: ['Pièges faibles (Force 4).', '5 cartes de tirage en plus, dont 3 dans le lieu de son choix.'],
    cons: ['Le moins rentable, pour un risque moyen.', 'Gains qui dépendent beaucoup des tirages en plus.'],
  },
]

export const LOCATION_ADVICE: [string, string][] = [
  ['Pour gagner gros', 'Cimetière. Le Magique ne vaut plus son risque, sauf pour les cristaux.'],
  ['Sans prendre de risque', 'Coffre, ou Ville sans bon testeur.'],
  ['Le bon compromis', 'Ruines.'],
]
