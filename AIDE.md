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

## Changement rapide de dossier (vault switcher)

Le bouton dans la barre latérale (`FolderOpen`) ouvre un menu rapide avec les 5 derniers dossiers ouverts (`localStorage` : `recentVaults`). Entrez le numéro du dossier dans le prompt, ou tapez le chemin complet. Le dossier est enregistré automatiquement à chaque ouverture (`applyVault`).

---

## Mention à lier

Dans le texte d'une note, le logiciel détecte automatiquement les mentions du nom d'un personnage (ex. `Alice traverse la cour.`). Si une note portant ce nom existe dans le vault, la mention apparaît dans la timeline comme une **apparition par mention** (`timeline-dot.is-mention`, contour gris). Pour transformer cette mention en **lien wiki** (`[[Alice]]`), éditez la note et remplacez le nom par la syntaxe wiki. Le lien devient alors une apparition directe (`timeline-dot.is-link`, point plein accent) et ouvre la note du personnage au clic.

---

## Raccourcis utiles

- Timeline narrative : `Ctrl + Shift + T` (via palette de commandes)
- Recherche : `Ctrl + K`
- Export PNG / PDF : boutons dans l'en-tête de la timeline
