# Points à valider

Choix faits pendant l'import des sources (version du 10/10/2026) quand elles étaient incomplètes ou se contredisaient.
La liste brute générée par le script est dans `scripts/import-hypotheses.txt`.

## Règle générale
- Le **Compendium** est la référence : coûts, caractéristiques et compétences. Il n'est écarté que pour une aberration
  manifeste (voir le Commandement du Prêtre mangechair). Les coûts sont arrondis à l'entier (276,8 → 277).
- Ce que le Compendium ne contient pas vient de **Bandes.docx** : effectifs, équipement accessible, entretien, arbres et XP apporté.
- **Prix de l'équipement commun** : la « Liste des objets de trésors et marché noir ».

## Écarts de coût entre Bandes.docx et le Compendium (Compendium retenu)

| Profil | Bandes.docx | Compendium |
|---|---|---|
| Cités-États / **Mage** | 67 PO, For 4, End 4 | **133 PO**, For 5, End 5 |
| Orques / Orque noir | 311 PO | 277 PO |
| Gobelins / Troll | 288 PO | 262 PO |
| Ogre / Recrue | 347 PO | 317 PO |
| Ogre / Tyran | 407 PO | 372 PO |
| Skaven / Rat-ogre | 267 PO | 244 PO |
| Drakéide / Kroxigor | 506 PO | 462 PO |
| Mangechair / Dévoreur | 421 PO | 384 PO |
| La Harde / Minotaure | 317 PO | 290 PO |
| Nécromant / Vampire | 286 PO | 269 PO |
| Khajiit / **Ajani** | 73 PO | **125 PO** |
| Ondin / Guide | 84 PO | 124 PO |
| Ondin / **Avatar d'eau** | 133 PO | **433 PO** |

Les monstres sont environ 10 % plus chers dans Bandes.docx. Est-ce voulu ?

## Écarts de caractéristiques (Compendium retenu)
- Haut Elfe / Fantôme : Com 6+, Tir 5+, Comm 7+ (Bandes : 7+, 6+, 8+).
- Elfe des bois / Druide : Com 6+, Comm 8+ (Bandes : 7+, 9+). Guide : Comm 9+ (Bandes : 8+).
- Ogre / Tyran : Comm 10+ (Bandes : 9+).
- Skaven / Assassin : For 4 (Bandes : 3). Coureur nocturne : Comm 13+ (Bandes : 12+).
- Drakéide / Skink caméléon : Tir 6+ (Bandes : 7+).
- Cathay / Ninja : Mou 6 (Bandes : 5). Oni : Mou 4 (Bandes : 5).
- **Mangechair / Prêtre** : le Compendium indique Comm **1**, sans doute une coquille. La valeur de Bandes.docx (8+) est conservée.

## Compétences alignées sur le Compendium
- Nains / Brasseur : **Lieutenant** (Bandes.docx indiquait Étendard).
- Gobelins / Chaman Capuchard : perd Éclaireur 2.
- Skaven / Ingénieur : gagne Marin.
- Drakéide / Gardien du temple : gagne Dissipation et Chasseur de damnés.
- Mangechair / Maître dépeceur : gagne Éclaireur 4 et Peur.
- La Harde / Gardien Bestigor : **Sans peur** (Bandes.docx indiquait Peur).
- Kroxigor et Minotaure : Peur, Grande cible, N'apprend rien (aucune compétence dans Bandes.docx).

## Effectifs
- Pas d'effectif indiqué : **Kroxigor** et **Garde noir** (Nain d'Ashut) fixés à 0-1. **Vampire** fixé à 1 (c'est le chef).
- Conservés tels qu'écrits, à confirmer : Gardien du temple saurus 0-10, Décapiteur 0-10, Chevalier 0-3, Samouraï 0-3.
- Le premier bloc de Bandes.docx (« 0-10 Recrue : 45PO », sans faction) est ignoré.

## Sorts
- Un mage commence avec l'**Orbe mineur** et le **premier sort racial** de sa faction. Le mage Nain d'Ashut ne connaît que l'Orbe mineur.
- Le mage des **Cités-États** n'a pas de sort racial : il commence avec l'Orbe mineur seul, et un avertissement demande de choisir
  le second sort. Le Nécromancien reçoit « Relevez les squelettes ».
- Chaman Capuchard : il reçoit « Attaque sournoiz' ». « Viens là le squig !!!! » lui est réservé mais n'est pas donné d'office.
- Les sorts « Nécromant bonus » sont proposés aux mages nécromants, mais pas donnés au recrutement.

## Rareté des objets
- La rareté vient du **surlignage** de chaque objet dans la liste des objets : aucun = blanc (commun), gris = spécial,
  vert = rare, jaune = épique. Les armes et armures du builder sont toutes communes (blanc).
- Les compteurs entre parenthèses des catégories, par exemple « Fioles (4-8-15-6) », ne correspondent pas aux surlignages.
  Les Fioles comptent 6 blancs, 14 gris, 8 verts et 4 jaunes. Les objets « Renommé » sont surlignés en jaune alors que leur
  compteur est « (10-0-0-0) ». Ce sont les surlignages qui ont été retenus.

## Compétences sans description dans Règles.docx
- **Immortel** (Vampire)

## Campagne
- **Trésor de départ** : budget moins le coût de la bande au moment de « Démarrer la campagne ». Ensuite, les recrutements et
  les achats sont payés avec le trésor, et les ventes rapportent la moitié du prix (règle « Améliorer sa bande »).
- Le chef ne peut plus être recruté en campagne. S'il meurt, le site propose le membre au meilleur Commandement (à égalité,
  le plus expérimenté), qui gagne la compétence Chef et ne coûte plus d'entretien.
- Ordre de l'assistant, comme dans les règles : morts et blessures, cristaux et butin, entretien, expérience, montées de niveau.
  L'entretien est donc payé au niveau d'avant la partie.
- **Prospection** : un dé de plus par figurine ayant la compétence, seuls les meilleurs résultats comptent.
- **Montées de niveau** : pour Com, Tir, Agi et Comm (scores « X+ »), « +1 » fait baisser de 1 le score à obtenir.
  L'Agilité est traitée comme les autres scores « X+ ».
- **Blessures** : « Cheville tordue », « Folie », « Main écrasée » et « Œil crevé » augmentent de 1 le score à obtenir.
  « Bras amputé » retire une main. La deuxième amputation ou le deuxième œil crevé fait quitter la bande après l'entretien.
- **Sans effet durable** : « Même pas mal », « Au sol », « Assommé », « Blessure légère ». Pour « Sauvé par son sac »,
  l'objet détruit est à retirer à la main. Pour « Blessure multiple », il faut ajouter les deux cartes suivantes une par une.
- **Effets des objets sur la fiche** (objets **portés** uniquement, rien pour le sac) :
  - équipement commun : sauvegarde, malus de mouvement des armures lourdes, et **Encombrée** (bouclier, morgenstern, fléau)
    qui ajoute +1 au score de Combat, cumulable d'un objet à l'autre ;
  - objets de trésor : leur texte est lu automatiquement (« +1 en Force », « +2 à la sauvegarde », « +1 attaque »,
    « +1 pour toucher »…). Un « +1 pour toucher » sans précision vaut pour l'arme elle-même : Combat pour une arme de corps
    à corps, Tir pour une arme de tir. Les compétences données (« le porteur gagne… ») s'ajoutent aussi à la fiche ;
  - pas appliqués : les fioles et poisons (à usage unique), le Cube d'Incohérence (tiré au dé à chaque partie), les effets
    conditionnels (Couronne si chef, bonus contre les mages…) et les effets sur l'adversaire (-1 à la Force de l'arme
    ennemie, Parade…). La Force des armes (« Force utilisateur +1 ») ne modifie pas la Force de la fiche, comme dans les règles.
  - Les objets de trésor ne comptent pas encore dans la règle des mains.
- **Consommables** (bouton « Utiliser » pendant la partie) :
  - fioles : « +N en Force / Agilité / Commandement / armure / Endurance / mouvement jusqu'à la fin de la partie » s'applique
    à la fiche dès l'utilisation. L'Élixir du caméléon donne Camouflage. Les autres fioles (vol, téléportation, cocktail…)
    n'ont pas d'effet durable sur la fiche. Toutes sont défaussées après la bataille ;
  - liqueurs (clairvoyance, discernement, perspicacité) : leurs 1, 2 ou 3 D10 d'XP s'ajoutent à l'étape Expérience ;
  - poisons : jet de réserve après la bataille. Le poison est perdu sur 1 à 8, sur 1 à 5 avec Toxine apprivoisée, sur 1 à 3
    avec une sarbacane ou une arme qui ménage le poison (sur 1 ou 2 avec les deux). Sinon, il est conservé ;
  - Trèfle à 4 feuilles et Outils de crochetage : défaussés après la bataille. Le Grappin (hors d'usage sur un 1) n'est pas géré ;
  - « Potion de rapidité » n'a pas de description dans la liste des objets : elle est importée sans effet.

## Phases d'une bande
- **Préparation** tant que la campagne n'a pas démarré. **Entre deux parties** ensuite. **Partie en cours** entre
  « Lancer la partie » et l'enregistrement de l'après-partie.
- Pendant une partie, le recrutement, les achats et les ventes sont masqués, et le bouton « Utiliser » n'existe que dans ce mode.
  Les blessures notées pendant la partie sont appliquées tout de suite aux figurines (une figurine morte n'apparaît plus comme debout).
- « Annuler la partie » efface les compteurs et remet les consommables à « non utilisé », mais garde les blessures et les objets ramassés.
- Le brouillon de l'assistant d'après-partie est gardé dans le navigateur. Il est abandonné si la bande a été modifiée entre-temps.

## Assistant de partie
- **Composition des paquets** :
  - lieux d'intérêt : une carte par ligne de chaque feuille (42 chacun) ;
  - Blessures : quantités de la feuille (72) ;
  - Créatures : une carte par créature (20) ;
  - Objets (trésor) : blanc ×5, gris ×5, vert ×2, jaune ×1, soit 814 cartes (813 annoncées) ;
  - Marché noir : blanc ×5, gris ×3, vert ×1, soit 444 cartes ;
  - Sorts : les sorts non raciaux, sans l'Orbe mineur, soit 80 cartes (79 annoncées).
- Les paquets « Commun » (équipement de base) et « Objets et sorts raciaux » ne sont pas proposés à la pioche.
- La partie en cours de l'assistant (paquets, historique, round) est gardée dans le navigateur de l'appareil utilisé.
  Elle n'est pas partagée avec les autres joueurs.
- Fin de round : à partir du round 4, D10 + 2 × le numéro du round ; 18 ou plus, le soleil se couche.
- **Sac d'activation** : un jeton par figurine et une couleur par joueur. La pioche est au hasard parmi les jetons restants.
  Tous les jetons reviennent dans le sac à la fin du round. « ✝ −1 » retire un jeton jusqu'à la fin de la partie
  (figurine morte), et « Nouvelle partie » rend à chaque couleur son nombre de jetons de départ.

## Pas encore utilisé
- Cartes.xlsx : tout est utilisé (lieux, blessures, créatures, sorts, objets).
- Objets raciaux : gérés par le builder (voir « Objets raciaux » plus bas). Règle Ondin « pas de chaussures » : affichée dans le Compendium, pas encore contrôlée.

## Noms proposés
- À l'ajout (création de bande, recrutement, duplication), chaque modèle reçoit un nom tiré d'une liste propre à sa race (`src/lib/names.ts`), affiché en gris dans le champ. Le 🎲 en propose un autre.
- S'il n'est pas modifié, il devient le vrai nom à l'enregistrement. 5 % des tirages donnent un nom farfelu (« Gros Zizi »…).
- Les listes de noms sont des propositions de ma part, à remplacer librement.

## Sauvegarde dans le PDF / import
- Le PDF des fiches embarque la bande complète (JSON en base64 dans les mots-clés du document, préfixe `AMATIKA-CREW:v1:`).
- « Mes bandes » → « Importer une bande » relit ce PDF (ou un .json de bande). Bande inconnue : importée avec un nouvel identifiant. Bande déjà présente : au choix, remplacée ou importée en copie.
- Si le PDF est réenregistré par un logiciel qui supprime les métadonnées, l'import ne sera plus possible : garder le fichier téléchargé tel quel.

## Objets raciaux
- Table `RACIAL_ITEMS` dans `src/data/index.ts` (faction → objet de trésor). Humains = Cités-États ; Hache des forges naines = « Hache lourde des forges naines ».
- Achetables à la création (phase préparation) via « Objet racial » dans la liste d’équipement, au prix de l’objet, compté dans le budget. Réservés aux profils ayant accès à l’équipement de base (arbalète pour l’Arbalète naine, etc.) ; sans équivalent (gants, chausses, poison, talisman, potion), tout le monde y a accès.
- Renégats (variable) et Démons (aucun) : pas d'objet. Chaos (Cocktail Molotov) est saisi mais la faction n'existe pas encore.
- Les nombres donnés après certains objets dans la liste (8, 6, 10, 5) sont des quantités de cartes à imprimer : ignorés.

## Déploiement
- Points placés sur le bord de la table (demandé) : la zone de déploiement (rayon 6ps) est un demi-cercle, un quart de cercle dans un angle.
- Chaque point est à égale distance (vol d'oiseau) de ses deux voisins ; parmi ces dispositions, on garde celle qui maximise cette distance (calcul dans `src/lib/deployment.ts`).

## Sorts de départ
- Chaque mage commence avec 2 sorts verrouillés (non retirables) : Orbe mineur + son sort racial. Les sorts ajoutés ensuite peuvent être retirés.
- Sort racial réservé à un profil prioritaire : le Chaman Capuchard reçoit « Viens la le squig !!!! », le Chaman « Attaque sournoiz' ».
- Faction sans sort racial (Cités-États) : le 2e sort se choisit parmi 5 tirés au hasard dans les sorts accessibles au mage (hors Orbe mineur).
