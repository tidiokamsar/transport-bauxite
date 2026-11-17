# SIGTB : vidéo de présentation, script de la voix off

Fichier : `docs/presentation/SIGTB_presentation.mp4` (H.264 + AAC, 1920x1080, 25 i/s), sous-titres incrustés (copie `SIGTB_presentation.srt`). Voix : synthèse Windows « Microsoft Hortense Desktop », débit 0.

Images : cartes animées (`scripts/video/cartes.html`) et écrans réels de SIGTB construits depuis le dépôt, servis en local sur l'API simulée des tests E2E avec le jeu fictif de `scripts/captures/jeu-captures.ts`. Toutes les données affichées sont fictives (marquées « Exemple » ; puce « Données de démonstration » sur chaque écran). Aucun chiffre de performance n'est avancé.

Source unique du texte : `scripts/video/sequences.json`. Ce document en est la lecture plan par plan.

| # | Séquence | Images | Voix off |
|---|---|---|---|
| 1 | Le défi | Carte d'ouverture : emblème, nom SIGTB, camion qui traverse, « Chaque tonne facturée doit être justifiée » | Chaque jour, des camions chargés de bauxite font la navette entre la mine et le dépôt. Et chaque tonne facturée à CBG doit pouvoir être justifiée : par un voyage, par une pesée, par une pièce. |
| 2 | SIGTB | Carte de la chaîne (objectif, poste, dispatch, voyage, fiche, pesée CBG, rapprochement, facture, encaissement), puis tableau de bord | SIGTB est la plateforme de Kogon Mining pour gérer ce transport de bout en bout. Une seule chaîne relie la planification, le terrain, la pesée, les contrats et la facturation. Chaque indicateur affiche sa source, sa période et son heure. |
| 3 | Planification et shifts | Planification (objectif encadré), fiche du poste (consignes) | La journée commence par l'objectif de production, fixé par site et par shift. Le chef de poste ouvre son poste, pointe son équipe et reçoit les consignes. |
| 4 | Dispatch | Onglet Affectations (recommandation encadrée), journal du dispatch | Au dispatch, SIGTB propose une affectation : un camion disponible, un chauffeur habilité, une chargeuse. Le système recommande, le dispatcher décide. Chaque décision est contrôlée par le serveur et conservée dans l'historique. |
| 5 | Voyages et rotations | Liste des voyages, chronologie d'un voyage | Chaque voyage suit un cycle strict, du chargement à la livraison. Les étapes s'enchaînent dans l'ordre, et chaque changement d'état est inscrit dans un journal qui ne se réécrit pas. |
| 6 | Fiches terrain | Registre des fiches, fiche FR à contrôler (écart) | Sur le terrain, l'agent note les rotations sur une fiche numérotée. À son retour, il la saisit ligne par ligne. Les écarts sont détectés, puis la fiche est validée par une autre personne. |
| 7 | Pesée CBG et rapprochement | Rapprochement (ticket encadré), anomalies de pesée | La pesée officielle de CBG fait foi. Son relevé est importé avec une empreinte, puis rapproché, ticket par ticket, de la fiche KOGON. Tout écart devient une anomalie, examinée puis conclue. |
| 8 | Carburant, pneus, maintenance | Stocks carburant (cuve encadrée), tableau des pneus, immobilisations | Les coûts suivent la même règle. Le carburant est reçu, distribué et inventorié, cuve par cuve. Les pneus sont suivis montage par montage. Les immobilisations des engins loués à Neemba sont déclarées et tracées. |
| 9 | Contrats et facturation CBG | Fiche contrat, réconciliation, facture à signer | En fin de période, la réconciliation rassemble les voyages et les tonnages acceptés. La facture est préparée selon le contrat, signée par le directeur, jamais par celui qui l'a préparée, et numérotée à l'émission. Chaque ligne remonte à ses voyages et à ses tickets. |
| 10 | Pilotage | Centre de pilotage, Mes validations, rapports | Pour piloter, le centre de pilotage et la boîte des validations rassemblent ce qui attend une décision. Les rapports de poste, journaliers et mensuels sont produits à partir des mêmes données. |
| 11 | Sécurité | Carte des trois piliers (droits, journal, sauvegardes), paramètres | La sécurité est assurée par le serveur : des droits par rôle, par module et par site, un journal de chaque opération, des sauvegardes vérifiées. Une correction est un nouvel événement, jamais une réécriture silencieuse. |
| 12 | Clôture | Carte de fin : emblème, « Chaque tonne tracée, chaque facture justifiée » | SIGTB : chaque tonne tracée, chaque facture justifiée. Prochaine étape : charger vos référentiels et lancer la recette sur le site pilote. |

## Régénérer la vidéo

Prérequis : `npm ci` fait, ffmpeg complet (chemin par défaut dans `scripts/video/commun.ts`, ou variable `FFMPEG_BIN` = dossier `bin`), Windows avec la voix Hortense, Node 24 (exécution directe des `.ts`).

```bash
T=<dossier de travail hors depot>
# 1. Application construite contre une API locale factice, servie en local
VITE_SUPABASE_URL=http://127.0.0.1:54321 VITE_SUPABASE_ANON_KEY=cle-factice-e2e npx vite build --outDir $T/dist
npx vite preview --outDir $T/dist --port 5288 --strictPort &
# 2. Voix off (un WAV par sequence)
pwsh scripts/video/voix.ps1 -Travail $T
# 3. Images (cartes image par image, ecrans sur l'API simulee)
node scripts/video/capturer.ts $T http://localhost:5288
# 4. Clips, fondus, sous-titres, son normalise
node scripts/video/assembler.ts $T docs/presentation/SIGTB_presentation.mp4
```

Synchronisation : une séquence dure sa voix plus 0,5 s ; chaque plan est allongé de 0,6 s, durée du fondu qui le chevauche avec le suivant ; la voix de chaque séquence démarre au début de son premier plan.

## Limites

- Voix de synthèse Windows, sans musique d'accompagnement.
- Écrans sur données fictives de l'API simulée : certains écrans dont les chiffres sont calculés par le serveur apparaissent partiellement vides ; aucun n'est présenté comme réel.
- Les sigles SIGTB et CBG sont épelés par la voix (substitution dans `voix.ps1`).
