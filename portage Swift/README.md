# MindMapSwift

Portage SwiftUI natif de l'application de mind map Markdown.

## Ouvrir dans Xcode

1. Ouvrir `MindMapSwift.xcodeproj`.
2. Choisir le schéma `MindMapSwift`.
3. Brancher l'iPhone.
4. Sélectionner l'iPhone comme destination.
5. Cliquer sur Run.

Si Xcode demande une équipe de signature, sélectionner votre compte Apple dans `Signing & Capabilities`.

## Fonctionnalités portées

- Import Markdown depuis Fichiers.
- Création d'une carte depuis un titre.
- Carte zoomable au pincement, déplaçable au doigt ou au trackpad.
- Recentrage, ajustement à l'écran, vue horloge et vue droite.
- Recherche de nœuds avec navigation précédent/suivant.
- Sélection d'un nœud par tap avec expansion du niveau suivant.
- Ajout enfant, ajout frère, renommage et suppression.
- Ajout chaîné `OK`, `OK + enfant`, `OK + frère`.
- Édition directe de la source Markdown.
- Enregistrement local des cartes.
- Archive et restauration automatique vers les cartes enregistrées au prochain enregistrement.
- Modèles intégrés.

## Vérifications réalisées

Depuis ce dossier :

```sh
xcodebuild -project MindMapSwift.xcodeproj -scheme MindMapSwift -sdk iphoneos26.5 CODE_SIGNING_ALLOWED=NO build
xcodebuild -project MindMapSwift.xcodeproj -scheme MindMapSwift -destination 'platform=macOS,variant=Mac Catalyst,name=My Mac' CODE_SIGNING_ALLOWED=NO test
```

Note : la machine actuelle signale un CoreSimulator légèrement désynchronisé avec Xcode. Les tests ont donc été lancés en Mac Catalyst, et le build iPhone générique a été validé.
