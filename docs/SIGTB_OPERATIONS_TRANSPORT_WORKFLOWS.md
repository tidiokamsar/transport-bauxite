# Opérations transport : déroulés (D-088)

Chaque étape cite l'écran et la fonction serveur. La synchronisation se fait
par le serveur seulement : les écrans relisent les tables, aucune recopie.

1. **Préparer le shift** : Postes (`planifier_poste`, `ouvrir_poste`) puis
   Dispatch, plan de shift (`besoin_shift`, `confirmer_plan_shift` qui crée
   les voyages par `preparer_voyages`). Le voyage créé apparaît dans le
   registre (même table `trips`).
2. **Affecter** : Dispatch (`affecter_voyage` puis `decider_affectation`).
   Une réaffectation change `trips.vehicle_id` et ajoute une décision : la
   fiche du voyage montre la courante et l'historique (onglet Affectations),
   le registre et le Dispatch lisent le même camion courant.
3. **Exécuter** : fiche du voyage, « Étapes, pesée et ticket »
   (`avancer_voyage`, `rattacher_ticket_cbg`) ; suspension et reprise en
   pleine page. Chaque pas est une ligne de `trip_events`, visible dans la
   chronologie.
4. **Documenter** : Fiches terrain. FR générée (`generer_fiches_rotation`,
   écran historique « Préparer ») ou préparée, imprimée
   (`enregistrer_impression_fiches`), remise (`remettre_fiches`), retournée
   (`enregistrer_retour_fiches`), saisie (`saisir_ligne_rotation`, voyage
   relié), soumise, contrôlée, validée par une autre personne, archivée. La
   rotation reliée apparaît dans l'onglet Fiches du voyage.
5. **Justifier** : Pesée CBG (relevé officiel importé, relevé KOGON,
   rapprochement). La ligne officielle rapprochée apparaît dans l'onglet
   Tickets du voyage, distincte de la saisie KOGON ; l'original n'est jamais
   modifié.
6. **Traiter un écart** : l'anomalie ouverte par le rapprochement apparaît
   dans « Anomalies et écarts » et dans l'onglet Anomalies du voyage ; son
   traitement (journal) suit, avec l'anomalie citée.
7. **Vérifier** : depuis la chronologie, « Vérifier » ouvre la page de
   vérification (`verifier_evenement_voyage`) ; une autre personne valide.
8. **Contrôler et clôturer** : « Contrôles et clôtures » lance
   `controles_voyage` sur les voyages du jour ; la clôture du shift reste
   `cloturer_shift` (Postes, D-087), refusée si des voyages ne sont pas
   terminés sauf motif.

Une opération annulée garde ses références et ses preuves : voyage annulé
(état CANCELLED, journal conservé), décision refusée, relevé CBG annulé,
pièce annulée, relevé KOGON remplacé apparaissent avec `annule = true`.
