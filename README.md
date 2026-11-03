# Découpe

Prendre des notes, les organiser, les découper.

Découpe est une application de bureau (Electron + React) pour écrire et ranger des notes en Markdown, avec une attention particulière à l'écriture de romans : liens wiki, tags, corbeille, sauvegardes locales et timeline narrative personnages × chapitres.

Le vault reste un simple dossier de fichiers `.md` : il est lisible dans n'importe quel éditeur et compatible avec les outils qui travaillent sur du Markdown.

## Fonctionnalités

- **Notes Markdown** organisées en espaces (dossiers), avec titres, extraits et tri.
- **Liens wiki** `[[Note]]` avec autocomplétion, suggestions de notes liées et panneau de liens entrants.
- **Tags** `#tag` : édition, suggestions, recherche multi-tags, renommage et suppression globaux.
- **Recherche** par texte, tag, date et plage de dates, avec calendrier et compteurs.
- **Édition** : images collées, tableaux insérés et modifiés sans syntaxe (lignes, colonnes, texte avant et après), extraction, scission, fusion, sélection multiple.
- **Corbeille** pour les notes et les espaces, avec restauration et purge définitive.
- **Sauvegardes locales** : instantanés, planification, rétention, export et restauration.
- **Détection des modifications externes** : garde d'écriture, rechargement ou conservation locale.
- **Timeline narrative** : personnages × chapitres, filtre, mode compact, légende interactive, navigation clavier, export PNG et PDF.
- **Export PDF** des notes, avec notes liées en synthèse ou en annexes.
- **Palette de commandes**, raccourcis clavier et navigation complète au clavier.
- **Thèmes pastel**, réglages persistants et aide intégrée.

L'interface et l'aide sont en français.

## Prérequis

- **Node.js 22 ou plus récent** (LTS recommandé) et npm.
- **Windows 10/11** pour la cible principale de distribution.
- Le développement fonctionne aussi sur macOS et Linux, mais les paquets correspondants ne sont pas encore validés.

## Démarrage

```bash
npm ci
npm run dev
```

`npm run dev` lance Vite et Electron avec rechargement à chaud.

Au premier lancement, choisissez un dossier de notes. L'application crée la structure nécessaire ; le bouton dossier de la barre latérale permet de rouvrir un des 5 derniers vaults ou d'en choisir un autre.

## Scripts

| Commande | Rôle |
| --- | --- |
| `npm run dev` | Lance l'application en développement. |
| `npm start` | Prévisualise le build avec Electron. |
| `npm run build` | Compile le processus principal, le preload et le renderer dans `out/`. |
| `npm run typecheck` | Vérifie les types TypeScript (web, node et tests). |
| `npm test` | Lance la suite Vitest. |
| `npm run dist` | Compile puis construit les paquets avec electron-builder dans `release/`. |
| `npm run icon` | Régénère les icônes depuis `build/icon.png`. |

La procédure de build, de validation et de publication est décrite dans [BUILD.md](BUILD.md).

## Structure d'un vault

```text
Mon vault/
├─ Notes/
│  ├─ Note sans espace.md
│  ├─ Personnages/
│  │  └─ Alice.md
│  └─ Chapitres/
│     └─ Chapitre 1.md
├─ attachments/          # images collées
└─ .decoupe/
   └─ corbeille/         # notes et espaces supprimés
```

- Les notes sont des fichiers `.md` sous `Notes/` ; un sous-dossier est un **espace**.
- `attachments/` contient les images copiées dans les notes.
- `.decoupe/` contient les données internes (corbeille et métadonnées de restauration). Les sauvegardes locales sont stockées hors du vault, dans le dossier de données de l'application. `.decoupe/` peut être exclu d'une synchronisation si vous le souhaitez.

### Conventions utiles

- **Lien wiki** : `[[Alice]]` dans le corps d'une note.
- **Tags** : `#personnage`, `#chapitre`, ou n'importe quel autre tag.
- **Timeline narrative** : les personnages sont les notes taguées `#personnage` ou rangées dans un espace `Personnages` ; les chapitres sont tagués `#chapitre` / `#chapter` ou rangés dans `Chapitres`. Le champ `chapter` (ou `chapitre`) du frontmatter fixe l'ordre.
- **Notes épinglées** : `pinned: true` dans le frontmatter.
- **Date de création** : conservée dans le frontmatter, avec repli sur la date du système de fichiers pour les anciennes notes.

## Aide

L'aide est accessible depuis le bouton `?` de la barre latérale. Sa source unique est [AIDE.md](AIDE.md) : le fichier est embarqué au build, donc l'aide distribuée correspond toujours au dépôt.

## Tests

```bash
npm run typecheck
npm test
npm run build
```

La suite couvre la logique partagée (texte, tags, recherche, liens, timeline, aide, vaults), les composants critiques (barre latérale, timeline, palette de commandes, calendrier, liste des notes, éditeur, outils de tableau, liens entrants, capture rapide, notes liées, onboarding, notifications), les dialogues (corbeille, sauvegardes, réglages, export PDF, modifications externes) via jsdom et React Testing Library, ainsi que des scénarios d'intégration sur un vault temporaire. Elle compte 39 fichiers et 328 tests.

## Contribuer

Les retours et contributions sont bienvenus. Avant d'ouvrir une modification :

1. garder les notes en Markdown standard et les données compatibles hors application ;
2. vérifier que tout reste utilisable au clavier ;
3. lancer `npm run typecheck`, `npm test` et `npm run build`.

## Licence

[MIT](LICENSE) — Copyright (c) 2026 Decoupe contributors.

## État du projet

Version **0.1.0**. Les paquets Windows (installateur NSIS et archive ZIP) sont produits par `npm run dist`. La signature de code n'est pas encore en place : Windows peut afficher un avertissement SmartScreen au premier lancement.
