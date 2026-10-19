# Builder Amatika

Site pour créer et gérer ses bandes d'**Amatika**, jeu de figurines inspiré de Mordheim.

- Création de bande : faction, budget, recrutement, équipement, validation des règles en direct.
- Campagne, en trois phases : préparation, entre deux parties (achats, ventes, recrutement, trésor), partie en cours
  (vue table de jeu : participants, objets utilisés, blessures, compteurs d'XP et de cristaux).
- Assistant d'après-partie pré-rempli avec ce qui a été noté pendant la partie (objets utilisés, blessures, butin, entretien,
  XP, niveaux), qui reprend là où on s'est arrêté, et historique des parties.
- Fiches personnage imprimables (ou PDF via le navigateur).
- Assistant de partie : pioche réelle dans les paquets (lieux d'intérêt, objets, blessures, créatures, marché noir, sorts), dés, rounds et coucher du soleil, historique.
- Règles, compétences, équipements et profils de bandes consultables avec recherche.

Stack : React + TypeScript (Vite), hébergé sur GitHub Pages, comptes et sauvegardes via Firebase (offre gratuite Spark, sans mise en pause).
Sans Firebase configuré, le site fonctionne en **mode local** : les bandes sont stockées dans le navigateur.

## Lancer en local

```bash
npm install
npm run dev
```

## Données du jeu

Tout est dans `src/data/` :

| Fichier | Contenu | Source |
|---|---|---|
| `factions.json` | Factions et profils (coût, effectif, caracs, compétences, équipement autorisé, entretien, XP apporté) | Bandes.docx + Compendium.xlsx |
| `equipment.json` | Armes et armures communes et leurs règles pour le builder | maintenu à la main, prix importés |
| `skills.json` | Compétences par arbre | Règles.docx |
| `rules.json` | Texte des règles découpé en sections | Règles.docx |
| `spells.json` | Sorts (valeur, portée, cible, invocations) | Cartes.xlsx, feuille « Sorts » |
| `items.json` | Objets de trésor et du marché noir | Liste des objets de trésors et marché noir.docx |
| `lore.json` | Histoire de l'île | Fluff.docx |
| `locations.json` | Paquets de lieux d'intérêt (42 cartes chacun) | Cartes.xlsx, feuilles Coffre… Rivage |
| `creatures.json` | Créatures de la faune | Cartes.xlsx, feuille « Créatures et invocations » |
| `injuries.json` | Cartes Blessure et leurs effets durables | Cartes.xlsx, feuille « Blessures » |

Pour régénérer ces fichiers à partir du dossier des documents :

```bash
python scripts/import_data.py "B:/WARHAMMER/Franckie game/Amatika"
```

Le script écrase les corrections faites à la main dans les fichiers générés. Dans `equipment.json`, il ne met à jour que les prix.
Les choix faits sur les données floues sont listés dans [HYPOTHESES.md](HYPOTHESES.md).

## Brancher Firebase (comptes)

1. Créer un projet sur [console.firebase.google.com](https://console.firebase.google.com) (gratuit, sans Google Analytics).
2. **Authentication > Commencer**, puis dans **Sign-in method** activer **Adresse e-mail/Mot de passe** et **Google**.
3. **Authentication > Settings > Authorized domains** : ajouter `<utilisateur>.github.io` (`localhost` y est déjà).
4. **Firestore Database > Créer une base de données** (mode production, région Europe), puis dans **Règles** coller le contenu de `firestore.rules` et publier.
5. **Paramètres du projet > Vos applications > Web (</>)** : créer une application et récupérer `apiKey`, `authDomain`, `projectId`, `appId` :
   - en local : copier `.env.example` en `.env.local` et les renseigner ;
   - pour GitHub : **Settings > Secrets and variables > Actions > Variables**, créer `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID` et `VITE_FIREBASE_APP_ID`.

Ces valeurs ne sont pas secrètes (elles finissent dans le site publié) : la protection des bandes vient des règles Firestore.

À chaque modification de `firestore.rules` (par exemple l'ajout des campagnes de groupe), recoller son contenu dans **Firestore Database > Règles** et publier.

## Déployer sur GitHub Pages

1. Créer le dépôt sur GitHub et y pousser la branche `main`.
2. **Settings > Pages > Source : GitHub Actions**.
3. Chaque push sur `main` déploie le site (`.github/workflows/deploy.yml`).
