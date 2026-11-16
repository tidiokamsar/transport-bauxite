# Module 22 : Santé, sécurité et environnement (HSE)

Fiche du catalogue maître (D-077), modèle `MODELE_FICHE_MODULE.md`. État
constaté le 2026-11-16 (`date -u`) sur `origin/docs/catalogue-maitre`
(= `main` 8df078d + fiche modèle). Le contrôle avant départ touche la
chaîne J1 (il peut bloquer le départ d'un voyage) ; le reste du module
relève du jalon J4. D-068 (« centre des décisions et HSE », deuxième
vague) est annoncée au journal du plan maître mais aucune branche ni
migration ne la porte : rien n'en est compté ici.

## Synthèse des états

| # | Élément (liste du propriétaire) | État | Preuve principale |
|---|---|---|---|
| 1 | Inspections (planifiées : site, atelier, engin) | MANQUANT | - |
| 2 | Contrôles avant départ | DÉPLOYÉ | `ControlesDepartView.tsx`, `enregistrer_controle_depart`, garde `garde_controle_depart` (D-054, migration `20261117120000`, déployée 04140d7) ; pgTAP 37, E2E `hse` |
| 3 | Équipements de protection (EPI) | MANQUANT | - |
| 4 | Incidents | DÉPLOYÉ | `IncidentsView.tsx`, `declarer_incident`, `analyser_incident`, `cloturer_incident` (D-054, D-072) ; pgTAP 37, 54, E2E `hse` |
| 5 | Accidents | DÉPLOYÉ | `incidents.type = 'accident'`, `blessure` |
| 6 | Presque-accidents | DÉPLOYÉ | `incidents.type = 'presque_accident'` |
| 7 | Déclarations | DÉPLOYÉ | numéro serveur `INC-AAAA-NNNNN`, rattachement voyage / engin / site contrôlé |
| 8 | Enquêtes | PARTIEL | statut `en_analyse` et cause texte ; ni équipe d'enquête, ni témoins, ni chronologie, ni pièces |
| 9 | Causes | PARTIEL | `incidents.cause` texte libre, révision motivée journalisée (D-072) ; aucune classification (cause immédiate, racine) |
| 10 | Actions correctives | DÉPLOYÉ | `actions_correctives`, `ajouter_action_corrective`, `solder_action_corrective`, `v_actions_correctives_en_retard` ; « Mes validations » (D-056) |
| 11 | Plans de prévention | MANQUANT | - |
| 12 | Formations | PARTIEL | formation sécurité des chauffeurs dans `habilitations_chauffeur` (D-051, module 09) ; rien pour les autres personnels |
| 13 | Habilitations | PARTIEL | chauffeurs seulement (D-051), contrôlées au dispatch |
| 14 | Gestion des risques | MANQUANT | - |
| 15 | Suivi environnemental | MAQUETTE | `ESGTrackingView.tsx` : lit 4 tables sans source de données, 4 boutons sans action (l. 229, 238, 251, 264) |
| 16 | Rapports HSE | PARTIEL | incidents dans `rapport_journalier` (D-058) ; aucun rapport HSE dédié (taux, presque-accidents, actions) |
| 17 | Pièces jointes (photos, constats, preuves) | MANQUANT | aucun stockage de fichiers (module 23) |

Décompte : DÉPLOYÉ 6, PARTIEL 5, MANQUANT 5, MAQUETTE 1 (17 éléments).
Aucun élément UTILISABLE ni VALIDÉ.

## 1. Objectifs et périmètre

Prévenir et tracer les risques de l'exploitation : camions semi-remorques
sur pistes minières, chargement par chargeuses et pelle (D-011),
circulation sur les sites CBG, stockage et distribution de carburant.
Le module empêche un camion non conforme de partir (contrôle avant
départ), enregistre tout événement (incident, accident, presque-accident),
en fait l'analyse, suit les actions correctives jusqu'à preuve, et suit
les exigences de prévention (EPI, formations, habilitations, plans de
prévention, risques) et l'environnement (déversements, déchets).

Décisions de référence : D-054 (contrôle avant départ, incidents, actions
correctives), D-072 (rattachements contrôlés, cause révisée avec motif),
D-051 (habilitations chauffeurs), D-056 (actions en retard dans « Mes
validations »), D-058 (rapports), D-066 (déclaration depuis la fiche
voyage, `Trips/IncidentVoyage`), D-071 (déchets en lecture `esg`), D-077.
CDC 22 : données personnelles et disciplinaires cloisonnées, règles de
sécurité paramétrables par site et réglementation applicable.

Liens : voyages (module 07 : départ bloqué, incident de voyage), flotte
(module 08 : engin), chauffeurs (module 09 : habilitations, infractions
D-066), sites (module 03 : zones de sécurité, incidents de site),
carburant (module 13 : déversement), maintenance (module 11 : défaut
constaté au contrôle), GED (module 23 : photos, rapports d'enquête).

## 2. Sous-modules

1. Contrôles avant départ (liste de points, résultat, blocage).
2. Événements : incidents, accidents, presque-accidents, déclarations.
3. Enquêtes, causes et actions correctives.
4. Prévention : inspections planifiées, EPI, formations et habilitations
   de tout le personnel, plans de prévention, registre des risques.
5. Environnement : incidents environnementaux, déchets, consommations.
6. Rapports et indicateurs HSE.

## 3. Menus et sous-menus

| Entrée (`menu.ts`) | Vue | Droit qui l'affiche | Écriture |
|---|---|---|---|
| RH & Sécurité > Contrôles avant départ (`controles-depart`) | `ControlesDepartView` | lecture `trips` | contrôle : `trips` et périmètre ; liste de points et exigence : administrateur |
| RH & Sécurité > Incidents (`incidents`) | `IncidentsView` | lecture `reports` | `trips` et périmètre (fonctions serveur) |
| Reporting & Analyse > Environnement (`esg-tracking`) | `ESGTrackingView` | lecture `reports` | aucune (maquette) |
| Flotte > Habilitations chauffeurs (`habilitations`) | `HabilitationsView` | module 09 | - |

Écart : l'entrée Incidents s'affiche avec le droit `reports` alors que
l'écriture exige `trips` ; un compte qui écrit en `trips` sans lire
`reports` ne voit pas le menu. Cible : groupe de menu « HSE » distinct,
droit dédié (point à trancher).

## 4. Écrans

| Écran | Objet | État | Preuve |
|---|---|---|---|
| Contrôles avant départ : saisie | `enregistrer_controle_depart` | DÉPLOYÉ | réponse à chaque point actif, observation exigée si non conforme |
| Contrôles du jour et historique | `controles_depart`, `controles_depart_points` | PARTIEL | liste depuis une date ; ni filtre engin / résultat, ni export |
| Liste de points de contrôle | `points_controle_depart` | DÉPLOYÉ | ajout, retrait de la liste (actif) ; administrateur |
| Exigence du contrôle au départ | `settings.controle_depart_exige` | DÉPLOYÉ | bascule avec confirmation |
| Incidents : liste et filtres | `incidents` | PARTIEL | filtres simples ; ni recherche, ni export, ni pagination (200 derniers) |
| Déclaration d'incident | `declarer_incident` | DÉPLOYÉ | - |
| Analyse, clôture, actions correctives | fonctions D-054 | DÉPLOYÉ | `window.prompt` pour cause et conclusion |
| Actions en retard | `v_actions_correctives_en_retard` | DÉPLOYÉ | - |
| Déclaration depuis la fiche voyage | `Trips/IncidentVoyage` | DÉPLOYÉ | D-066 (migration `20261121100000`) |
| Environnement | `carbon_emissions`, `sustainability_kpis`, `environmental_incidents`, `waste_management` | MAQUETTE | aucune donnée alimentée, 4 boutons sans action |
| Fiche incident (dossier complet) | - | MANQUANT | - |
| Inspections planifiées, EPI, plans de prévention, risques, formations du personnel | - | MANQUANT | - |
| Tableau de bord HSE | - | MANQUANT | - |

## 5. Widgets et tableaux de bord

MANQUANT (l'écran Environnement affiche des cartes sans source : maquette).
Cible, chacun avec période, source et heure :

| Indicateur | Source | Période |
|---|---|---|
| Contrôles du jour : conformes, avec réserves, non conformes ; camions sans contrôle | `controles_depart`, voyages du jour | jour |
| Incidents par type, gravité, site ; presque-accidents déclarés | `incidents` | mois |
| Jours sans accident avec arrêt | `incidents` (type accident ou blessure) | depuis le dernier |
| Taux de fréquence et de gravité | `incidents` et heures travaillées | mois ; **heures travaillées sans source fiable aujourd'hui** : non calculé tant qu'elles manquent |
| Actions correctives ouvertes, en retard, délai moyen de solde | `actions_correctives` | instantané, mois |
| Habilitations et formations expirant sous 30 jours | `v_habilitations_a_renouveler` (D-051) et cible | instantané |
| Déversements de carburant et quantités | incidents environnementaux (cible) | mois |

## 6. Opérations CRUD

| Objet | Créer | Consulter | Modifier | Dupliquer | Archiver / restaurer | Supprimer (brouillon) | Annuler / corriger |
|---|---|---|---|---|---|---|---|
| Point de contrôle | DÉPLOYÉ (admin) | DÉPLOYÉ | colonnes accordées, pas de formulaire de modification | - | retrait / réactivation DÉPLOYÉ | non | libellés figés dans chaque contrôle |
| Contrôle avant départ | DÉPLOYÉ | DÉPLOYÉ | interdit (append-only) | - | - | - | nouveau contrôle du jour fait foi (D-054) |
| Incident | DÉPLOYÉ | DÉPLOYÉ | analyse (cause), révision motivée | - | clôture DÉPLOYÉ ; réouverture MANQUANT | DELETE retiré (D-042) | rattachements contrôlés (D-072) ; annulation d'une déclaration erronée MANQUANT |
| Action corrective | DÉPLOYÉ | DÉPLOYÉ | - | - | - | - | réalisation avec preuve ou annulation motivée DÉPLOYÉ |
| Inspection, EPI, plan de prévention, risque, formation | MANQUANT | MANQUANT | MANQUANT | MANQUANT | MANQUANT | MANQUANT | - |
| Incident environnemental | MAQUETTE (table héritée lue, aucune saisie) | MAQUETTE | - | - | - | - | - |

## 7. Modals et drawers

| Composant | État | Cible |
|---|---|---|
| Saisie du contrôle | DÉPLOYÉ (panneau) | version terrain grand format ; photo du défaut après GED |
| Déclaration d'incident | DÉPLOYÉ (panneau) | sections Quoi / Où / Qui / Conséquences / Premières mesures ; champs conditionnels selon le type (blessure : victime et soins ; environnement : produit et quantité ; matériel : engin et dégâts) |
| Cause, conclusion, motif | PARTIEL (`window.prompt`) | ActionDialog |
| Action corrective | DÉPLOYÉ (formulaire en ligne) | AssignmentModal (responsable = compte utilisateur, pas texte libre) |
| Fiche incident (DetailDrawer), historique | MANQUANT | chronologie, actions, pièces, journal |
| Pièces jointes | MANQUANT | photos, constat, rapport d'enquête (module 23) |
| Export | MANQUANT | registre des incidents, contrôles |

## 8. Champs des formulaires

**Contrôle avant départ.** Engin (obligatoire, périmètre), chauffeur
(facultatif), voyage (facultatif côté serveur, non proposé à l'écran),
compteur km (>= 0), note ; pour chaque point actif : conforme, non
conforme (observation obligatoire), sans objet. Résultat calculé par le
serveur : conforme ; avec réserves (non-conformité non bloquante) ; non
conforme (point bloquant non conforme).

**Point de contrôle.** Libellé non vide, catégorie (freinage,
pneumatiques, éclairage, fluides, sécurité, documents, cabine, autre),
bloquant (oui / non), ordre.

**Incident.**

| Champ | Type | Obligatoire | Validation |
|---|---|---|---|
| Type | accident, presque_accident, blessure, environnement, materiel, securite, autre | oui | CHECK |
| Gravité | `incident_severity` (minor, moderate, severe, critical) | oui | enum |
| Description | texte | oui | non vide |
| Survenu le | date-heure | oui (défaut : maintenant) | - |
| Engin, chauffeur, voyage, site | FK | au moins un rattachement (D-054) | contrôlés et dans le périmètre (D-072) |
| Lieu | texte | non | cible : infrastructure ou coordonnées facultatives |
| Coût estimé | décimal | non | jamais de valeur par défaut (D-054) |
| Cause (analyse) | texte | à l'analyse | révision : motif obligatoire |
| Conclusion | texte | à la clôture | actions soldées exigées |

**Action corrective.** Libellé, responsable (texte), échéance
obligatoires ; solde : réalisée (preuve texte obligatoire) ou annulée
(motif obligatoire).

## 9. Actions individuelles et en masse

| Action | État |
|---|---|
| Enregistrer un contrôle, ajouter / retirer un point, exiger le contrôle | DÉPLOYÉ |
| Déclarer, analyser, clore un incident ; ajouter, solder une action | DÉPLOYÉ |
| Réouvrir un incident clos (fait nouveau), avec motif | MANQUANT |
| Déclencher une intervention de maintenance depuis un contrôle non conforme | MANQUANT (lien module 11) |
| Actions en masse (relancer les responsables d'actions en retard, exporter) | MANQUANT |

## 10. Statuts et transitions

```
Contrôle :   (enregistré) conforme | reserves | non_conforme   (figé ; un nouveau contrôle du jour fait foi)
Départ :     ASSIGNED -> AT_LOADING refusé si controle_depart_exige = true et (aucun contrôle du jour du camion
             ou dernier contrôle non_conforme) (déclencheur sur trip_events)
Incident :   ouvert -> en_analyse (analyser_incident ; trips et périmètre ; cause)
             en_analyse -> en_analyse (révision de cause ; motif obligatoire, journal)
             ouvert|en_analyse -> clos (cloturer_incident ; cause et actions soldées exigées)
             clos -> en_analyse (cible : réouverture motivée)
Action :     ouverte -> realisee (preuve) | annulee (motif) ; figée ensuite
```

## 11. Workflows

Existant : déclaration -> analyse -> actions -> clôture, sans
approbation ni séparation des tâches ; actions en retard signalées dans
« Mes validations ». Cible : notification immédiate de la direction et du
responsable HSE pour un accident ou une gravité sévère / critique ;
validation de la clôture par une personne différente du déclarant
(réglage `hse_cloture_separee`, sur le modèle des autres séparations) ;
relance des responsables d'actions à l'échéance ; enquête formalisée
pour les accidents (équipe, témoins, chronologie, causes immédiates et
racines). Délais légaux de déclaration aux autorités : à fournir par le
propriétaire (réglementation guinéenne applicable), aucune valeur
inventée.

## 12. Rôles et permissions

| Action | Droit | Contrôle serveur |
|---|---|---|
| Lire contrôles et incidents | `trips` ou `reports`, périmètre | politiques D-054, D-075 |
| Enregistrer un contrôle, déclarer, analyser, clore, actions | `trips` en écriture, périmètre (voyage, engin ou site) | fonctions SECURITY DEFINER |
| Liste de points, exigence du contrôle | administrateur | politique `administration`, `settings` |
| Environnement (lecture) | `esg`, périmètre de l'engin source pour les déchets (D-071) | aucune écriture navigateur |

Cible CDC 22 : données personnelles et disciplinaires (victimes,
sanctions) lisibles par un cercle restreint (direction, responsable HSE),
pas par tout lecteur `reports`. Aucun rôle HSE n'existe dans `user_role` :
point à trancher (option par défaut : droits par utilisateur D-036 sur un
module `hse` à créer).

## 13. Tables et relations

| Table | Colonnes clés | Contraintes / RLS | État |
|---|---|---|---|
| `points_controle_depart` | libellé, catégorie, bloquant, ordre, actif | CHECK catégorie ; admin | DÉPLOYÉ |
| `controles_depart`, `controles_depart_points` | engin, chauffeur, voyage, date, résultat ; libellé et bloquant figés, réponse, observation | append-only, périmètre | DÉPLOYÉ |
| `incidents` | numero UNIQUE, type, severity, engin, chauffeur, voyage, site, contrôle, lieu, statut, cause, conclusion, declare_par | CHECK type et statut ; DELETE retiré ; périmètre (D-046) | DÉPLOYÉ |
| `actions_correctives` | incident, libellé, responsable (texte), échéance, statut, preuve, motif | CHECK statut | DÉPLOYÉ |
| `environmental_incidents`, `carbon_emissions`, `sustainability_kpis`, `waste_management` | héritées de Bolt | régimes RLS hérités ; aucune donnée alimentée | MAQUETTE |
| Cible : `inspections`, `inspections_points` | modèle, site / infrastructure / engin, planification, résultat | append-only, périmètre | MANQUANT |
| Cible : `epi_types`, `dotations_epi` | type, taille, bénéficiaire (compte ou chauffeur), date, échéance de renouvellement, restitution | périmètre du site | MANQUANT |
| Cible : `risques`, `plans_prevention` | activité, danger, gravité, probabilité (échelles fixées par le propriétaire), mesures, responsable, revue ; plan : entreprise intervenante, période, mesures, signataires | versionnés | MANQUANT |
| Cible : `formations_personnel` | personne, thème, date, validité, preuve | rattachement à `habilitations_chauffeur` pour les chauffeurs | MANQUANT |
| Cible : `incidents_temoins`, colonnes de blessure (victime, soins, arrêt en jours) | cloisonnées (RLS restreinte) | - | MANQUANT |

## 14. Fonctions serveur et API

DÉPLOYÉ : `enregistrer_controle_depart(p_vehicle, p_points, p_driver,
p_trip, p_date, p_km, p_note)`, garde `garde_controle_depart` sur
`trip_events`, `declarer_incident(p_type, p_gravite, p_description,
p_survenu_le, p_vehicle, p_driver, p_trip, p_site, p_lieu, p_cout_estime,
p_controle)`, `analyser_incident(uuid, text, text)`,
`cloturer_incident`, `ajouter_action_corrective`,
`solder_action_corrective`, vue `v_actions_correctives_en_retard`.
Paramètres des appels de `ControlesDepartView.tsx` (l. 77-81) et
`IncidentsView.tsx` (l. 77-100) vérifiés : conformes.

MANQUANT : `reouvrir_incident`, `planifier_inspection`,
`enregistrer_inspection`, `doter_epi`, `enregistrer_risque`,
`enregistrer_incident_environnemental` (ou type `environnement` enrichi
dans `incidents`, à préférer à la table héritée), rapport HSE mensuel.

## 15. Notifications

PARTIEL : action corrective en retard dans « Mes validations » (D-056).
MANQUANT : accident ou incident grave déclaré (direction, responsable
HSE), contrôle non conforme bloquant (chef de poste, maintenance),
habilitation ou formation expirant, inspection en retard.

## 16. Documents et modèles d'impression

MANQUANT : fiche de contrôle avant départ imprimable (version papier pour
la saisie différée, comme les fiches terrain D-028), fiche de
déclaration d'incident, rapport d'enquête, plan d'actions, registre des
dotations EPI. Photos et constats après stockage de fichiers (module 23).

## 17. Exports et rapports

PARTIEL : incidents dans le rapport journalier (D-058). MANQUANT : registre
des incidents et des contrôles (CSV, PDF), rapport HSE mensuel
(événements, presque-accidents, actions, contrôles, indicateurs avec
source et période).

## 18. Historique et audit

DÉPLOYÉ : contrôles append-only avec libellés figés ; incidents jamais
supprimés, révision de cause motivée et journalisée (D-072) ; actions
soldées figées avec preuve ou motif. MANQUANT : journal consultable à
l'écran (fiche incident), comparaison des versions de la liste de points.

## 19. Tests

Existants : pgTAP 37 (14 assertions : contrôle, blocage du départ,
incidents, actions), 54 (correctifs R3 : rattachements, révision de
cause), 09, 14, 17, 18 (neutralisent l'exigence) ; unitaires
`Hse/hse.test.ts` ; E2E `hse` (point bloquant non conforme et observation
obligatoire ; action en retard et réalisation avec preuve) et
`dispatch-voyages` (incident pré-rempli depuis la fiche d'un voyage).

Manquants : E2E clôture refusée avec action ouverte ; tests
des futurs EPI, inspections, risques ; test de cloisonnement des données
de blessure.

## 20. Critères de recette métier

1. L'administrateur paramètre les points de contrôle réels du camion
   (freinage bloquant, éclairage non bloquant...) et active l'exigence ;
   un camion sans contrôle du jour ne peut pas partir au chargement ; un
   contrôle « avec réserves » le laisse partir.
2. Un presque-accident sur la piste est déclaré depuis la fiche du
   voyage, analysé, deux actions sont créées et soldées avec preuve ;
   l'incident est clos.
3. Une action non soldée à l'échéance apparaît dans « Mes validations ».
4. Le rapport journalier du jour cite l'incident.
5. PV signé par le responsable des opérations et la direction.

## Écarts et lots proposés

### Défauts bloquants constatés

Aucune colonne inexistante : les écritures passent par les fonctions
serveur (paramètres conformes) et, pour la liste de points, par un insert
sur des colonnes accordées (`libelle`, `categorie`, `bloquant`, `ordre`).
Défauts non bloquants :

1. `src/components/ESG/ESGTrackingView.tsx:229,238,251,264` : quatre
   boutons sans action (maquette), indicateurs calculés sur des tables
   que rien n'alimente.
2. `src/contexts/AuthContext.tsx` (correspondance `'incidents': 'reports'`)
   : le menu Incidents dépend du droit `reports`, l'écriture du droit
   `trips`.
3. `src/components/Incidents/IncidentsView.tsx:95` : responsable d'une
   action corrective en texte libre : aucune notification ni boîte « mes
   actions » possible.

### Lots proposés (ordre)

| # | Écart | Taille | Dépendances |
|---|---|---|---|
| 1 | Pièces jointes des contrôles et incidents (photos, constat, rapport) | S | module 23 (J1) |
| 2 | Fiche de contrôle avant départ imprimable et saisie différée depuis la fiche papier | S | modèle des fiches terrain (D-028) |
| 3 | Fiche incident complète (chronologie, rattachements, actions, journal), réouverture motivée, champs conditionnels par type, export du registre | M | DetailDrawer, ExportModal |
| 4 | Responsable d'action = compte utilisateur, relances, notifications des accidents graves | S | module 02 (comptes), module 24 |
| 5 | Retrait ou étiquetage « non repris » de l'écran Environnement ; incidents environnementaux portés par `incidents` (type environnement : produit, quantité, mesures) | S | décision de garder ou archiver les tables héritées (aucune suppression, D-069 point 4) |
| 6 | EPI : types, dotations, renouvellements, restitutions | M | J4 ; référentiel du propriétaire |
| 7 | Inspections planifiées (modèles, planning, résultats, actions) | M | J4 |
| 8 | Formations et habilitations de tout le personnel (au-delà des chauffeurs) | M | module 02 (personnes) ; module RH |
| 9 | Registre des risques et plans de prévention (entreprises intervenantes : Neemba sur site) | L | échelles et réglementation fournies par le propriétaire |
| 10 | Rapport HSE mensuel et tableau de bord (section 5) | M | heures travaillées fiables (postes D-048 ou RH) pour les taux |
| 11 | Droit dédié `hse` et cloisonnement des données de blessure et disciplinaires | S | décision du propriétaire ; migration (revue indépendante) |

Points à trancher par le propriétaire : réglementation et délais de
déclaration applicables ; existence d'un responsable HSE (rôle ou droits
par utilisateur) ; séparation déclarant / clôtureur ; échelles de cotation
des risques ; liste des EPI obligatoires par poste ; sort des tables
environnementales héritées (garder, archiver dans `archive_bolt`).
