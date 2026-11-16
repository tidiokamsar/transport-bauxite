# Guide de la pesée CBG à deux sources

Public : agent terrain KOGON, contrôleur (exploitation ou chargé de
contrats), validateur (finance). Sources : D-037, D-050, D-078, D-081 ;
migration `20261121180000_pesee_deux_sources` ; écran **Pesée CBG**
(menu racine), quatre espaces A à D.

Principe : **CBG pèse, KOGON observe.** Le relevé officiel CBG (source A)
et la fiche terrain KOGON (source B) sont conservés séparément puis
rapprochés. La fiche KOGON n'est jamais un second ticket officiel ; une
valeur CBG n'est jamais modifiée ; un cas ambigu n'est jamais tranché par
le système. Tous les poids sont en **tonnes**.

## 1. Agent terrain KOGON (droit `trips` en écriture)

Espace **B. Fiches terrain KOGON**.

1. Choisir le site (obligatoire) et, si on la connaît, la rotation.
2. Recopier ce qu'on voit de la pesée CBG : numéro du ticket, heure,
   camion, chauffeur, brut et tare (ou net). Au moins le ticket ou un
   poids. Brut et tare se saisissent ensemble.
3. Cocher « L'agent signale une anomalie » si quelque chose cloche
   (ticket illisible, camion différent…) et la décrire : c'est obligatoire.
4. **Enregistrer le brouillon** garde la fiche sur ce poste seulement (non
   envoyée). **Envoyer la fiche** la transmet. En cas d'échec réseau, le
   brouillon reste ; le renvoyer plus tard ne crée pas de doublon (chaque
   fiche a un identifiant de saisie).
5. Erreur de saisie après envoi : **Corriger** sur la ligne, saisir le
   motif. Une nouvelle fiche remplace l'ancienne, qui reste visible au
   serveur. Une rotation dont la réconciliation mensuelle est close ne se
   corrige plus (circuit d'avoir).

La fiche de rotations (Fiches terrain) continue d'intégrer le ticket avec
la réception au dépôt : ce relevé est recopié automatiquement dans la
source B (« saisi avec la rotation »).

Limite : pas de mode hors ligne complet (pas d'application installable) ;
le brouillon local dépend du navigateur du poste.

## 2. Contrôleur (droit `trips` en écriture)

**A. Relevés officiels CBG** : importer le relevé reçu de CBG en CSV
(Excel : « enregistrer sous » CSV). Colonnes exigées : ticket, date, net
(ou brut et tare) ; immatriculation reconnue. L'écran montre l'aperçu,
les lignes rejetées et leur motif, les lignes incomplètes, avant l'envoi.
Un même fichier ne s'importe qu'une fois (empreinte SHA-256). Un ticket
déjà présent dans un autre relevé est accepté et signalé. Un relevé
importé par erreur s'**annule** avec un motif, tant qu'aucun de ses
voyages n'est dans une réconciliation close.

**C. Rapprochement** : choisir le relevé, **Rapprocher** (ou relancer :
chaque passe est conservée). Lecture côte à côte : CBG, KOGON, rotation,
écart en t et %, constats. Une ligne peut porter plusieurs constats :

| Constat | Sens |
|---|---|
| Concordant | Même ticket, même poids, même camion |
| Concordant avec réserve | Écart non nul dans la tolérance, date différente ou anomalie signalée par l'agent |
| Écart de poids | Hors tolérance |
| Ticket CBG sans fiche KOGON | Une rotation candidate (camion et date) peut être proposée, jamais rattachée |
| Fiche KOGON sans ticket CBG | Ticket relevé par KOGON absent du relevé CBG |
| Ticket dupliqué | Deux fois dans le relevé, ou dans un autre relevé |
| Camion non reconnu | Inconnu de la flotte, ou différent de celui de KOGON |
| Rotation non retrouvée | Aucune rotation identifiée |
| Données incomplètes | Ticket, date ou poids manquant |
| À examiner | Plusieurs candidats : décision humaine |

La tolérance (t et %, par site ou globale, versionnée) se paramètre en
bas de l'espace C (droit `settings`). Sans paramètre : « tolérance non
paramétrée », tout écart non nul est signalé.

**D. Anomalies et validations** : ouvrir l'anomalie, **Examiner**, puis
demander une vérification, confirmer la concordance, accepter l'écart
justifié (référence de preuve obligatoire pour un écart de poids) ou
signaler une erreur CBG (la valeur CBG n'est pas modifiée : la
contestation part vers CBG). Puis **Soumettre à validation**. Chaque
action est motivée et inscrite à l'historique.

## 3. Validateur (droit `invoices` en écriture)

Espace D, anomalies « Soumise à validation » : **Clôturer** ou
**Renvoyer en examen** (motif). Celui qui a soumis un écart de poids ne
peut pas le clôturer. Une anomalie ouverte sur un voyage bloque sa ligne
de réconciliation (`anomalie_pesee_ouverte`) jusqu'à décision motivée.

Réconciliation mensuelle : le tonnage CBG est celui du relevé officiel ;
le relevé KOGON est affiché à part. Sans relevé CBG, la ligne porte
`sans_releve_cbg` et le tonnage reçu provient du relevé KOGON, signalé.

## 4. À fournir par le propriétaire

- Un relevé CBG réel (format, colonnes, unité) pour valider l'import.
- La tolérance par site (t et %) et son motif.
- Si `sans_releve_cbg` doit bloquer la facturation (aujourd'hui : signalé, non bloquant).
- Le stockage des pièces (fichier original du relevé, scans) viendra du lot pièces jointes.
