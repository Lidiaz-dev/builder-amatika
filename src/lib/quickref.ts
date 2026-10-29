/**
 * Aide-mémoire : les chiffres et les étapes qu'on cherche le plus souvent en partie,
 * condensés depuis le livre de règles (sans rien y ajouter).
 * Partagé entre la page du Compendium et le PDF : `**gras**` et `[texte](/chemin)` sont reconnus.
 */
export type QuickItem = string | { text: string; sub: string[] }

export type QuickPart =
  | { kind: 'list'; items: QuickItem[]; ordered?: boolean }
  | { kind: 'note'; text: string }
  /** Petit tableau en lignes : la première cellule de chaque ligne est un en-tête. */
  | { kind: 'grid'; caption?: string; rows: string[][] }
  /** Tableaux « valeur : effet », côte à côte quand la place le permet. */
  | { kind: 'mods'; tables: { caption: string; rows: [string, string][] }[] }
  | { kind: 'defs'; rows: [string, string][] }
  | { kind: 'wound' }

export interface QuickBlock {
  title: string
  /** Sur toute la largeur ; les autres blocs vont par deux, dans l'ordre. */
  wide?: boolean
  parts: QuickPart[]
}

/** Les blocs sont regroupés dans l'ordre d'une partie : on lit de gauche à droite, puis de haut en bas. */
export interface QuickSection {
  title: string
  blocks: QuickBlock[]
}

const BLOCKS: QuickBlock[] = [
  {
    title: 'Mise en place',
    wide: true,
    parts: [
      {
        kind: 'list',
        items: [
          'Un point de déploiement par joueur sur les bords, à égale distance de ses voisins, et au moins un point au centre pour les créatures ([schémas](/regles/deploiement)).',
          "**Lieux d'intérêt** : joueurs + 1, à plus de 8 ps les uns des autres. Le joueur avec le moins de prestige place le premier, puis chacun, de la plus grande valeur d'Éclaireur à la plus faible.",
          '**Cristaux bruts** : 3 par joueur, en quadrillage, puis dispersés de 1D10 cm.',
          '**Initiative** : 1D10 + bonus Éclaireur. Du plus haut au plus bas, chacun choisit un point du bord et déploie à 6 ps du point.',
          '10 figurines maximum par bande sur la table.',
        ],
      },
    ],
  },
  {
    title: 'Le round',
    parts: [
      {
        kind: 'list',
        ordered: true,
        items: [
          {
            text: '**Début de round** :',
            sub: [
              'test de déroute pour les bandes avec 25 % ou plus de figurines hors de combat ;',
              'déroute volontaire possible à partir du round 4 ;',
              'arrivée des créatures (voir « Arrivée des créatures »).',
            ],
          },
          "**Activations** : on tire un jeton dans le sac, son joueur active une figurine qui n'a pas encore joué. 3 actions, puis on pose le jeton à côté d'elle.",
          '**Fin de round** : chacun récupère ses jetons, les créatures s\'activent, puis test du coucher de soleil.',
        ],
      },
      {
        kind: 'grid',
        caption: "Coucher de soleil : 1D10 + 2 × round, la partie s'arrête sur 18 ou plus",
        rows: [
          ['Round', '1-3', '4', '5', '6', '7', '8', '9'],
          ['Fin sur', '—', '10', '8+', '6+', '4+', '2+', 'auto'],
        ],
      },
    ],
  },
  {
    title: 'Arrivée des créatures',
    parts: [
      {
        kind: 'list',
        items: [
          '**Fin du round 1** : 1 créature sur un point central.',
          '**Rounds suivants**, avant les joueurs : le dernier joueur à avoir activé une figurine tire 1 carte Créature par tranche de 2 bandes encore en jeu (minimum 1).',
        ],
      },
      {
        kind: 'grid',
        rows: [
          ['Bandes en jeu', '1-3', '4-5', '6-7', '…'],
          ['Créatures', '1', '2', '3', '…'],
        ],
      },
      {
        kind: 'list',
        items: [
          "Point d'arrivée tiré au hasard parmi les points de déploiement des joueurs et du centre. On relance si une créature est déjà arrivée à ce point ce round-ci.",
          'Mise hors de combat : le prestige de la carte va à la bande. Les PO, cristaux et objets vont à la figurine qui la fouille.',
        ],
      },
    ],
  },
  {
    title: "Activation d'une créature",
    wide: true,
    parts: [
      { kind: 'note', text: "Dans l'ordre de menace décroissant (1D10 en cas d'égalité). 3 actions, chacune selon cette logique :" },
      {
        kind: 'list',
        ordered: true,
        items: [
          'Engagée au corps à corps ? → elle **attaque** les figurines au contact (attaques réparties équitablement).',
          'Sinon, arme de tir ou magie, et une cible en vue et à portée ? → elle **tire** ou lance son sort.',
          "Sinon → elle **se déplace** de tout son mouvement vers l'ennemi visible le plus proche, au contact si possible.",
        ],
      },
    ],
  },
  {
    title: 'Tour de joueur',
    parts: [
      {
        kind: 'list',
        items: [
          "**Figurine en fuite** (jeton à côté d'elle) : test de commandement avant tout. Réussi → elle se reprend mais perd 1 action. Raté → elle fuit de 3 × son mouvement vers le bord le plus proche et le tour s'arrête.",
          "Sinon, 3 actions au choix, dans n'importe quel ordre, répétables.",
          '**Recharger gratuit** : au début de chaque tour, une arme à rechargement si la figurine n\'est ni au corps à corps ni hors de combat.',
        ],
      },
    ],
  },
  {
    title: 'Les actions',
    wide: true,
    parts: [
      {
        kind: 'defs',
        rows: [
          ['Se déplacer', "Jusqu'à son mouvement, jamais au contact d'un ennemi debout. Un ennemi frôlé à 1 ps peut faire une mise au contact, qu'on évite avec un test d'Agilité réussi."],
          ['Charger', "Un mouvement jusqu'au contact d'un ennemi debout, puis une attaque gratuite. La cible ne peut pas faire de mise au contact."],
          ['Attaquer', 'Contre un ennemi au contact, sans riposte. Répartir ses attaques avant de lancer les dés.'],
          ['Tirer', "Impossible au corps à corps, ou après un test d'Agilité raté pendant l'activation. Cible obligatoire : l'ennemi visible le plus proche s'il est à 12 ps ou moins (sauf depuis 2 ps de hauteur)."],
          ['Viser', "+2 pour toucher si l'action suivante est un tir."],
          ['Recharger', 'Recharge une arme à rechargement (arbalète, poudre noire).'],
          ['Fouiller', "Un corps au contact (ennemi au sol, ou mort de n'importe quel camp). L'équipement va dans le sac. Impossible si un ennemi libre de Force égale ou supérieure est à 5 ps ou moins, sauf si un allié est plus proche de lui."],
          ['Ramasser', "Un cristal brut, ou un lieu d'intérêt : on tire une carte du paquet correspondant. Même restriction que pour fouiller."],
          ['Se cacher', "Dernière action seulement, aucun ennemi visible à 5 ps. Test d'Agilité : réussi → pion caché, intouchable ; raté → le tour s'arrête."],
          ['Rester caché', "Si la figurine commence cachée et qu'aucun ennemi n'est à 5 ps : automatique, le tour s'arrête."],
          ['Se révéler', "Première action d'une figurine cachée. On la place à 3 ps du pion, à plus de 1 ps de tout ennemi debout."],
          ['Se désengager', "Un mouvement normal (sans escalade) en ignorant les ennemis au contact. Test d'Agilité raté → chaque ennemi au contact a une attaque gratuite."],
          ['Lancer un sort', 'Mage seulement, pas au corps à corps. Chaque sort une seule fois par activation.'],
          ['Dissiper', 'Mot clé Dissipation. Un sort « reste en jeu », une fois par activation.'],
          ['Canaliser', "Mage ou Dissipation : l'action suivante (lancer ou dissiper) se fait à 3D10, en gardant les 2 de son choix."],
          ['Utiliser un objet', 'Un objet du sac (fiole, poison sur une arme). Pas de potion au corps à corps.'],
        ],
      },
    ],
  },
  {
    title: 'Résoudre une attaque',
    parts: [
      {
        kind: 'list',
        ordered: true,
        items: [
          '**Toucher** : 1D10 ≥ Tir (à distance) ou Combat (au corps à corps). 1 naturel = raté, 10 naturel = touché.',
          "**Blesser** : Force (de l'arme au tir, de l'attaquant au corps à corps) contre Endurance, voir le tableau.",
          '**Sauvegarde** : 1D10 ≥ armure, moins le malus dû à la Force.',
          '**Dégâts** : −1 PV. Au dernier PV, on tire une carte Blessure.',
        ],
      },
    ],
  },
  {
    title: 'Modificateurs pour toucher',
    parts: [
      {
        kind: 'mods',
        tables: [
          {
            caption: 'Au tir',
            rows: [
              ['+1', 'Bout portant (5 ps ou moins)'],
              ['+2', 'Viser juste avant'],
              ['+1 / +2', 'Grande / Très grande cible'],
              ['+1', 'Tirer vers le bas (3 ps ou plus)'],
              ['+1', 'Dans un corps à corps de 3 figurines ou plus'],
              ['−1', 'Couvert'],
              ['−1', 'Longue portée (plus de la moitié)'],
              ['−1', 'Par tir déjà fait ce tour'],
              ['−1', 'Petite cible'],
              ['−1', 'Camouflage'],
              ['−1', 'Tirer vers le haut (3 ps ou plus)'],
            ],
          },
          {
            caption: 'Au corps à corps',
            rows: [
              ['−1', 'Par ennemi au contact en plus de la cible'],
              ['−1', 'Par équipement Encombrant'],
              ['−1', 'La cible a Parade'],
              ['−1', "Par attaque déjà faite pendant l'activation"],
            ],
          },
        ],
      },
      { kind: 'note', text: 'Tir dans une mêlée sans allié : on lance un dé pour savoir quelle figurine est touchée.' },
    ],
  },
  { title: 'Blesser', parts: [{ kind: 'wound' }] },
  {
    title: "Sauvegarde d'armure",
    parts: [
      { kind: 'note', text: "Armure de base 11+, diminuée par l'équipement : armure légère et bouclier → 7+." },
      {
        kind: 'mods',
        tables: [
          {
            caption: 'Équipement',
            rows: [
              ['+1', 'Armure de cuir'],
              ['+2', 'Armure légère'],
              ['+3', 'Armure lourde'],
              ['+4', 'Armure complète'],
              ['+2', 'Bouclier'],
              ['+1', 'Casque'],
            ],
          },
          {
            caption: 'Malus selon la Force',
            rows: [
              ['1-4', 'aucun'],
              ['5', '−1'],
              ['6', '−2'],
              ['7', '−3'],
              ['8', '−4'],
              ['9', '−5'],
              ['10', '−6'],
            ],
          },
        ],
      },
    ],
  },
  {
    title: 'Tests',
    parts: [
      {
        kind: 'list',
        items: [
          '**Caractéristique** (Agilité, Force…) : 1D10 ≤ la caractéristique. 10 = réussite, 1 = échec. Force brute, sans le bonus des armes.',
          '**Commandement** : 2D10 ≥ Commandement. 20 = réussite, 2 = échec.',
          '**Chef** : une figurine à 6 ps ou moins utilise le Commandement du chef (sans ligne de vue), sauf si le chef est mort ou en fuite.',
        ],
      },
    ],
  },
  {
    title: 'Moral et peur',
    parts: [
      {
        kind: 'list',
        items: [
          '**Déroute** : en début de round, si 25 % ou plus de la bande est hors de combat. Commandement le plus élevé de la bande, −1 par figurine hors de combat. Raté → la bande quitte la table avec son butin, et il faut refaire le test à chaque round.',
          '**Peur** : un mouvement qui finit à 5 ps ou moins d\'une figurine qui fait peur, et en vue, demande un test de commandement (un seul par activation). Pareil si la figurine commence son activation à moins de 5 ps. Raté → jeton fuite, ses actions restantes servent à s\'éloigner.',
          "Une figurine qui fait peur, après chacun de ses mouvements, fait tester les ennemis à 5 ps. Ceux qui ratent fuient de leur mouvement à l'opposé. Elle est elle-même immunisée.",
        ],
      },
    ],
  },
  {
    title: 'Magie',
    wide: true,
    parts: [
      {
        kind: 'list',
        items: [
          '**Lancer** : 2D10 ≥ valeur du sort. +1 par niveau de magie, −1 par sort « reste en jeu » déjà maintenu, −1 par invocation contrôlée.',
          "**Fiasco** : sur un double, le lanceur subit une touche de Force égale à la valeur du dé (double 6 → Force 6), après l'effet du sort.",
          '**Dissiper** : 2D10 ≥ valeur du sort, mêmes modificateurs.',
          "**Projectile** : vise l'ennemi le plus proche (sauf en hauteur). **Éphémère** : effet immédiat. **Reste en jeu** : seul type dissipable ; le lanceur l'annule quand il veut, sans action.",
          '**Invocation** : placée à 6 ps du mage, 2 actions, ne ramasse ni ne fouille, retirée à son dernier PV, sans carte Blessure.',
        ],
      },
    ],
  },
  {
    title: 'Terrain et mouvement',
    parts: [
      {
        kind: 'list',
        items: [
          '**Difficile** : mouvement divisé par 2. **Dangereux** : touche de Force 5 à la fin du mouvement. **Infranchissable** : impossible.',
          "**Escalade** : au-delà de 1 ps, et pas plus haut que son mouvement. Test d'Agilité ; raté → l'action s'arrête et touche de Force 4 sans sauvegarde.",
          '**Sauter** en bas : 5 ps maximum, sans jet, la chute ne compte pas dans le mouvement. Un trou de 1 ps se franchit sans jet.',
        ],
      },
    ],
  },
]

const block = (title: string) => BLOCKS.find((b) => b.title === title)!

export const QUICK_REF: QuickSection[] = [
  { title: 'Avant la partie', blocks: [block('Mise en place')] },
  { title: 'Le round', blocks: [block('Le round'), block('Arrivée des créatures'), block("Activation d'une créature")] },
  { title: 'Activer une figurine', blocks: [block('Tour de joueur'), block('Terrain et mouvement'), block('Les actions')] },
  { title: 'Combat', blocks: [block('Résoudre une attaque'), block('Modificateurs pour toucher'), block('Blesser'), block("Sauvegarde d'armure")] },
  { title: 'Tests, moral et magie', blocks: [block('Tests'), block('Moral et peur'), block('Magie')] },
]

/** Résultat à obtenir sur 1D10 pour blesser : 6+ à force égale à l'endurance, ±1 par point d'écart, entre 2+ et 10+. */
export const woundRoll = (strength: number, toughness: number) => Math.min(10, Math.max(2, 6 - strength + toughness))
