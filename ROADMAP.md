# Roadmap Decoupe

> État au 9 novembre 2026 — version 1.0.0

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
- Recherche dans la note ouverte : `Ctrl+F`, compteur, occurrence suivante/précédente, surlignage, insensible à la casse et aux accents.
- Images collées, wiki-liens, extraction, scission, fusion, corbeille avec annulation.
- Corbeille visible : notes et dossiers, restauration, purge définitive et confirmation.
- Sauvegardes locales : instantanés, automatisation configurable, rétention, export et restauration.
- Modifications externes : détection de la note ouverte, garde d’écriture, rechargement ou conservation locale, suppression et déplacement.
- Liens entrants : panneau latéral avec extraits, occurrences, espaces, ouverture en un clic et actualisation automatique.
- Autocomplétion des wiki-liens : suggestions après `[[`, recherche titre/espace, navigation clavier et création des notes manquantes.
- Timeline narrative : personnages × chapitres, mode compact, filtre, légende interactive, navigation clavier, exports PNG et PDF.
- Notes liées suggérées, mentions non liées convertibles en wiki-liens, palette de commandes, sélection multiple, export PDF, tri et épinglage.
- Tableaux : insertion assistée par sélecteur de taille (sans syntaxe), groupe contextuel pour ajouter ou supprimer une ligne, une colonne ou le tableau, texte libre avant et après un tableau en début ou fin de note, rendu GFM dans l'éditeur et export PDF.
- Sélecteur de dossiers récents et navigation clavier de la barre latérale.
- Packaging Windows : archive ZIP et installateur NSIS, README, BUILD.md, licence MIT et workflow CI.

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
- [x] Rechercher dans la note ouverte (`Ctrl+F`) avec navigation entre les occurrences.

**Effort : M** — Livré le 24 octobre 2026 : extraits contextualisés autour du terme, surlignage des correspondances, classement titre/tags/contenu et compteur de correspondances par note. **Complété le 3 novembre 2026** : recherche dans la note ouverte (`Ctrl+F` ou bouton loupe), compteur `n / total`, `Entrée`/`Maj+Entrée` et flèches pour parcourir les occurrences, surlignage de toutes les occurrences et de l'occurrence courante, fermeture par `Échap`, insensible à la casse et aux accents, sans modifier le Markdown ; décorations ProseMirror et 11 tests dédiés (40 fichiers, 339 tests).

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

### 16. Timeline narrative (écriture de livres)
- [x] Identifier les personnages (#personnage ou espace "Personnages") et les chapitres (#chapitre ou espace "Chapitres").
- [x] Visualiser les apparitions par chapitre (points sur une grille personnages × chapitres).
- [x] Trier les chapitres par numéro de frontmatter (champ chapter/chapitre) ou par date de création.
- [x] Connecter les apparitions pour visualiser l'arc narratif de chaque personnage.
- [x] Cliquer sur un personnage ou un chapitre pour l'ouvrir.
- [x] Mode compact : hauteur de ligne réduite pour afficher plus de chapitres (choix mémorisé).
- [x] Filtre texte en temps réel sur les personnages et les chapitres (insensible aux accents).
- [x] Légende interactive : cliquer sur un nom isole sa ligne, second clic pour tout réafficher.
- [x] Navigation clavier : flèches entre personnages/apparitions, Entrée ouvre, Échap ferme.

**Effort : M** — Livré le 25 octobre 2026 : module src/shared/timeline.ts (buildTimelineData, chapterFromFrontmatter), composant NarrativeTimeline.tsx (SVG interactif, survol, défilement), bouton dans la sidebar et la palette de commandes, 17 tests unitaires. Pas de graphe global : timeline ciblée sur les personnages et leurs apparitions par chapitre.

**Effort : S** — Livré le 28 octobre 2026 : réécriture propre du composant (hooks avant le retour, props `data`), mode compact persisté (`decoupe.timeline.compact`), filtre via `foldName`, légende à puces avec compteur d'apparitions et isolation de ligne, info-bulles en coordonnées écran, exports PNG/PDF et zoom/pan au-delà de 50 colonnes.

## Phase 5 — Qualité et distribution

### 17. Tests renderer
- [x] Tester le calendrier, les filtres, la recherche et les états vides (logique partagée dans src/shared).
- [x] Tester les interactions clavier (moveListIndex, paletteMatches dans src/shared/nav).
- [x] Tests de composants React avec jsdom et React Testing Library (Sidebar, NarrativeTimeline, palette de commandes, dialogues, calendrier, liste, éditeur, liens entrants, capture rapide, notes liées, onboarding, notifications).
- [x] Aucun test CDP.

**Effort : M** — Livré le 25 octobre 2026 : tests unitaires de la logique pure (nav, sort, settings, mentions, text, wiki-suggestions, related, markdown-html, search, backlinks, timeline, help, vaults). **Complété le 30 octobre 2026** : tests de composants en jsdom (Sidebar, NarrativeTimeline, palette de commandes), soit 22 fichiers et 208 tests. **Complété le 31 octobre 2026** : dialogues (corbeille, sauvegardes, réglages, export PDF, modifications externes), soit 27 fichiers et 240 tests ; au passage, décocher la dernière note liée de l'export PDF ne la recoche plus automatiquement. **Complété le 1er novembre 2026** : calendrier, liste des notes et éditeur (en-tête, tags, mentions, notes liées, mise en forme, référence impérative), soit 30 fichiers et 278 tests ; l'éditeur est testé avec Milkdown neutralisé pour couvrir l'interface autour du moteur. **Complété le même jour** : liens entrants, capture rapide, onboarding, notes liées, éditeur vide et notifications, soit 36 fichiers et 307 tests. **Corrigé le même jour** : le bouton « Nouveau dossier » de la section Espaces avait disparu ; il est rétabli avec un test dédié (309 tests). **Ajouté le 2 novembre 2026** : sélecteur de tableau dans la barre de mise en forme (grille 6 × 6, taille annoncée, fermeture par Échap ou clic extérieur), soit 313 tests. **Complété le même jour** : groupe contextuel « Tableau » pour ajouter ou supprimer une ligne, une colonne ou le tableau ; la suppression de l'en-tête promeut la ligne suivante pour conserver un tableau GFM valide, et l'action est protégée quand il ne resterait qu'une ligne. Des tests d'intégration exécutent les commandes Milkdown réelles (suppression de ligne, promotion de l'en-tête, suppression de colonne, ajouts et validité du document), soit 38 fichiers et 321 tests. **Complété le 3 novembre 2026** : un paragraphe vide encadre automatiquement un tableau placé en début ou en fin de note, ce qui permet d'y écrire du texte avant et après ; le repère `<br />` du sérialiseur est retiré à l'enregistrement pour conserver un Markdown propre, soit 39 fichiers et 328 tests. **Complété le même jour** : recherche dans la note ouverte (module `note-search`, décorations ProseMirror, barre `Ctrl+F`, surlignage et navigation entre occurrences), soit 40 fichiers et 339 tests.

### 18. Tests d'intégration
- [x] Scénarios complets : création, tags, dates, liens, corbeille (tests/integration.test.ts).
- [x] Vérifier la conservation de `created` après toutes les écritures.
- [x] Vérifier les rollbacks et les annulations.

**Effort : M** — Livré le 25 octobre 2026 : 17 tests d'intégration avec données seed (création, déplacement, corbeille/restauration, recherche par tag/texte/date/plage, conservation de `created` après write/move/trash, rollbacks rename/delete tag, conflit expectedContent, backlinks, nettoyage de liens).

### 19. Distribution
- [x] Décider si l’application doit être distribuée hors de la machine actuelle.
- [ ] Obtenir un certificat de signature de code.
- [x] Réactiver l’installateur NSIS.
- [x] Documenter la procédure de build et de validation.

**Effort : S** — Livré le 30 octobre 2026 (hors signature) : cible `nsis` (`oneClick: false`, `perMachine: false`, raccourcis bureau et menu Démarrer, `uninstallDisplayName`), README, BUILD.md (build, artefacts, checklist de validation, dépannage), LICENSE MIT et workflow CI (vérification sur push/PR, packaging Windows sur tag `v*`).

**Effort : externe** — Reste la signature de code, bloquée par le certificat et la politique Code Integrity locale.

> **Décision open source** : le projet sera distribué en open source. Signature gratuite possible via SignPath (signpath.io) ou Azure Trusted Signing (~10 $/mois).

## Phase 6 — Évolutions après la 1.0.0

> Planifiées les 7 et 9 novembre 2026. Rien n’est implémenté : la 1.0.0 reste gelée jusqu’à sa validation manuelle et sa publication.

### 20. Comparer deux notes côte à côte
- [ ] Afficher une seconde note en lecture seule à côté de la note active.
- [ ] Choisir la note comparée par `Ctrl + clic`, par la palette de commandes ou depuis l’en-tête de l’éditeur.
- [ ] Ajouter un séparateur redimensionnable et mémoriser la largeur des panneaux.
- [ ] Empiler les panneaux sur les fenêtres étroites et proposer une action « Fermer la comparaison ».
- [ ] Réutiliser le rendu de l’éditeur (tableaux, listes de tâches, images, wiki-liens) sans dupliquer les écouteurs globaux.
- [ ] Laisser hors périmètre : diff mot à mot, défilement synchronisé, comparaison de plus de deux notes.

**Effort : M** — Environ 2 à 3 jours, tests et documentation compris. Risque faible : la note comparée est en lecture seule, donc la sauvegarde, les conflits externes et la recherche dans la note restent liés à la seule note active. Une version ultérieure pourra rendre les deux panneaux éditables.

### 21. Ordre manuel des cartes d’un espace
- [ ] Ajouter un mode de tri « Ordre manuel » au sélecteur existant.
- [ ] Réordonner les cartes par glisser-déposer, avec indicateur d’insertion entre deux cartes.
- [ ] Déplacer la fusion de notes vers un geste explicite (menu contextuel ou `Alt + glisser`) pour ne pas la confondre avec le réordonnancement.
- [ ] Ajouter « Monter / Descendre » au clavier et dans le menu contextuel.
- [ ] Persister l’ordre par espace, de préférence dans `.decoupe/order.json`, avec réconciliation des notes ajoutées, supprimées ou déplacées.
- [ ] Désactiver le réordonnancement pendant une recherche active.
- [ ] Trancher le comportement des notes épinglées en ordre manuel.

**Effort : M** — Environ 3 à 4 jours, tests et documentation compris. Risque faible à moyen : le point délicat est la coexistence du glisser pour réordonner et du glisser pour fusionner, plus la réconciliation de l’ordre avec les fichiers du vault.

> **Décision en attente** : l’ordre doit-il être stocké dans `.decoupe/order.json` (aucune pollution des notes, non portable sans le dossier `.decoupe`) ou dans un champ `order` du frontmatter (portable, mais réécrit plusieurs `.md` à chaque déplacement) ?

### 22. Boutons de tons pinyin
- [ ] Ajouter un bouton « Tons » dans la barre de mise en forme.
- [ ] Ouvrir un popover avec les quatre tons, le tréma `ü` et un champ de conversion `hao3` → `hǎo`.
- [ ] Appliquer le ton à la syllabe sélectionnée, ou au groupe de lettres qui précède le curseur.
- [ ] Placer automatiquement la marque selon la règle standard : `a`, puis `e`, puis `ou`, sinon la dernière voyelle.
- [ ] Gérer `v` / `u:` pour `ü`, les majuscules, le ton neutre et les nasales syllabiques.
- [ ] Utiliser une seule transaction d’édition pour que `Ctrl+Z` fonctionne normalement.
- [ ] Documenter PowerToys comme solution recommandée en attendant.

**Effort : S/M** — Environ 1,5 à 2 jours, tests compris. **Non planifié pour l’instant** : PowerToys couvre déjà la frappe courante, et la valeur ajoutée serait le placement automatique du ton. Décisions ouvertes : popover unique ou quatre boutons permanents, présence du champ de conversion, et intégration éventuelle dans la bulle de sélection.

### 23. Prise de notes multilingue (réflexion)
> Aucune implémentation planifiée. Objectif : identifier les conséquences d’un vault contenant plusieurs écritures avant d’ajouter une fonctionnalité.

**Ce qui fonctionne déjà**

- Le contenu, les tags, les wiki-liens et les noms d’espaces acceptent l’Unicode.
- La recherche par sous-chaîne fonctionne pour les écritures sans espaces (chinois, japonais).
- Les noms de dossiers non latins sont acceptés ; seuls les noms de fichiers de notes sont contraints.

**Points à trancher**

- [ ] **Noms de fichiers** : `slugify` ne conserve que l’ASCII ; un titre uniquement en sinogrammes produit `note.md`, `note-2.md`. Faut-il conserver les lettres Unicode, translittérer (pinyin, romaji) ou garder l’ASCII ?
- [ ] **Tri** : les notes, tags, espaces et suggestions utilisent `localeCompare(..., 'fr')` ; le chinois n’est pas trié par pinyin et le japonais mélange kana et kanji. Faut-il une locale par note, un réglage global ou un champ de lecture (`pinyin`, `romaji`) dans le frontmatter ?
- [ ] **Recherche globale** : insensible à la casse, mais pas aux accents, aux largeurs ni aux diacritiques (harakat arabes). Faut-il l’aligner sur `Ctrl+F`, qui replie déjà les accents ?
- [ ] **Équivalences d’écriture** : faut-il rapprocher hiragana et katakana, simplifié et traditionnel, ou les formes pleine et demi-largeur ?
- [ ] **Direction** : l’arabe, l’hébreu et le persan s’affichent, mais les paragraphes, listes et tableaux n’ont pas de `dir="auto"`. Faut-il une direction par paragraphe ou par note ?
- [ ] **Langue du document** : `index.html` et l’export PDF déclarent `lang="fr"` ; la césure et les lecteurs d’écran appliquent donc le français à toutes les notes. Faut-il un champ `lang` dans le frontmatter ?
- [ ] **Polices et PDF** : le PDF utilise une pile `Segoe UI / Roboto / Helvetica` ; sous Windows, le repli CJK et arabe fonctionne, ailleurs le rendu n’est pas garanti. Faut-il une liste explicite de polices de repli, sans embarquer une police CJK lourde ?
- [ ] **Mentions** : la détection exige une frontière avant et après le titre (ni lettre, ni chiffre, ni underscore) et un titre d’au moins 4 caractères ; en chinois ou en japonais, un nom collé à du texte sans espace n’est jamais détecté, et les noms de 2 à 3 caractères sont exclus. Faut-il une détection par sous-chaîne avec un seuil adapté à l’écriture ?
- [ ] **Saisie** : tester les IME (chinois, japonais, coréen, arabe) avec les raccourcis globaux et la barre de mise en forme ; les boutons de tons pinyin sont un cas particulier de la section 22.
- [ ] **Césure et mots longs** : vérifier l’allemand, le finnois et le thaï (sans espaces) dans l’éditeur et dans le PDF.

**Effort : inconnu** — À découper après des tests réels dans plusieurs écritures. Les chantiers les moins coûteux sont les noms de fichiers Unicode, la normalisation de la recherche globale et le `dir="auto"` ; le tri par pinyin et la détection de mentions CJK demandent plus de conception.

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
11. [x] Timeline narrative, exports PNG/PDF et confort de la barre latérale.
12. [x] Distribution technique : installateur NSIS, README, BUILD.md, licence MIT et CI.
13. [ ] Signature de code et première release publique.
14. [ ] Comparer deux notes côte à côte — 1.1.
15. [ ] Ordre manuel des cartes d’un espace — 1.2.
16. [ ] Boutons de tons pinyin — confort, sans version cible ; PowerToys reste la solution recommandée en attendant.
17. [ ] Prise de notes multilingue — réflexion à découper avant toute implémentation.

## Décisions à prendre

- Faut-il distribuer l'application à d'autres utilisateurs ? **Décision : oui, en open source.**
- Les sauvegardes doivent-elles être locales, ou s’appuyer sur le service de synchronisation du vault ?
- Faut-il autoriser la modification manuelle de la date de création ?
- Quel niveau de compatibilité Obsidian faut-il garantir pour les liens et le frontmatter ?
- Notes épinglées : **décision** frontmatter `pinned: true`, portable et lisible hors application.
- Comparaison de deux notes : **proposition** seconde note en lecture seule d’abord, deux panneaux éditables seulement si le besoin est confirmé.
- Ordre manuel des cartes : **à trancher** entre `.decoupe/order.json` et un champ `order` du frontmatter.
- Tons du pinyin : **décision** rester sur PowerToys pour l’instant ; les boutons intégrés restent une piste de confort sans version cible.
- Prise de notes multilingue : **à définir** — quelles écritures doivent être garanties (chinois, japonais, coréen, arabe, autres) et jusqu’où vont les équivalences de recherche et de tri.
- Noms de fichiers : **à trancher** entre conserver l’ASCII actuel et accepter les lettres Unicode dans les noms de notes.
