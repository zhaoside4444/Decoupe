# Construire et distribuer Découpe

Ce document décrit la chaîne de build, les artefacts produits et la vérification manuelle d'une release. Pour la procédure de publication (version, tag, GitHub Release), voir [RELEASE.md](RELEASE.md).

## Prérequis

- **Node.js 22+** et npm.
- **Windows 10/11** pour l'installateur NSIS et l'archive ZIP (cibles principales).
- macOS pour un `dmg`, Linux pour un `AppImage` : les configurations existent, mais ces paquets ne sont pas encore validés.
- Réseau lors du **premier** packaging : electron-builder télécharge NSIS et ses outils dans son cache local.

## Installation

```bash
npm ci
```

`npm ci` installe exactement les versions de `package-lock.json`. Utiliser `npm install` uniquement pour modifier les dépendances.

## Vérifications avant build

```bash
npm run typecheck   # TypeScript web, node et tests
npm test            # Vitest
npm run build       # electron-vite build -> out/
```

Ces trois commandes sont aussi exécutées par la CI sur chaque push et chaque pull request.

## Lancer l'application

```bash
npm run dev     # développement, rechargement à chaud
npm start       # prévisualisation du build courant
```

## Construire les paquets

```bash
npm run dist
```

La commande compile puis appelle electron-builder avec `electron-builder.yml`. Les artefacts sont écrits dans `release/` (ignoré par Git).

Sous Windows, la configuration produit :

| Artefact | Description |
| --- | --- |
| `release/Decoupe Setup <version>.exe` | Installateur NSIS, installation par utilisateur, choix du dossier, raccourcis bureau et menu Démarrer. |
| `release/*.zip` | Archive portable, à décompresser et lancer sans installation. |
| `release/win-unpacked/Decoupe.exe` | Build non empaqueté, utile pour le débogage. |

L'installateur NSIS est configuré avec `oneClick: false` et `perMachine: false` : il ne demande pas de droits administrateur et s'installe dans le profil de l'utilisateur.

### Cibler une plateforme

```bash
npx electron-builder --win     # Windows (zip + nsis)
npx electron-builder --mac     # macOS (dmg)
npx electron-builder --linux   # Linux (AppImage)
```

En pratique, construire chaque plateforme sur son système : le packaging croisé macOS depuis Windows n'est pas pris en charge.

### Options utiles

```bash
npx electron-builder --dir                 # dossier non empaqueté seulement
npx electron-builder --publish never       # jamais de publication automatique
npx electron-builder --config electron-builder.yml
```

## Contenu du paquet

`electron-builder.yml` inclut uniquement :

- `out/**` (main, preload, renderer compilés) ;
- `build/icon.png` ;
- `package.json`.

L'aide (`AIDE.md`) est inlinée dans le bundle du renderer au build : elle n'a pas besoin d'être copiée séparément.

## Checklist de validation manuelle

À faire sur une machine Windows propre (ou après désinstallation complète). Cette liste sert de test d'acceptation avant publication ; la procédure complète est décrite dans [RELEASE.md](RELEASE.md).

1. **Installation** : lancer `Decoupe Setup <version>.exe`, vérifier le choix du dossier, l'absence de droits administrateur et la création des raccourcis.
2. **Premier lancement** : l'application s'ouvre sans erreur ; le sélecteur de dossier permet de créer un vault.
3. **Création de note** : créer une note, la modifier, fermer et rouvrir l'application : le contenu est conservé.
4. **Édition** : mettre en forme, insérer un lien, un tableau et une image collée ; vérifier l'annulation/rétablissement et le raccourci `Ctrl + F` dans une note.
5. **Tableaux** : insérer un tableau, ajouter/supprimer une ligne et une colonne, supprimer l'en-tête, écrire du texte avant et après un tableau en début/fin de note.
6. **Recherche et organisation** : recherche globale par texte, tag et date ; tri, épinglage, sélection multiple et déplacement entre espaces.
7. **Liens** : wiki-liens avec autocomplétion, liens entrants, mentions à lier et notes liées.
8. **Vault existant** : rouvrir un vault depuis les dossiers récents, puis depuis « Choisir un autre dossier… », y compris un chemin avec espaces, accents ou dans OneDrive.
9. **Sauvegardes** : créer une sauvegarde, la restaurer, vérifier la rétention et l'intégrité des notes.
10. **Modification externe** : modifier la note ouverte hors de l'application ; vérifier le dialogue de conflit et les deux choix proposés.
11. **Corbeille** : supprimer une note et un espace, les restaurer, puis tester la purge définitive avec confirmation.
12. **Capture rapide** : créer une note depuis `Ctrl + Alt + N` et vérifier son arrivée dans la Boîte d'entrée.
13. **Export** : exporter une note en PDF ; ouvrir la timeline narrative, tester filtre, mode compact et exports PNG/PDF.
14. **Aide** : le bouton `?` affiche l'aide mise en forme, notamment les sections Boîte d'entrée et Rechercher dans la note.
15. **Mise à jour** : si une version antérieure est installée, vérifier que la nouvelle s'installe par-dessus sans perdre les réglages ni les notes.
16. **Désinstallation** : désinstaller depuis « Applications et fonctionnalités » ; les notes du vault doivent rester intactes.
17. **Archive ZIP** : décompresser, lancer `Decoupe.exe`, vérifier qu'un vault s'ouvre correctement.

Noter la version testée et le système dans la description de la release.

## Signature de code

La signature est **hors périmètre pour l'instant** :

- `electron-builder.yml` contient `signAndEditExecutable: false` et aucune identité de signature n'est configurée ;
- Windows peut afficher un avertissement SmartScreen au premier lancement ;
- ne pas ajouter de secrets de signature au dépôt.

Pistes gratuites ou peu coûteuses pour la suite : SignPath (open source) et Azure Trusted Signing. Une fois un certificat disponible, la signature s'active via les variables d'environnement standard d'electron-builder (`CSC_LINK`, `CSC_KEY_PASSWORD`) sans modifier le code.

## Intégration continue

`.github/workflows/ci.yml` :

- sur **push** et **pull request** : `npm ci`, `npm run typecheck`, `npm test`, `npm run build` sous Ubuntu avec Node 22 ;
- sur un **tag `v*`** : le job de vérification puis un packaging Windows qui publie `release/*.exe` et `release/*.zip` comme artefact de workflow.

Pour publier une release, suivre la procédure détaillée de [RELEASE.md](RELEASE.md) :

```bash
git tag -a v1.0.0 -m "Découpe 1.0.0"
git push origin main --tags
```

Le workflow attaché au tag produit l'installateur. La publication GitHub Release reste une étape manuelle (ou à automatiser plus tard avec `--publish always` et un `GH_TOKEN`).

## Dépannage

- **Téléchargement d'Electron bloqué** : définir un miroir, par exemple `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/`, puis relancer `npm ci`.
- **electron-builder retélécharge NSIS** : vider `%LOCALAPPDATA%\electron-builder\Cache` uniquement en cas de cache corrompu ; sinon laisser le cache en place.
- **Chemin avec espaces ou caractères spéciaux** : préférer un chemin court (`C:\dev\decoupe`) pour le dépôt et le cache.
- **Erreur de types après changement de dépendances** : supprimer `node_modules` et `package-lock.json` n'est pas nécessaire ; relancer `npm ci` puis `npm run typecheck`.
- **L'installateur ne se lance pas** : vérifier la présence de `release/Decoupe Setup <version>.exe` et l'absence d'un antivirus qui bloque l'exécution depuis `release/`.
