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

Stack : React + TypeScript (Vite), hébergé sur GitHub Pages, comptes et sauvegardes via Supabase (offre gratuite).
Sans Supabase configuré, le site fonctionne en **mode local** : les bandes sont stockées dans le navigateur.

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

## Brancher Supabase (comptes)

1. Créer un projet sur [supabase.com](https://supabase.com) (gratuit).
2. Dans **SQL Editor**, exécuter `supabase/schema.sql`.
3. Dans **Authentication > URL Configuration**, ajouter l'URL du site (ex. `https://<utilisateur>.github.io/builder-amatika/`) et `http://localhost:5173/` aux Redirect URLs.
4. (Optionnel) Activer Google dans **Authentication > Providers**.
5. Récupérer l'URL du projet et la clé `anon` (**Project Settings > API**) :
   - en local : copier `.env.example` en `.env.local` et les renseigner ;
   - pour GitHub : **Settings > Secrets and variables > Actions > Variables**, créer `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`.

## Déployer sur GitHub Pages

1. Créer le dépôt sur GitHub et y pousser la branche `main`.
2. **Settings > Pages > Source : GitHub Actions**.
3. Chaque push sur `main` déploie le site (`.github/workflows/deploy.yml`).
