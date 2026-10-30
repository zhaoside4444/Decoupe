# Construire et distribuer Découpe

Ce document décrit la chaîne de build, les artefacts produits et la vérification manuelle d'une release.

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

À faire sur une machine Windows propre (ou après désinstallation complète) :

1. **Installation** : lancer `Decoupe Setup <version>.exe`, vérifier le choix du dossier et la création des raccourcis.
2. **Premier lancement** : l'application s'ouvre sans erreur ; le sélecteur de dossier permet de créer un vault.
3. **Création de note** : créer une note, la modifier, fermer et rouvrir l'application : le contenu est conservé.
4. **Vault existant** : rouvrir un vault depuis le menu des dossiers récents, puis depuis « Choisir un autre dossier… ».
5. **Fonctions clés** : recherche, tags, liens wiki, corbeille avec restauration, export PDF, timeline narrative et son export PNG.
6. **Aide** : le bouton `?` affiche l'aide mise en forme (titres, listes, code inline).
7. **Désinstallation** : désinstaller depuis « Applications et fonctionnalités » ; les notes du vault doivent rester intactes.
8. **Archive ZIP** : décompresser, lancer `Decoupe.exe`, vérifier qu'un vault s'ouvre correctement.

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

Pour publier une release :

```bash
git tag v0.1.0
git push origin main --tags
```

Le workflow attaché au tag produit l'installateur. La publication GitHub Release reste une étape manuelle (ou à automatiser plus tard avec `--publish always` et un `GH_TOKEN`).

## Dépannage

- **Téléchargement d'Electron bloqué** : définir un miroir, par exemple `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/`, puis relancer `npm ci`.
- **electron-builder retélécharge NSIS** : vider `%LOCALAPPDATA%\electron-builder\Cache` uniquement en cas de cache corrompu ; sinon laisser le cache en place.
- **Chemin avec espaces ou caractères spéciaux** : préférer un chemin court (`C:\dev\decoupe`) pour le dépôt et le cache.
- **Erreur de types après changement de dépendances** : supprimer `node_modules` et `package-lock.json` n'est pas nécessaire ; relancer `npm ci` puis `npm run typecheck`.
- **L'installateur ne se lance pas** : vérifier la présence de `release/Decoupe Setup <version>.exe` et l'absence d'un antivirus qui bloque l'exécution depuis `release/`.
