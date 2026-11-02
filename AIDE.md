# Aide — Découpe

## Timeline narrative (écriture de livres)

Pour utiliser la timeline, vos notes doivent suivre cette convention :

- **Personnages** : taguez la note avec `#personnage` ou placez-la dans un espace nommé `Personnages` / `Characters`.
- **Chapitres** : taguez la note avec `#chapitre` ou `#chapter` ou placez-la dans un espace `Chapitres` / `Chapters`.
- **Références** : dans le corps du chapitre, mentionnez le personnage via un lien wiki : `[[Alice]]`.

L'application détecte automatiquement :
- Les **liens wiki** (`[[Alice]]`) comme apparition directe.
- Les **tags partagés** (ex. `#enquête` sur le chapitre et le personnage) comme relation par thème.
- Les **mentions** du nom du personnage dans le texte (ex. « Alice traverse la cour ») comme apparition contextuelle.

### Interactions
- **Filtre** (champ `Filtrer…`) : recherche en temps réel sur noms de personnages et titres de chapitres (insensible aux accents).
- **Mode compact** : bouton avec icônes `Rows2`/`Rows3` pour réduire la hauteur des lignes (`localStorage`).
- **Légende interactive** : chaque puce affiche le nombre d'apparitions ; cliquer isole la ligne du personnage, un second clic rétablit tout.
- **Navigation clavier** : `↑`/`↓` (personnages), `←`/`→` (apparitions d'un personnage), `Entrée` (ouvrir le chapitre), `Échap` (fermer).
- **Zoom / Pan** : activé automatiquement au-delà de 50 colonnes. `Ctrl + molette` pour zoomer, `glisser` sur le fond du SVG pour se déplacer. Un bouton `Réinitialiser` dans le pied restaure la vue.

### Export
- **PNG** (`Save`) : clone du SVG avec styles inlinés et fond blanc, enregistré via `dialog.showSaveDialog`.
- **PDF** (`FileText`) : même clone injecté dans un document HTML (A4 paysage), rendu via `printToPDF`.

---

## Changer de dossier (vault switcher)

Le bouton `FolderOpen` dans l'en-tête de la barre latérale ouvre un menu listant les 5 derniers dossiers utilisés (`localStorage` : `recentVaults`). Le dossier courant porte le badge « actuel ». Choisir un autre dossier bascule immédiatement dessus ; « Choisir un autre dossier… » ouvre le sélecteur système. Le dossier est enregistré automatiquement à chaque ouverture (`applyVault`).

## Créer un dossier

Le bouton `Plus` à droite du libellé « Espaces » ouvre le champ « Nom du dossier ». `Entrée` crée le dossier et l'ajoute à la barre latérale ; `Échap` ou un clic hors du champ vide annule.

## Barre latérale au clavier

- `Tab` parcourt les éléments ; `Entrée` ou `Espace` ouvre un dossier ou applique un filtre de tag.
- Les boutons crayon et poubelle d'une ligne sont atteignables au clavier sans changer la sélection.
- `Échap` ferme le menu des dossiers et rend le focus au bouton.

---

## Tableaux

Le bouton `Table2` de la barre de mise en forme ouvre un sélecteur de taille : survolez la grille jusqu'à la taille voulue (colonnes × lignes), puis cliquez pour insérer le tableau. Aucune syntaxe Markdown n'est nécessaire.

Lorsque le curseur est dans un tableau, un groupe **Tableau** apparaît dans la barre de mise en forme :

- le repère `Tableau 2·3` indique la ligne et la colonne courantes ;
- `+ Ligne` et `+ Colonne` ajoutent une ligne sous la ligne courante ou une colonne à droite de la colonne courante ;
- `− Ligne`, `− Colonne` et `− Tableau` suppriment l'élément courant ; les deux premiers sont désactivés quand il ne resterait plus aucune ligne ou colonne.

- `Tab` et `Maj+Tab` passent d'une cellule à l'autre.
- Le tableau reste du Markdown standard (GFM) : il est lisible hors de Découpe et repris dans l'export PDF.

---

## Mention à lier

Dans le texte d'une note, le logiciel détecte automatiquement les mentions du nom d'un personnage (ex. `Alice traverse la cour.`). Si une note portant ce nom existe dans le vault, la mention apparaît dans la timeline comme une **apparition par mention** (`timeline-dot.is-mention`, contour gris). Pour transformer cette mention en **lien wiki** (`[[Alice]]`), éditez la note et remplacez le nom par la syntaxe wiki. Le lien devient alors une apparition directe (`timeline-dot.is-link`, point plein accent) et ouvre la note du personnage au clic.

---

## Raccourcis utiles

- Timeline narrative : `Ctrl + Shift + T` (via palette de commandes)
- Recherche : `Ctrl + K`
- Export PNG / PDF : boutons dans l'en-tête de la timeline
