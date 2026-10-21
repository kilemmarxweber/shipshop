# PRODUCT REQUIREMENTS DOCUMENT (PRD)
## Module de vidéos courtes — Application Next.js

**Version :** 1.0  
**Produit :** Fil de vidéos courtes optimisé Web  
**Plateforme :** Web mobile et desktop

## 1. Vision du produit

Permettre aux utilisateurs de découvrir et de regarder des vidéos courtes dans une interface simple, rapide et fluide, sans imposer le téléchargement simultané de tous les médias.

Le produit doit privilégier une expérience mobile-first, une lecture intuitive et une consommation maîtrisée des données.

## 2. Problème à résoudre

Les fils vidéo peuvent devenir lourds lorsque plusieurs vidéos sont chargées simultanément, lorsque les fichiers sont trop volumineux ou lorsque le navigateur doit gérer un trop grand nombre d'éléments multimédias.

Le système doit résoudre ces problèmes grâce à une stratégie de chargement, de compression, de stockage et de lecture adaptée.

## 3. Public cible

- Utilisateurs mobiles consultant régulièrement des vidéos.
- Utilisateurs disposant de connexions Internet limitées.
- Créateurs ou administrateurs publiant des vidéos.
- Équipe technique chargée de maintenir et de faire évoluer l'application.

## 4. Objectifs produit

- Rendre la consultation des vidéos simple et intuitive.
- Réduire le volume de données inutilement transférées.
- Limiter le nombre de vidéos actives simultanément.
- Réduire les échecs de lecture.
- Préparer l'ajout de fonctionnalités sociales.
- Maintenir un coût de diffusion maîtrisé.

## 5. Parcours utilisateur principal

1. L'utilisateur ouvre la page des vidéos.
2. Le système affiche les premières miniatures.
3. La vidéo principalement visible devient la vidéo active.
4. La lecture démarre automatiquement lorsque le navigateur l'autorise.
5. Lorsque l'utilisateur fait défiler le fil, l'ancienne vidéo est mise en pause.
6. La vidéo suivante est activée et chargée selon les besoins.
7. En cas d'erreur, un message adapté est affiché.
8. Le système charge progressivement d'autres éléments lorsque l'utilisateur approche de la fin des vidéos disponibles.

## 6. Exigences fonctionnelles

### F-01 — Fil vertical
Le système doit afficher les vidéos dans un fil vertical, avec un défilement fluide et une navigation adaptée aux appareils mobiles.

### F-02 — Lecture unique
Le système doit privilégier une seule vidéo active à la fois. Les autres vidéos du fil doivent être mises en pause.

### F-03 — Détection de visibilité
Le système doit identifier la vidéo principalement visible à l'aide d'Intersection Observer ou d'un mécanisme équivalent.

### F-04 — Chargement différé
Les vidéos hors écran ne doivent pas être téléchargées inutilement. La stratégie de préchargement doit être configurable.

### F-05 — Miniatures
Chaque vidéo publiée doit pouvoir être associée à une miniature optimisée. Celle-ci doit rester visible pendant le chargement initial.

### F-06 — Compression
Le système doit produire une version de diffusion compatible avec les navigateurs ciblés, dans le respect des limites de durée et de qualité configurées.

### F-07 — Publication
Le système doit valider les fichiers avant leur publication et exposer un état de traitement : en attente, en traitement, prêt ou en échec.

### F-08 — Métadonnées
Chaque vidéo doit posséder au minimum un identifiant, une URL de diffusion, une URL de miniature, une durée, un état de publication et une date de création.

### F-09 — Gestion des erreurs
Le système doit traiter les erreurs de chargement, les formats non pris en charge, les fichiers absents et les échecs de conversion.

### F-10 — Pagination
Le système doit récupérer les vidéos par lots afin d'éviter de charger toute la bibliothèque au démarrage.

### F-11 — Accessibilité
Les commandes de lecture doivent être accessibles au clavier lorsque cela est applicable. Les vidéos avec dialogue important devraient pouvoir disposer de sous-titres.

### F-12 — Administration et modération
Les mécanismes de suppression, de signalement et de contrôle des contenus seront ajoutés selon les besoins métier et les règles de publication.

## 7. Exigences non fonctionnelles

### Performance
- Prioriser la vidéo visible et la miniature initiale.
- Éviter les rendus et requêtes inutiles.
- Limiter le nombre d'éléments montés simultanément.
- Utiliser les mécanismes de cache et de diffusion adaptés.
- Mesurer le délai de démarrage de la lecture, les erreurs et la consommation de données.

### Compatibilité
- Navigateurs modernes sur Android, iOS, Windows et macOS.
- Mise en page responsive.
- Gestion des restrictions d'autoplay propres aux navigateurs.

### Fiabilité
- Un échec de lecture ne doit pas bloquer l'ensemble du fil.
- Les traitements vidéo échoués doivent pouvoir être relancés.
- Les URL et métadonnées doivent être vérifiées avant publication.

### Sécurité
- Accès contrôlé aux opérations d'upload et de suppression.
- Limites de taille et de durée appliquées côté serveur.
- Contrôle des formats, authentification et autorisations.
- Protection contre les fichiers malveillants et les abus.

## 8. Paramètres média initiaux

| Paramètre | Valeur cible |
|---|---|
| Durée maximale | 60 secondes |
| Résolution de diffusion | 720 × 1280 pour le portrait |
| Fréquence d'images | 30 FPS |
| Codec vidéo | H.264 |
| Audio | AAC |
| Conteneur | MP4 |
| Poids cible | 3–8 Mo pour 30 secondes |
| Miniature | WebP, AVIF ou JPEG |
| Préchargement | Aucun par défaut pour les vidéos inactives |

Ces paramètres constituent des valeurs de départ et doivent être validés sur des vidéos réelles.

## 9. Modèle de données indicatif

### Entité Video

- `id` : identifiant unique.
- `title` : titre facultatif.
- `description` : description facultative.
- `playbackUrl` : URL du fichier de diffusion.
- `thumbnailUrl` : URL de la miniature.
- `durationSeconds` : durée de la vidéo.
- `width` et `height` : dimensions de diffusion.
- `status` : état de traitement et de publication.
- `creatorId` : référence au créateur, si applicable.
- `createdAt` : date de création.
- `publishedAt` : date de publication.

Les champs et types définitifs seront adaptés à la base de données existante.

## 10. Architecture fonctionnelle

### Frontend Next.js
Affichage du fil, visibilité des vidéos, lecture et pause, états de chargement et gestion des erreurs.

### API et logique métier
Validation des requêtes, authentification, autorisations, récupération paginée des vidéos et gestion des métadonnées.

### Traitement média
Conversion vidéo, génération des miniatures, contrôle de durée et publication après traitement réussi.

### Stockage et diffusion
Stockage objet pour les fichiers, CDN si disponible et URLs adaptées aux règles d'accès.

Le traitement lourd des vidéos doit être exécuté dans un worker ou un service approprié plutôt que dans une requête HTTP de longue durée.

## 11. Indicateurs de réussite

Les indicateurs suivants doivent être mesurés lors des tests et en production :

- Temps médian entre l'activation d'une vidéo et le démarrage de la lecture.
- Taux d'erreur de lecture.
- Volume moyen de données transférées par vidéo visionnée.
- Taux de réussite du traitement vidéo.
- Consommation mémoire et stabilité du navigateur.
- Temps de réponse de l'API de récupération des vidéos.

Les objectifs chiffrés seront établis après une première mesure de référence. Les seuils de performance doivent être définis pour des appareils et des conditions réseau représentatifs du public cible.

## 12. Périmètre MVP

### Inclus
- Fil vertical.
- Lecture et pause.
- Détection de visibilité.
- Miniatures.
- Compression vidéo.
- Stockage et diffusion.
- Pagination.
- Gestion des erreurs.
- Tests et documentation.

### Exclu de la première version
- Algorithme avancé de recommandation.
- Diffusion en direct.
- Montage vidéo intégré.
- Éditeur de filtres.
- Monétisation.
- Diffusion adaptative HLS/DASH, sauf besoin identifié dès la première version.

## 13. Critères d'acceptation

- Une vidéo valide peut être publiée et visionnée.
- Les vidéos inactives sont mises en pause.
- Les miniatures sont affichées avant la lecture.
- Le fil ne récupère pas toute la bibliothèque en une seule requête.
- Les fichiers non conformes sont refusés.
- Les erreurs de chargement sont gérées sans interrompre toute la page.
- Les performances sont mesurées sur mobile et desktop.
- Les objectifs de performance convenus sont documentés et vérifiés.

## 14. Risques et mesures d'atténuation

- **Fichiers trop lourds :** ajuster la compression et mesurer la qualité.
- **Réseau lent :** limiter les transferts inutiles et envisager un streaming adaptatif.
- **Coût de bande passante :** utiliser le cache et un CDN adapté.
- **Temps de traitement élevé :** mettre en place une file de traitement asynchrone.
- **Autoplay bloqué :** prévoir un contrôle de lecture manuel.
- **Bibliothèque volumineuse :** paginer les données et limiter les composants montés.

## 15. Décisions à confirmer

Avant le développement définitif, confirmer :
- La version de Next.js et le mode de routage.
- La base de données et l'authentification.
- La solution de stockage vidéo.
- Le processus d'upload existant.
- Le nombre prévisionnel de vidéos et de visionnages.
- Les fonctionnalités sociales requises.
- Les objectifs de performance et le budget d'infrastructure.

## 16. Résultat attendu

Une première version fiable du module de vidéos courtes, avec une architecture permettant d'évoluer vers une plateforme sociale complète sans devoir reconstruire le mécanisme central de lecture et de diffusion.