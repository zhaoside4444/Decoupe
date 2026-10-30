# Roadmap Decoupe

> État au 24 octobre 2026 — version 0.1.0

## Principes

- Les notes restent des fichiers Markdown lisibles et portables.
- La fiabilité des données passe avant les nouvelles fonctionnalités.
- Chaque fonctionnalité doit rester utilisable au clavier.
- La validation évite les smoke tests CDP : tests unitaires, tests d’intégration, typecheck, build et packaging.

## Déjà livré

- Tags : édition, suggestions, recherche multi-tags, filtres, renommage et suppression globaux.
- Date de création persistée dans le frontmatter, avec repli sur `birthtime` pour les anciennes notes.
- Recherche par date et calendrier avec compteurs, dates sans notes désactivées et filtre.
- Recherche conservée à l’ouverture d’une note.
- Images collées, wiki-liens, extraction, scission, fusion, corbeille avec annulation.
- Corbeille visible : notes et dossiers, restauration, purge définitive et confirmation.
- Sauvegardes locales : instantanés, automatisation configurable, rétention, export et restauration.
- Modifications externes : détection de la note ouverte, garde d’écriture, rechargement ou conservation locale, suppression et déplacement.
- Liens entrants : panneau latéral avec extraits, occurrences, espaces, ouverture en un clic et actualisation automatique.
- Autocomplétion des wiki-liens : suggestions après `[[`, recherche titre/espace, navigation clavier et création des notes manquantes.
- Packaging portable ZIP fonctionnel.

## Phase 1 — Fiabilité des données

### 1. Corbeille visible
- [x] Ajouter une section « Corbeille » dans la sidebar.
- [x] Lister les notes et dossiers supprimés avec leur date de suppression.
- [x] Permettre la restauration et la suppression définitive.
- [x] Ajouter une confirmation pour la purge définitive.
- [x] Prévoir un état vide clair.

**Effort : M** — Livré le 23 octobre 2026 : métadonnées de corbeille, listing, restauration, purge définitive et dialogue dédié.

### 2. Sauvegardes locales
- [x] Créer un snapshot automatique avant les opérations destructives.
- [x] Ajouter une sauvegarde périodique configurable.
- [x] Définir une politique de rétention.
- [x] Ajouter un export complet du vault.
- [x] Ajouter un import ou une restauration guidée.

**Effort : M** — Livré le 23 octobre 2026 : instantanés locaux, sauvegarde automatique configurable, rétention, export du vault, restauration guidée et sauvegarde de sécurité avant purge définitive ou restauration.

### 3. Modifications externes
- [x] Détecter la modification de la note ouverte hors de l’application.
- [x] Afficher un avertissement sans écraser silencieusement le contenu local.
- [x] Proposer « recharger » ou « conserver ma version ».
- [x] Gérer le cas d’une note supprimée ou déplacée pendant l’édition.

**Effort : M** — Livré le 23 octobre 2026 : détection par le watcher, comparaison au contenu disque de référence, garde `expectedContent` à l’écriture, dialogue de conflit, rechargement ou conservation locale, gestion des notes supprimées et déplacées.

## Phase 2 — Navigation dans les connaissances

### 4. Liens entrants
- [x] Afficher un panneau « Liens entrants » pour la note courante.
- [x] Ouvrir une note référencée en un clic.
- [x] Mettre à jour le panneau après modification des liens.

**Effort : M/L** — Livré le 24 octobre 2026 : panneau latéral rétractable, compteur, extraits, occurrences, ouverture en un clic, actualisation après les changements du vault, superposition responsive et tests dédiés.

### 5. Autocomplétion des wiki-liens
- [x] Proposer les notes existantes après la saisie de `[[`.
- [x] Rechercher par titre et par espace.
- [x] Insérer le lien au clavier.
- [x] Gérer les liens vers une note inexistante.

**Effort : M** — Livré le 24 octobre 2026 : menu ancré au curseur, recherche insensible aux accents dans le titre, la base et l’espace, navigation par flèches, insertion avec Entrée ou Tab, création directe d’une note manquante et repli sur un lien libre.

### 6. Mentions non liées
- [x] Détecter les titres de notes mentionnés sans wiki-lien.
- [x] Proposer de convertir une mention en `[[lien]]`.
- [x] Éviter les faux positifs sur les mots trop courts.

**Effort : M** — Livré le 25 octobre 2026 : détection insensible à la casse sur des mots entiers (4 caractères minimum), exclusion du code, des liens existants, des URLs, du frontmatter et de la note courante, panneau « Mentions à lier » avec occurrences groupées et conversion de la première occurrence en wiki-lien.

### 7. Notes liées
- [x] Suggérer des notes partageant des tags ou des liens.
- [x] Afficher ces suggestions dans la note courante.
- [x] Permettre de désactiver les suggestions.

**Effort : M** — Livré le 26 octobre 2026 : suggestion pondérée des notes associées (tags partagés, cibles de wiki-liens communes, liens directs sortants/entrants et même espace), grille de cartes en bas de page avec aperçu, tags cliquables et repli dynamique, paramètre d'activation/désactivation dans les réglages et action rapide dans la palette de commandes.

## Phase 3 — Recherche et productivité

### 8. Résultats de recherche enrichis
- [x] Afficher un extrait autour du terme trouvé.
- [x] Surligner les correspondances.
- [x] Classer les résultats : titre, tags, puis contenu.
- [x] Afficher le nombre de correspondances.

**Effort : M** — Livré le 24 octobre 2026 : extraits contextualisés autour du terme, surlignage des correspondances, classement titre/tags/contenu et compteur de correspondances par note.

### 9. Filtres lisibles
- [x] Afficher les filtres actifs sous forme de puces.
- [x] Supprimer un filtre individuellement.
- [x] Remplacer le token brut `date:YYYY-MM-DD` par un libellé lisible.
- [x] Ajouter les plages de dates `date:2026-10-01..2026-10-31`.

**Effort : S/M** — Livré le 24 octobre 2026 : puces de filtres actifs supprimables une par une, libellés de dates lisibles et plages `date:YYYY-MM-DD..YYYY-MM-DD`. Point 6 de la séquence, livré avec la section 8.

### 10. Tri et épinglage
- [x] Trier par modification, création ou titre.
- [x] Mémoriser le tri choisi.
- [x] Ajouter les notes épinglées ou favorites.
- [x] Afficher les épinglées en tête de liste.

**Effort : S/M** — Livré le 25 octobre 2026 : tri modification/création/titre insensible à la casse et aux accents, mémorisé, épinglage persistant via le frontmatter `pinned: true` (portable), épinglées toujours en tête de liste, y compris en recherche.

### 11. Sélection multiple
- [x] Sélectionner plusieurs notes avec Ctrl/Shift.
- [x] Déplacer, taguer ou supprimer en lot.
- [x] Afficher une barre d’actions contextuelle.
- [x] Annuler les opérations de lot.

**Effort : M/L** — Livré le 25 octobre 2026 : sélection Ctrl+clic/Maj+clic avec coche par carte, barre d’actions contextuelle (déplacement vers un dossier, ajout de tags, corbeille avec confirmation), annulation de chaque opération de lot via la notification.

## Phase 4 — Confort et accessibilité

### 12. Navigation clavier
- [x] Parcourir la liste avec les flèches.
- [x] Ouvrir, créer et déplacer une note au clavier.
- [x] Naviguer dans le calendrier au clavier.
- [x] Gérer correctement le focus après fermeture d’un panneau.

**Effort : M** — Livré le 25 octobre 2026 : parcours de la liste aux flèches (surlignage + défilement), ouverture avec Entrée, création et déplacement via la palette, calendrier navigable aux flèches/Home/End/PageUp/PageDown, focus rendu au déclencheur à la fermeture du calendrier, des panneaux et des dialogues.

### 13. Palette de commandes
- [x] Ouvrir une palette avec `Ctrl+K`.
- [x] Rechercher une note, un espace, un tag ou une action.
- [x] Créer une note, changer d’espace et filtrer sans souris.
- [x] Ajouter les raccourcis aux actions fréquentes.

**Effort : M** — Livré le 25 octobre 2026 : palette `Ctrl+K` avec recherche insensible à la casse et aux accents, groupes Actions/Notes/Espaces/Tags, navigation aux flèches, exécution avec Entrée, notes récentes à vide, épinglage, corbeille, déplacement, tri, sauvegardes et corbeille accessibles au clavier.

### 14. Réglages
- [x] Ajouter un thème clair, sombre ou automatique.
- [x] Choisir l'espace d'ouverture par défaut.
- [x] Régler la largeur de l'éditeur.
- [x] Configurer la rétention des sauvegardes.

**Effort : M** — Livré le 25 octobre 2026 : 6 thèmes pastels carnets de notes (Papier naturel, Rose poudré, Menthe douce, Bleu brume, Lavande, Pêche veloutée), largeur d'éditeur ajustable (presets + curseur 520–1100 px), espace d'ouverture par défaut (automatique, boîte d'entrée, toutes les notes, ou espace nommé), rétention des sauvegardes configurable. Pas de mode sombre : les thèmes pastels forcent `color-scheme: light`.

### 15. Export PDF (Option C)
- [x] Générer un document PDF A4 avec en-tête (titre, métadonnées, tags) et corps Markdown rendu.
- [x] Dialogue d'export : notes liées (aucune / index synthèse / annexes complètes avec sélection), style (pastel / monochrome).
- [x] Boîte de dialogue système pour l'enregistrement, notification avec bouton « Ouvrir le PDF ».
- [x] Raccourci Ctrl+P et entrée dans la palette de commandes.

**Effort : L** — Livré le 25 octobre 2026 : dialogue PdfExportDialog (Option C), rendu HTML complet via uildPdfDocumentHtml (titres, listes, citations, code, tableaux, images, wiki-liens), intégration des notes liées en mode synthèse (cartes résumé) ou annexes complètes (saut de page par note), thème pastel/monochrome, IPC printToPDF via BrowserWindow caché, enregistrement via dialog.showSaveDialog, ouverture du PDF via shell.openPath.

### 18. Timeline narrative (écriture de livres)
- [x] Identifier les personnages (#personnage ou espace "Personnages") et les chapitres (#chapitre ou espace "Chapitres").
- [x] Visualiser les apparitions par chapitre (points sur une grille personnages × chapitres).
- [x] Trier les chapitres par numéro de frontmatter (champ chapter/chapitre) ou par date de création.
- [x] Connecter les apparitions pour visualiser l'arc narratif de chaque personnage.
- [x] Cliquer sur un personnage ou un chapitre pour l'ouvrir.
- [x] Mode compact : hauteur de ligne réduite pour afficher plus de chapitres (choix mémorisé).
- [x] Filtre texte en temps réel sur les personnages et les chapitres (insensible aux accents).
- [x] Légende interactive : cliquer sur un nom isole sa ligne, second clic pour tout réafficher.
- [x] Navigation clavier : flèches entre personnages/apparitions, Entrée ouvre, Échap ferme.

**Effort : M** — Livré le 25 octobre 2026 : module src/shared/timeline.ts (buildTimelineData, chapterFromFrontmatter), composant NarrativeTimeline.tsx (SVG interactif, survol, défilement), bouton dans la sidebar et la palette de commandes, 6 tests unitaires. Pas de graphe global : timeline ciblée sur les personnages et leurs apparitions par chapitre.

**Effort : S** — Livré le 28 octobre 2026 : réécriture propre du composant (hooks avant le retour, props `data`), mode compact persisté (`decoupe.timeline.compact`), filtre via `foldName`, légende à puces avec compteur d'apparitions et isolation de ligne, info-bulles en coordonnées écran.

## Phase 5 — Qualité et distribution

### 15. Tests renderer
- [x] Tester le calendrier, les filtres, la recherche et les états vides (logique partagée dans src/shared).
- [x] Tester les interactions clavier (moveListIndex, paletteMatches dans src/shared/nav).
- [~] jsdom et React Testing Library non installés (pas de dépendance réseau) ; tests de composants React reportés.
- [x] Aucun test CDP.

**Effort : M** — Livré le 25 octobre 2026 : tests unitaires de la logique pure (nav, sort, settings, mentions, text, wiki-suggestions, related, markdown-html, search, backlinks).

### 16. Tests d'intégration
- [x] Scénarios complets : création, tags, dates, liens, corbeille (tests/integration.test.ts).
- [x] Vérifier la conservation de `created` après toutes les écritures.
- [x] Vérifier les rollbacks et les annulations.

**Effort : M** — Livré le 25 octobre 2026 : 17 tests d'intégration avec données seed (création, déplacement, corbeille/restauration, recherche par tag/texte/date/plage, conservation de `created` après write/move/trash, rollbacks rename/delete tag, conflit expectedContent, backlinks, nettoyage de liens).

### 17. Distribution
- [ ] Décider si l’application doit être distribuée hors de la machine actuelle.
- [ ] Obtenir un certificat de signature de code.
- [ ] Réactiver l’installateur NSIS.
- [ ] Documenter la procédure de build et de validation.

**Effort : externe** — Bloqué par le certificat et la politique Code Integrity locale.

> **Décision open source** : le projet sera distribué en open source. Signature gratuite possible via SignPath (signpath.io) ou Azure Trusted Signing (~10 $/mois).

## Séquence recommandée

1. [x] Corbeille visible.
2. [x] Sauvegardes locales.
3. [x] Gestion des modifications externes.
4. [x] Liens entrants.
5. [x] Autocomplétion `[[`.
6. [x] Recherche enrichie et filtres lisibles.
7. [x] Tri, épinglage et sélection multiple.
8. [x] Navigation clavier et palette de commandes.
9. [x] Export PDF (Option C).
10. [x] Tests renderer et intégration.

## Décisions à prendre

- Faut-il distribuer l'application à d'autres utilisateurs ? **Décision : oui, en open source.**
- Les sauvegardes doivent-elles être locales, ou s’appuyer sur le service de synchronisation du vault ?
- Faut-il autoriser la modification manuelle de la date de création ?
- Quel niveau de compatibilité Obsidian faut-il garantir pour les liens et le frontmatter ?
- Faut-il conserver les notes épinglées dans le frontmatter ou dans un index interne ?
