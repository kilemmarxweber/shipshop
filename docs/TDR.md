# TERMES DE RÉFÉRENCE (TDR)
## Développement d'un système de vidéos courtes optimisé pour le Web avec Next.js

**Version :** 1.0  
**Statut :** Document de cadrage initial

## 1. Contexte et justification

Le projet consiste à développer un système de diffusion de vidéos courtes inspiré des expériences de navigation de TikTok et Reels, intégré à une application Web utilisant Next.js.

Le système doit offrir une lecture fluide, un défilement vertical intuitif et une consommation raisonnable de bande passante, notamment sur les appareils mobiles et les connexions Internet limitées.

Une attention particulière sera accordée à la compression des fichiers, au chargement différé, aux miniatures, à la gestion de la lecture automatique et à l'optimisation de la diffusion.

## 2. Objectif général

Concevoir et mettre en production un module de vidéos courtes performant, sécurisé, maintenable et évolutif, compatible avec les navigateurs modernes.

## 3. Objectifs spécifiques

- Permettre la diffusion de vidéos courtes dans un fil vertical.
- Limiter le chargement aux vidéos nécessaires à l'expérience immédiate.
- Mettre automatiquement en lecture la vidéo principalement visible.
- Suspendre la lecture des vidéos qui quittent la zone visible.
- Compresser les vidéos avant leur publication.
- Générer et utiliser des miniatures.
- Organiser le stockage des médias indépendamment du serveur applicatif.
- Préparer l'intégration future de fonctionnalités sociales et de recommandations.

## 4. Périmètre fonctionnel

### 4.1 Fonctionnalités incluses dans le MVP

- Affichage d'un fil de vidéos vertical.
- Lecture, pause et répétition des vidéos.
- Détection de la vidéo visible avec Intersection Observer.
- Chargement différé et préchargement maîtrisé.
- Affichage d'une miniature avant la lecture.
- Conversion des vidéos vers un format Web compatible.
- Limitation configurable de la durée des vidéos.
- Gestion des erreurs de lecture et des fichiers indisponibles.
- Stockage des métadonnées et des URL des médias.
- Pagination ou chargement progressif du fil.

### 4.2 Fonctionnalités à prévoir ultérieurement

- Aimer, commenter et partager les vidéos.
- Abonnement aux créateurs.
- Comptes utilisateurs et profils de créateurs.
- Recherche et catégories.
- Système de recommandation.
- Modération et signalement.
- Statistiques de visionnage.
- Diffusion adaptative HLS ou DASH.

## 5. Architecture technique envisagée

- **Frontend :** Next.js, React et TypeScript.
- **Interface :** Tailwind CSS ou système de styles existant.
- **API :** Route Handlers Next.js ou backend existant.
- **Base de données :** selon l'architecture actuelle du projet.
- **Stockage média :** stockage objet ou service spécialisé.
- **Diffusion :** CDN lorsque disponible.
- **Traitement vidéo :** FFmpeg côté serveur, worker dédié ou service spécialisé.
- **Observabilité :** journalisation des erreurs et mesure des performances.

Les vidéos ne doivent pas être stockées directement dans la base de données sous forme de fichiers binaires pour le fonctionnement standard. La base conserve principalement les métadonnées et les références aux fichiers.

## 6. Exigences techniques initiales

### Vidéos

- Durée maximale initiale : 60 secondes, configurable.
- Résolution cible : 720 × 1280 pixels pour les vidéos verticales.
- Fréquence cible : 30 images par seconde.
- Format de sortie : MP4 avec H.264 et audio AAC.
- Poids cible indicatif : 3 à 8 Mo pour 30 secondes.
- Miniatures optimisées en JPEG, WebP ou AVIF selon les besoins.
- Conservation éventuelle de l'original selon les règles métier et les coûts de stockage.

La durée, la résolution et le poids doivent être configurables. La taille finale dépend du contenu et des paramètres de compression.

### Performance

- La vidéo visible est prioritaire.
- Les vidéos hors écran sont mises en pause.
- Le chargement de médias non nécessaires est évité.
- La pagination limite le nombre d'éléments rendus simultanément.
- Les fichiers média bénéficient du cache HTTP et des capacités de diffusion du stockage/CDN.
- La lecture doit fonctionner sur mobile et ordinateur.

### Sécurité

- Validation de la taille, de la durée et du contenu des fichiers.
- Contrôle des autorisations d'upload et de suppression.
- Protection des endpoints et limitation des abus.
- Vérification du type réel des fichiers, pas uniquement de leur extension.
- Gestion des fichiers temporaires et des échecs de traitement.
- Contrôle des droits d'accès aux médias privés, si nécessaire.

## 7. Livrables attendus

1. Spécifications fonctionnelles et techniques.
2. Composant de fil vidéo réutilisable.
3. Module de lecture optimisé.
4. Pipeline de compression et génération des miniatures.
5. Modèle de données et endpoints nécessaires.
6. Configuration de stockage et de diffusion.
7. Tests fonctionnels, techniques et de performance.
8. Documentation d'installation et de déploiement.
9. Rapport de validation et recommandations d'évolution.

## 8. Phases de réalisation

### Phase 1 — Analyse
Audit de l'application existante, des dépendances, du stockage et de la base de données.

### Phase 2 — Conception
Définition des composants, du modèle de données, des règles de compression et du flux de publication.

### Phase 3 — Développement
Implémentation du fil vidéo, de la lecture, du chargement différé et de l'intégration au stockage.

### Phase 4 — Traitement des médias
Mise en place de la conversion, des miniatures, des contrôles de validité et de la gestion des erreurs.

### Phase 5 — Tests
Vérification sur plusieurs navigateurs, appareils, résolutions et conditions réseau.

### Phase 6 — Déploiement
Mise en production, surveillance et documentation.

## 9. Critères de réception

Le module est accepté lorsque :

- Les vidéos conformes sont lisibles sur les navigateurs ciblés.
- La vidéo visible peut démarrer sans déclencher la lecture de toutes les autres.
- Les vidéos hors écran sont mises en pause.
- Les miniatures sont affichées avant le chargement ou la lecture.
- Les vidéos rejetées sont accompagnées d'une erreur compréhensible.
- Les fichiers sont servis depuis le stockage prévu.
- La pagination évite le rendu d'un nombre illimité de vidéos.
- Les tests de sécurité et de performance définis pour le projet sont validés.

## 10. Hypothèses et dépendances

Le développement devra tenir compte de la version de Next.js, du système d'authentification, de la base de données, de l'hébergeur et des solutions de stockage déjà utilisées.

Les coûts d'hébergement, de stockage, de traitement vidéo et de transfert CDN seront évalués avant le déploiement à grande échelle.

## 11. Résultat attendu

Un module vidéo opérationnel, documenté et évolutif, capable de proposer une expérience de navigation fluide tout en maîtrisant les ressources réseau, le poids des fichiers et la charge du navigateur.