# Publier une release de Découpe

Cette procédure couvre la préparation, la vérification et la publication d'une version. Pour construire les paquets et comprendre les artefacts, voir [BUILD.md](BUILD.md). Pour l'historique des changements, voir [CHANGELOG.md](CHANGELOG.md).

## 1. Préparer la version

1. Choisir le numéro selon le versionnage sémantique (voir la fin de `CHANGELOG.md`).
2. Mettre à jour le numéro dans :
   - `package.json` ;
   - `package-lock.json` (les deux entrées racine : `version` en tête et `packages[""].version`) ;
   - `README.md` (section « État du projet ») ;
   - `ROADMAP.md` (en-tête) ;
   - `CHANGELOG.md` (nouvelle section datée).
3. Vérifier que la CI ne référence pas une ancienne version et que `BUILD.md` / `RELEASE.md` restent cohérents.
4. Relire le `CHANGELOG.md` : il doit décrire ce que l'utilisateur verra, pas seulement les commits.

## 2. Vérifier localement

```bash
git status                 # arbre propre, aucun fichier oublié
npm ci
npm run typecheck
npm test
npm run build
```

Puis construire les paquets :

```bash
Remove-Item -Recurse -Force release   # PowerShell : repartir d'un dossier propre
npm run dist
```

Contrôler la présence et la taille des artefacts :

```text
release/Decoupe Setup <version>.exe
release/Decoupe-<version>-win.zip
release/Decoupe Setup <version>.exe.blockmap
```

Calculer les empreintes pour la release :

```powershell
Get-FileHash "release/Decoupe Setup <version>.exe" -Algorithm SHA256
Get-FileHash "release/Decoupe-<version>-win.zip" -Algorithm SHA256
```

### Test d'acceptation manuel

Suivre la checklist de [BUILD.md](BUILD.md#checklist-de-validation-manuelle) sur une machine Windows propre ou une machine virtuelle, avec au minimum :

- installation, premier lancement et création d'un vault ;
- création/modification de note, tableau, recherche `Ctrl + F` ;
- sauvegarde puis restauration ;
- conflit de modification externe ;
- corbeille et restauration ;
- export PDF et timeline ;
- désinstallation en conservant le vault ;
- archive ZIP portable.

Tester aussi un vault dans un chemin avec espaces, accents ou dans OneDrive.

## 3. Créer le dépôt distant et activer la CI

La CI existe dans `.github/workflows/ci.yml`, mais elle ne s'exécute qu'après la création du dépôt distant.

```bash
git remote add origin https://github.com/<owner>/<repo>.git
git push -u origin main
```

Vérifier sur GitHub que le job « Vérification » passe (typecheck, tests, build). Ne pas continuer si la CI est rouge.

## 4. Étiqueter et publier

1. Créer un tag annoté sur le commit validé :

   ```bash
   git tag -a v1.0.0 -m "Découpe 1.0.0"
   git push origin v1.0.0
   ```

2. Attendre la fin du workflow « Paquet Windows » déclenché par le tag.
3. Télécharger l'artefact `decoupe-windows-v1.0.0` depuis l'onglet Actions.
4. Comparer les empreintes SHA256 avec celles calculées localement.
5. Créer la GitHub Release :
   - titre : `Découpe 1.0.0` ;
   - description : recopier la section correspondante de `CHANGELOG.md`, avec la mention « Première version publique » le cas échéant ;
   - joindre l'installateur `.exe`, l'archive `.zip` et le `.blockmap` ;
   - cocher « Set as the latest release » ;
   - préciser que la signature de code n'est pas encore en place et que SmartScreen peut afficher un avertissement.
6. Publier, puis vérifier que les liens de téléchargement fonctionnent.

## 5. Après la publication

1. Télécharger l'installateur depuis la page de release, pas depuis le dossier local.
2. L'installer sur une machine propre et refaire un smoke test : ouverture, création de note, fermeture, réouverture.
3. Vérifier que le vault et les réglages n'ont pas été altérés.
4. Annoncer la release et surveiller les premières remontées (installation, SmartScreen, chemins de vault, sauvegardes).
5. Ouvrir les issues à partir des retours réels ; ne pas empiler de nouvelles fonctionnalités avant d'avoir stabilisé cette version.

## 6. En cas de problème

- **Avant l'annonce** : supprimer la GitHub Release et le tag si nécessaire, corriger, puis republier avec une nouvelle version.
- **Après l'annonce** : ne jamais déplacer un tag existant. Publier un correctif (`1.0.1`) et marquer la version défectueuse comme obsolète dans la release.
- **Artefact corrompu ou absent** : relancer le workflow du tag ; si le tag est déjà publié, créer un nouveau tag de correctif.
- **CI indisponible** : construire localement avec `npm run dist`, vérifier les empreintes et joindre les fichiers manuellement.

## Signature de code (optionnelle)

La signature n'est pas requise pour publier, mais elle améliore l'expérience au premier lancement. Une fois un certificat disponible, renseigner les variables standard d'electron-builder (`CSC_LINK`, `CSC_KEY_PASSWORD`) et retirer `signExecutable: false` de `electron-builder.yml` (cette option conserve l'icône et les métadonnées tout en désactivant la signature). Ne jamais committer de certificat ni de mot de passe.

Pistes pour un projet open source : SignPath et Azure Trusted Signing. La signature peut être ajoutée après la première release, sans changer le format des vaults.
