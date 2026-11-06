/**
 * Forces et faiblesses de chaque lieu d'intérêt, d'après les paquets actuels.
 * Hypothèses : 41,8 PO par objet, 137,5 PO par cristal brut (1D10 × 25), 50 % de réussite aux tests.
 * À refaire si les cartes de lieux changent beaucoup.
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
    id: 'magique',
    gain: '95 PO',
    risk: '36 %',
    pros: ['Le plus rentable, et la meilleure source de cristaux (65 % de sa valeur).', 'Aucun test pour l’ouvrir.'],
    cons: ['Le plus dangereux : plus d’une carte sur trois est un piège ou un monstre, pièges jusqu’à Force 9.', 'Presque pas d’or.'],
  },
  {
    id: 'cimetiere',
    gain: '92 PO',
    risk: '25 %',
    pros: ['Presque aussi rentable que le Magique, pour un risque bien plus bas.', 'Très riche en objets.'],
    cons: ['Les pièges les plus forts en moyenne (Force 6,2).', 'Tests uniquement de Commandement.', '4 cartes vides.'],
  },
  {
    id: 'ruines',
    gain: '84 PO',
    risk: '20 %',
    pros: ['Pièges faibles (Force 4) et peu de tests.', '4 cartes pour piocher dans un autre lieu au choix, dont 2 avec deux résultats au choix.'],
    cons: ['Un monstre presque une fois sur dix.', '4 cartes vides.'],
  },
  {
    id: 'rivage',
    gain: '83 PO',
    risk: '21 %',
    pros: ['3 cartes « tirez 2 cartes ».', 'Riche en cristaux (70 % de sa valeur).'],
    cons: ['Le plus souvent vide (6 cartes).', 'Presque pas d’or, gains irréguliers.'],
  },
  {
    id: 'coffre',
    gain: '82 PO',
    risk: '13 %',
    pros: ['Le plus sûr : aucun monstre, une seule carte vide.', 'Butin bien réparti entre or, objets et cristaux.'],
    cons: ['Souvent un test pour l’ouvrir (9 cartes, dont 3 avec outils de crochetage). Sans outils : 79 PO.'],
  },
  {
    id: 'ville',
    gain: '77 PO',
    risk: '15 %',
    pros: ['Très sûre : 2 monstres seulement, pièges faibles (Force 4).', 'Beaucoup d’or et d’objets.'],
    cons: ['Peu de cristaux, donc un gain moyen plus bas.'],
  },
  {
    id: 'naturel',
    gain: '77 PO',
    risk: '20 %',
    pros: ['Pièges faibles (Force 4).', '5 cartes de tirage en plus, dont 3 dans le lieu de son choix.'],
    cons: ['Le moins rentable, pour un risque moyen.', 'Gains qui dépendent beaucoup des tirages en plus.'],
  },
]

export const LOCATION_ADVICE: [string, string][] = [
  ['Pour gagner gros', 'Magique si on accepte le risque, sinon Cimetière.'],
  ['Sans prendre de risque', 'Coffre, ou Ville sans bon testeur.'],
  ['Le bon compromis', 'Ruines.'],
]
