# Journal des modifications

Toutes les évolutions notables de Découpe sont consignées dans ce fichier.
Le format s'inspire de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) et le projet suit le [versionnage sémantique](https://semver.org/lang/fr/).

## [Unreleased]

### Ajouté

- **Comparer deux notes côte à côte** : seconde note en lecture seule à côté de la note active, avec le même rendu que l'éditeur (tableaux, listes de tâches, images, wiki-liens).
  - Ouverture par `Alt + clic` sur une carte, bouton dans l'en-tête de l'éditeur ou palette de commandes (`Ctrl + K`).
  - Séparateur redimensionnable à la souris ou au clavier, largeur mémorisée (`decoupe.compareRatio`).
  - Wiki-liens ouverts dans le panneau comparé ; action « Ouvrir » pour basculer la note comparée dans l'éditeur.
  - Panneaux empilés sous 1280 pixels de large ; fermeture automatique si la note comparée devient active, est supprimée ou change de vault.
  - La comparaison est volontairement limitée à deux notes, sans diff mot à mot ni défilement synchronisé.

## [1.0.0] — 2026-11-03

Première version publique.

### Ajouté

- **Notes Markdown** organisées en espaces, avec Boîte d'entrée pour les notes non classées, tri, épinglage et sélection multiple.
- **Recherche** par texte, tag, date et plage de dates, avec calendrier, compteurs, filtres lisibles et extraits contextualisés.
- **Recherche dans la note ouverte** : `Ctrl + F`, compteur `n / total`, occurrence suivante/précédente, surlignage, insensible à la casse et aux accents.
- **Liens wiki** `[[Note]]` avec autocomplétion, création des notes manquantes, panneau de liens entrants et suggestions de notes liées.
- **Mentions à lier** : détection des noms de notes cités sans lien et conversion en wiki-lien.
- **Édition** sans syntaxe : barre de mise en forme, images collées, tableaux avec sélecteur de taille et outils contextuels, extraction, scission et fusion de notes.
- **Corbeille** pour les notes et les espaces, avec restauration et purge définitive confirmée.
- **Sauvegardes locales** : instantanés, planification, rétention, export et restauration guidée.
- **Détection des modifications externes** avec dialogue de conflit, rechargement ou conservation de la version locale.
- **Timeline narrative** personnages × chapitres : filtre, mode compact, légende interactive, navigation clavier et exports PNG/PDF.
- **Export PDF** des notes, avec notes liées en synthèse ou en annexes et thème pastel ou monochrome.
- **Palette de commandes** `Ctrl + K`, navigation clavier complète et raccourcis pour les actions fréquentes.
- **Capture rapide** `Ctrl + Alt + N` vers la Boîte d'entrée.
- **Personnalisation** : thèmes pastel, largeur d'éditeur, espace d'ouverture et rétention des sauvegardes.
- **Aide intégrée** en français, embarquée depuis `AIDE.md`, et assistant de premier lancement.
- **Distribution Windows** : installateur NSIS par utilisateur, archive ZIP portable et workflow CI de vérification et de packaging.

### Qualité

- 40 fichiers de tests et 339 tests automatisés (logique partagée, composants, intégration sur vault temporaire, commandes Milkdown réelles).
- `npm run typecheck`, `npm test` et `npm run build` validés avant publication.

### Limites connues

- Windows 10/11 est la plateforme validée ; les configurations macOS et Linux existent mais ne sont pas encore testées.
- La signature de code n'est pas en place : Windows peut afficher un avertissement SmartScreen au premier lancement.
- L'interface et l'aide sont uniquement en français.
- Pas de synchronisation cloud, de collaboration en temps réel ni de version mobile.
- La recherche dans la note ne traverse pas les changements de mise en forme (un mot en gras au milieu d'une expression coupe la correspondance).
- Les commentaires Markdown ne sont pas masqués : `<!-- ... -->` et `%% ... %%` restent visibles dans l'éditeur et dans l'export PDF.

## Format des versions

- **Majeur** : changement incompatible du format des vaults, des réglages ou des sauvegardes.
- **Mineur** : nouvelle fonctionnalité compatible.
- **Correctif** : correction sans changement de fonctionnalité.
