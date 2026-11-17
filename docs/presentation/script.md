# SIGTB : vidéo de présentation, script de la voix off

Fichiers : `docs/presentation/SIGTB_presentation.mp4` (H.264 + AAC, 1920x1080, 25 i/s), copie `SIGTB_presentation_720p.mp4` (1280x720), sous-titres incrustés (copie `SIGTB_presentation.srt`). Voix : synthèse Windows « Microsoft Hortense Desktop », débit 0, une phrase par fichier, 0,35 s de silence entre phrases et 0,75 s entre séquences. Fond : nappe synthétique générée par ffmpeg (accord tenu, sans mélodie), à -28 dB, atténuée sous la voix (sidechaincompress).

Images : cartes animées (`scripts/video/cartes.html`) et écrans réels de SIGTB construits depuis le dépôt, servis en local sur l'API simulée des tests E2E, avec le jeu fictif de `scripts/captures/jeu-captures.ts` et les réponses serveur fictives de `scripts/video/jeu-video.ts` (indicateurs du tableau de bord, du dispatch et du centre de pilotage, statistiques de la simulation du dispatch, validations en attente, voyages livrés du graphique de production). Le mock des tests n'est pas modifié. Toutes les données sont fictives ; la bande de titre au-dessus de chaque écran porte « Données de démonstration ». Aucun chiffre de performance n'est avancé. Chaque phrase a son plan : zoom lent vers l'élément encadré en orange, ou carte animée.

Source unique du texte : `scripts/video/sequences.json`.

| # | Séquence | Phrase (voix off et sous-titre) | Image |
|---|---|---|---|
| 1 | Le défi | Chaque jour, des camions chargés de bauxite font la navette entre la mine et le dépôt. | Carte d'ouverture (emblème, SIGTB, camion) |
| | | Et chaque tonne facturée à CBG doit pouvoir être justifiée : par un voyage, par une pesée, par une pièce. | Suite de la carte : « Chaque tonne facturée doit être justifiée » |
| 2 | SIGTB | SIGTB est la plateforme de Kogon Mining pour gérer ce transport de bout en bout. | Carte de la chaîne métier |
| | | Une seule chaîne relie la planification, le terrain, la pesée, les contrats et la facturation. | Suite de la carte |
| | | Chaque indicateur affiche sa source, sa période et son heure. | Tableau de bord, tuile Tonnes livrées |
| 3 | Planification et shifts | La journée commence par l'objectif de production, fixé par site et par shift. | Planification, réalisation du plan |
| | | Le chef de poste ouvre son poste, pointe son équipe et reçoit les consignes. | Poste, consignes reçues |
| 4 | Dispatch | Au dispatch, SIGTB propose une affectation : un camion disponible, un chauffeur habilité, une chargeuse. | Indicateurs du dispatch, camions disponibles |
| | | Le système recommande, le dispatcher décide. | Recommandations |
| | | Chaque décision est contrôlée par le serveur et conservée dans l'historique. | Journal des décisions du shift |
| 5 | Voyages et rotations | Chaque voyage suit un cycle strict, du chargement à la livraison. | Voyages du jour |
| | | Les étapes s'enchaînent dans l'ordre, et chaque changement d'état est inscrit dans un journal qui ne se réécrit pas. | Chronologie d'un voyage |
| 6 | Fiches terrain | Sur le terrain, l'agent note les rotations sur une fiche numérotée. | Registre des fiches |
| | | À son retour, il la saisit ligne par ligne. | Saisie d'une rotation |
| | | Les écarts sont détectés, puis la fiche est validée par une autre personne. | Fiche à contrôler, bouton Valider |
| 7 | Pesée CBG et rapprochement | La pesée officielle de CBG fait foi. | Relevés officiels CBG |
| | | Son relevé est importé avec une empreinte, puis rapproché, ticket par ticket, de la fiche KOGON. | Rapprochement du relevé choisi, ticket T-EX-1 |
| | | Tout écart devient une anomalie, examinée puis conclue. | Anomalies de pesée |
| 8 | Carburant, pneus, maintenance | Les coûts suivent la même règle. | Parcours d'un litre de carburant |
| | | Le carburant est reçu, distribué et inventorié, cuve par cuve. | Cuves et inventaires |
| | | Les pneus sont suivis montage par montage. | Registre des pneus |
| | | Les immobilisations des engins loués à Neemba sont déclarées et tracées. | Flotte, engin immobilisé |
| 9 | Contrats et facturation CBG | En fin de période, la réconciliation rassemble les voyages et les tonnages acceptés. | Réconciliation mensuelle |
| | | La facture est préparée selon le contrat, signée par le directeur, jamais par celui qui l'a préparée, et numérotée à l'émission. | Facture à signer |
| | | Chaque ligne remonte à ses voyages et à ses tickets. | Dossier contractuel |
| 10 | Pilotage | Pour piloter, le centre de pilotage et la boîte des validations rassemblent ce qui attend une décision. | Centre de pilotage |
| | | Les validations en attente sont regroupées par domaine. | Mes validations |
| | | Les alertes et les rapports sont produits à partir des mêmes données. | Tableau de bord, carburant distribué |
| 11 | Sécurité | La sécurité est assurée par le serveur : des droits par rôle, par module et par site, un journal de chaque opération, des sauvegardes vérifiées. | Carte des trois piliers |
| | | Une correction est un nouvel événement, jamais une réécriture silencieuse. | Administration, journal de connexion |
| 12 | Clôture | SIGTB : chaque tonne tracée, chaque facture justifiée. | Générique : SIGTB, Kogon Mining, https://sigtb.infranetgn.com |
| | | Prochaine étape : charger vos référentiels et lancer la recette sur le site pilote. | Suite du générique |

## Régénérer la vidéo

Prérequis : `npm ci` fait, ffmpeg complet (chemin par défaut dans `scripts/video/commun.ts`, ou variable `FFMPEG_BIN` = dossier `bin`), Windows avec la voix Hortense, Node 24 (exécution directe des `.ts`).

```bash
T=<dossier de travail hors depot>
# 1. Application construite contre une API locale factice, servie en local
VITE_SUPABASE_URL=http://127.0.0.1:54321 VITE_SUPABASE_ANON_KEY=cle-factice-e2e npx vite build --outDir $T/dist
npx vite preview --outDir $T/dist --port 5288 --strictPort &
# 2. Voix off (un WAV par phrase)
pwsh scripts/video/voix.ps1 -Travail $T
# 3. Images : bandes de titre, cartes image par image, ecrans sur l'API simulee
#    (SEULEMENT=<prefixe> pour refaire quelques plans)
node scripts/video/capturer.ts $T http://localhost:5288
# 4. Clips, fondus, sous-titres, voix, nappe ; 1080p puis 720p
node scripts/video/assembler.ts $T docs/presentation/SIGTB_presentation.mp4 docs/presentation/SIGTB_presentation_720p.mp4
```

Synchronisation : chaque phrase dure sa voix plus sa pause ; un plan couvre ses phrases et s'allonge de 0,6 s, durée du fondu qui le chevauche avec le plan suivant ; chaque phrase démarre à son instant calculé (adelay), son sous-titre aussi.

## Limites

- Voix de synthèse Windows ; les sigles SIGTB et CBG sont épelés (substitution dans `voix.ps1`).
- Écrans sur données fictives uniquement. Les plans du Dispatch qui montrent le bas de l'écran sont capturés dans une fenêtre haute, sans défilement, puis recadrés autour de l'élément commenté.
