# Aide — Découpe

## Notes, espaces et Boîte d'entrée

Découpe ne range pas les notes dans une base de données : chaque note reste un fichier `.md` dans le dossier `Notes/` du vault. Un sous-dossier de `Notes/` devient un **espace**.

- **Boîte d'entrée** : notes placées directement dans `Notes/`, sans sous-dossier. Elle n'existe pas comme dossier sur le disque.
- **Espaces** : sous-dossiers réels de `Notes/`, par exemple `Personnages` ou `Chapitres`.
- **Toutes les notes** : vue transversale qui affiche les notes de tous les espaces.

Cliquer sur « Boîte d'entrée » filtre la liste sur les notes non classées ; le compteur à droite indique leur nombre. « Toutes les notes » affiche l'ensemble du vault.

La Boîte d'entrée sert de point d'arrivée par défaut. La capture rapide (`Ctrl + Alt + N`) y crée ses notes, tout comme une nouvelle note créée depuis « Boîte d'entrée » ou « Toutes les notes ». Pour ranger une note, glissez-la sur un espace dans la barre latérale. Pour l'en sortir, glissez-la sur « Boîte d'entrée » ou choisissez cette destination lors d'un déplacement.

Quand une note n'a pas d'espace, l'interface, l'export PDF, la corbeille et les liens entrants affichent « Boîte d'entrée » à la place d'un libellé vide. L'espace ouvert au lancement se choisit dans les Réglages.

---

## Trier et réordonner les notes

Le sélecteur en haut de la liste propose quatre modes : **Modifiée**, **Créée**, **Titre A→Z** et **Ordre manuel**.

- En **Ordre manuel**, glissez une carte au-dessus ou en dessous d'une autre : un trait d'insertion montre la position d'arrivée.
- Les notes **épinglées** restent groupées en tête ; le glisser réordonne à l'intérieur du groupe épinglé ou du groupe normal, sans faire passer une note d'un groupe à l'autre.
- Le menu contextuel d'une carte (clic droit) propose **Monter** et **Descendre**. Au clavier, `Alt + ↑` et `Alt + ↓` déplacent la note ouverte lorsque le focus n'est pas dans un champ de saisie.
- Le réordonnancement est désactivé pendant une recherche. Les notes absentes de l'ordre enregistré sont ajoutées à la fin de leur groupe.
- L'ordre est mémorisé par espace dans `.decoupe/order.json`. Il ne suit donc pas les notes si ce dossier n'est pas copié avec le vault ; un changement de nom d'espace met les chemins à jour.
- En vue **Toutes les notes**, l'ordre manuel est indisponible car plusieurs espaces ont chacun leur propre ordre.

Pour **fusionner** deux notes, utilisez `Alt + glisser` : la note déposée est intégrée à la note cible, puis mise à la corbeille. Le glisser simple ne fusionne plus, afin d'éviter une action destructive pendant un réordonnancement.

---

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

- le repère `Tableau 4×3` indique la taille du tableau (colonnes × lignes) et `L2·C3` la position courante ;
- `+ Ligne` et `+ Colonne` ajoutent une ligne sous la ligne courante ou une colonne à droite de la colonne courante ;
- `− Ligne`, `− Colonne` et `− Tableau` suppriment l'élément courant. Supprimer la ligne d'en-tête promeut la première ligne de contenu comme nouvel en-tête ; l'action est désactivée quand le tableau ne garderait qu'une seule ligne. `− Colonne` est désactivé quand il ne resterait plus qu'une colonne.

- `Tab` et `Maj+Tab` passent d'une cellule à l'autre.
- Quand un tableau commence ou termine la note, une ligne vide est automatiquement disponible au-dessus ou en dessous pour y écrire du texte. Elle ne laisse aucune trace dans le fichier Markdown.
- Le tableau reste du Markdown standard (GFM) : il est lisible hors de Découpe et repris dans l'export PDF. La première ligne sert toujours d'en-tête.

---

## Mention à lier

Dans le texte d'une note, le logiciel détecte automatiquement les mentions du nom d'un personnage (ex. `Alice traverse la cour.`). Si une note portant ce nom existe dans le vault, la mention apparaît dans la timeline comme une **apparition par mention** (`timeline-dot.is-mention`, contour gris). Pour transformer cette mention en **lien wiki** (`[[Alice]]`), éditez la note et remplacez le nom par la syntaxe wiki. Le lien devient alors une apparition directe (`timeline-dot.is-link`, point plein accent) et ouvre la note du personnage au clic.

---

## Rechercher dans la note

`Ctrl + F` (ou le bouton loupe de la barre de mise en forme) ouvre une barre de recherche dans la note ouverte.

- Saisissez un mot ou une expression : toutes les occurrences sont surlignées, l'occurrence courante d'une couleur plus marquée.
- Le compteur indique la position et le total (`3 / 12`) ; « Aucun résultat » s'affiche si le texte est absent.
- `Entrée` passe à l'occurrence suivante, `Maj + Entrée` à la précédente ; les flèches de la barre font la même chose.
- `Échap` (ou la croix) referme la barre et rend le focus au texte.
- La recherche ignore la casse et les accents (`elodie` trouve « Élodie ») et fonctionne aussi dans les tableaux et les blocs de code.

La recherche ne modifie pas le Markdown : les surlignages sont seulement visuels et n'apparaissent ni dans le fichier ni dans l'export PDF.

---

## Comparer deux notes

Une seconde note peut rester ouverte en lecture seule à côté de la note active, pour vérifier un détail, un nom ou une formulation sans perdre le fil.

- **Ouvrir la comparaison** : `Alt + clic` sur une carte de la liste, bouton colonnes dans l'en-tête de l'éditeur, ou palette `Ctrl + K` puis « Comparer avec une autre note… ».
- La note comparée s'affiche avec le même rendu que l'éditeur : tableaux, listes de tâches, images et wiki-liens. Elle ne peut pas être modifiée : le texte, les cases à cocher et les tableaux y sont figés.
- Cliquer un wiki-lien dans le panneau comparé ouvre sa cible **dans ce panneau**, sans changer la note active.
- La flèche du panneau comparé bascule cette note dans l'éditeur principal ; la croix referme la comparaison.
- Faire glisser le séparateur (ou le sélectionner au clavier avec `Tab` puis `←` / `→`) ajuste la largeur des deux panneaux. Cette largeur est mémorisée d'une session à l'autre.
- Sous 1280 pixels de large, les deux notes s'empilent verticalement et le séparateur disparaît.
- La comparaison se ferme d'elle-même si la note comparée devient la note active, est supprimée, déplacée ou si vous changez de vault.
- Hors périmètre pour l'instant : diff mot à mot, défilement synchronisé et comparaison de plus de deux notes.

---

## Masquer les panneaux (mode immersion)

Pour écrire sans distraction, la barre latérale et la liste des notes peuvent être masquées séparément.

- **Barre latérale** : bouton dans son en-tête, ou `Ctrl + Maj + B`.
- **Liste des notes** : poignée discrète sur son bord droit, ou `Ctrl + Maj + L`.
- Une fois une zone masquée, un rail discret apparaît sur le bord gauche de l'éditeur pour la rouvrir. Les mêmes actions sont disponibles dans la palette `Ctrl + K` (« Afficher la barre latérale », « Afficher la liste des notes »).
- L'état ouvert ou masqué est mémorisé d'une session à l'autre.
- L'éditeur occupe toute la largeur restante, mais le texte reste limité à la largeur de lecture réglée dans les Réglages.
- La comparaison, les liens entrants et la timeline continuent de fonctionner. Quand la liste est masquée, les flèches du clavier ne parcourent plus des cartes invisibles ; la palette reste le moyen rapide d'ouvrir une note.

---

## Commentaires

Découpe ne masque pas encore les commentaires Markdown. Les deux formes courantes sont conservées dans le fichier, mais restent visibles dans l'éditeur et dans l'export PDF :

- `<!-- commentaire -->` : la forme HTML standard, la plus portable ;
- `%% commentaire %%` : la forme utilisée par Obsidian, qui n'est pas du Markdown standard.

Ne les utilisez donc pas pour des remarques destinées à rester invisibles : elles apparaissent comme du texte. Pour une note personnelle hors du document, créez une note séparée dans le vault. Une prise en charge de vrais commentaires masqués est prévue pour une version ultérieure.

---

## Raccourcis utiles

- Timeline narrative : `Ctrl + Shift + T` (via palette de commandes)
- Recherche globale : `Ctrl + K`
- Recherche dans la note : `Ctrl + F`
- Comparer avec une autre note : `Alt + clic` sur une carte de la liste
- Réordonner la note ouverte en ordre manuel : `Alt + ↑` / `Alt + ↓`
- Fusionner une note : `Alt + glisser` sur la note cible
- Masquer ou afficher la barre latérale : `Ctrl + Maj + B`
- Masquer ou afficher la liste des notes : `Ctrl + Maj + L`
- Export PNG / PDF : boutons dans l'en-tête de la timeline
