# Module 09 : Gestion des chauffeurs

Fiche du catalogue maître (D-077), modèle `MODELE_FICHE_MODULE.md`.
État constaté le 2026-11-16 (`date -u`) sur `origin/docs/catalogue-maitre`
(base `main` 8df078d). Production : dernière release consignée 3bbfded,
démonstration purgée (D-076), aucune saisie réelle. Aucun élément
UTILISABLE ni VALIDÉ (pas de donnée réelle, pas de PV) ; guide existant :
`docs/guides/guide-flotte-maintenance.md`, sections 1, 7 et 8.

## 1. Objectifs et périmètre

Tenir le dossier de chaque chauffeur et opérateur d'engin (camions bennes,
chargeuses, pelle) pour que le dispatch n'affecte que des personnes
présentes, titulaires d'un permis valide et des habilitations exigées, et
que les incidents, infractions et performances soient rattachés à une
personne. Le chauffeur est employé ou mis à disposition par Kogon ; les
engins sont loués à Neemba (D-022, D-027) : la question « le chauffeur des
engins loués est-il fourni par le loueur ? » relève du modèle de location
(D-013, `SIGTB_2.0_LOCATION_MODEL.md` section 2.4) et reste un paramètre du
contrat, non tranché ici.

Décisions : D-024 (permis contrôlé à l'affectation), D-038, D-039, D-075
(périmètre site du chauffeur), D-042 et D-061 (archivage au lieu de
suppression, refusé pendant un voyage en cours ; présences par fonction
serveur, lien employé-chauffeur par matricule), D-051 (habilitations,
exigences au dispatch), D-054 (incidents rattachés au chauffeur), D-066
(infractions et sanctions, avertissement sans blocage au dispatch), D-072
R2 (`garde_trips_habilitations`), D-077. CDC 22 : données personnelles et
disciplinaires cloisonnées.

Entrées : sites (03), employés et présences (RH), voyages (07), incidents
(22). Sorties : chauffeurs disponibles pour les postes (05), le dispatch
(06) et les voyages (07) ; performance (21).

## 2. Sous-modules

1. Dossier administratif (identité, matricule, contacts, contrat, site).
2. Permis (numéro, catégories, expiration).
3. Habilitations, visites médicales, formations, accès site (D-051).
4. Affectations et disponibilités (postes, voyages, présences).
5. Incidents, infractions, sanctions (D-054, D-066).
6. Performance et historique des missions.
7. Alertes d'expiration et rapports individuels.

## 3. Menus et sous-menus

| Entrée | Vue | Droit lu |
|---|---|---|
| Flotte > Chauffeurs (`drivers`) | `Drivers/DriversView` | module `drivers` |
| Flotte > Habilitations chauffeurs (`habilitations`) | `Drivers/HabilitationsView` | module `drivers` |
| Reporting > Performance chauffeurs (`driver-behavior`) | `Analyses/AnalysesFlotte` `PerformanceChauffeursView` | module `reports` |
| RH & Sécurité > Présences (`hr-attendance`) | `HR/AttendanceView` | module `hr` |
| RH & Sécurité > Incidents (`incidents`) | `Incidents/IncidentsView` | module `reports` |

## 4. Écrans

| Écran | Objet | État | Preuve |
|---|---|---|---|
| Liste des chauffeurs (recherche nom, matricule, permis ; filtre statut ; compteur de permis expirant ; export CSV et PDF) | `drivers` | PARTIEL (erreur de lecture avalée dans la console, aucun site affiché ni filtré, plantage possible si matricule vide) | `src/components/Drivers/DriversView.tsx:43-58`, `:144-147` |
| Création et modification d'un dossier | `drivers` | PARTIEL, défaut bloquant (section finale) | `src/components/Drivers/DriverModal.tsx:58-91` |
| Archivage du dossier (statut « terminated ») | `drivers` | DÉPLOYÉ | `DriverModal.tsx:93-113`, garde `garde_archivage_chauffeur` (`20261118180000_corrections_ecrans.sql:302`) |
| Infractions et sanctions dans la fiche chauffeur | `infractions_chauffeur`, `sanctions_infraction` | DÉPLOYÉ (3dc77d4) | `src/components/Drivers/InfractionsChauffeur.tsx:30-90`, migration `20261121100000` |
| Habilitations (saisie, révocation motivée, à renouveler, exigences au dispatch) | `habilitations_chauffeur`, `habilitations_requises`, `v_habilitations_a_renouveler` | DÉPLOYÉ (2d5c3cb) | `src/components/Drivers/HabilitationsView.tsx:32-70` |
| Performance chauffeurs (mois) | `performance_chauffeurs` | DÉPLOYÉ | `AnalysesFlotte.tsx:111-150`, `20261111160000_analyses_flotte.sql` |
| Présences (employés, correction motivée) | `employee_attendance`, `v_presences` | DÉPLOYÉ (5ef4ab6) | D-061 ; lien chauffeur par matricule |
| Disponibilités planifiées (congés, repos, indisponibilité) | - | MANQUANT | - |
| Temps de conduite et de repos (CDC 22) | `driving_time_regulations` (table héritée, non lue) | MANQUANT | base de référence |
| Fiche chauffeur consolidée (voyages, incidents, infractions, habilitations, présences) | - | MANQUANT (seules les infractions sont dans le modal) | - |
| Rapport individuel imprimable | - | MANQUANT | - |
| Import en masse des dossiers | - | MANQUANT | - |

## 5. Widgets et tableaux de bord

| Indicateur | Source | Période | État |
|---|---|---|---|
| Nombre de chauffeurs par statut | `drivers.status` | instant | PARTIEL (calcul navigateur, sans heure de fraîcheur) |
| Permis expirés ou expirant sous 30 jours | `drivers.license_expiry` | J à J+30 | PARTIEL (calcul navigateur, non présent dans « Mes validations ») |
| Habilitations à renouveler | `v_habilitations_a_renouveler` | J à J+30 | DÉPLOYÉ |
| Voyages, tonnes, cycle par chauffeur | `performance_chauffeurs`, `rapport_voyages` (D-066) | mois | DÉPLOYÉ |
| Infractions actives et sanctions en vigueur | `infractions_chauffeur` | - | PARTIEL (par chauffeur dans le modal, pas de vue globale) |
| Taux de présence | `v_presences` | mois | MANQUANT |

## 6. Opérations CRUD

| Objet | Créer | Consulter | Modifier | Dupliquer | Archiver / restaurer | Supprimer (brouillon) | Annuler / corriger |
|---|---|---|---|---|---|---|---|
| Dossier chauffeur | PARTIEL (échoue si une date facultative est vide) | PARTIEL | PARTIEL (même défaut ; non journalisé) | MANQUANT | DÉPLOYÉ (statut ; restauration par le statut « Actif ») | sans objet (DELETE retiré) | MANQUANT (pas de journal) |
| Habilitation | DÉPLOYÉ (insert, colonnes accordées) | DÉPLOYÉ | sans objet (immuable) | MANQUANT | sans objet | sans objet | DÉPLOYÉ (révocation motivée, définitive) |
| Exigence au dispatch | DÉPLOYÉ (administrateur) | DÉPLOYÉ | sans objet | sans objet | sans objet | DÉPLOYÉ (paramètre : levée de l'exigence) | sans objet |
| Infraction | DÉPLOYÉ (`enregistrer_infraction`) | DÉPLOYÉ | sans objet | sans objet | sans objet | sans objet | DÉPLOYÉ (`annuler_infraction`, motif) |
| Sanction | DÉPLOYÉ (`decider_sanction`) | DÉPLOYÉ | sans objet | sans objet | sans objet | sans objet | DÉPLOYÉ (`annuler_sanction`) |
| Disponibilité / absence | MANQUANT | MANQUANT | MANQUANT | - | - | - | MANQUANT |

## 7. Modals et drawers

| Modal | État | Preuve |
|---|---|---|
| Dossier chauffeur (création, édition, archivage, infractions) | PARTIEL | `DriverModal.tsx` |
| Nouvelle habilitation | DÉPLOYÉ | `HabilitationsView.tsx:86-100` |
| Révocation et levée d'exigence (motif, confirmation) | PARTIEL (`window.prompt` / `confirm`) | `HabilitationsView.tsx:62-70` |
| Saisie d'infraction, décision de sanction | DÉPLOYÉ | `InfractionsChauffeur.tsx` |
| Pièces jointes (permis scanné, certificat médical) | MANQUANT (aucun stockage) | - |
| Historique du dossier | MANQUANT | - |

## 8. Champs des formulaires

**Dossier chauffeur** (`DriverModal`, table `drivers`, base de référence) :

| Champ | Type | Obligatoire (écran / base) | Validation |
|---|---|---|---|
| Nom | texte | oui / NOT NULL défaut '' | aucune contrôle de doublon |
| Matricule (`employee_id`) | texte | oui / nullable | lien avec `employees` par matricule (D-061) non contrôlé |
| Téléphone, courriel, adresse, contact d'urgence | texte | non | aucune validation de format côté serveur |
| Date de naissance | date | non / nullable | **envoyée vide ('') : refus du serveur** |
| Numéro de permis | texte | oui / NOT NULL | - |
| Catégorie de permis | liste A à E, pré-remplie « C » | oui / NOT NULL | une seule catégorie (un permis porte souvent plusieurs catégories) |
| Expiration du permis | date | oui / NOT NULL | contrôlée au dispatch (D-024) |
| Expiration du certificat médical | date | non / nullable | **envoyée vide ('') : refus du serveur** ; doublon avec l'habilitation « visite médicale » (D-051) |
| Date d'embauche | date | oui / NOT NULL | - |
| Type de contrat | liste pré-remplie « permanent » | oui / nullable | - |
| Salaire de base | nombre, pré-rempli 0 | oui / défaut 0 | valeur 0 enregistrée comme réelle (règle 1) ; donnée RH à cloisonner (CDC 22) |
| Statut | actif, suspendu, archivé | oui | archivage refusé pendant un voyage en cours |
| Site | - | absent de l'écran / nullable | **non saisissable** : le chauffeur est toujours global |
| Notes | texte | non | - |

Cible : site obligatoire pour un profil borné, catégories de permis
multiples, engins autorisés (lien avec l'habilitation « engin »),
employeur (Kogon, loueur, sous-traitant), photo et pièces, aucune valeur
pré-remplie.

**Habilitation** : chauffeur, type (5 valeurs, CHECK), libellé, numéro,
délivrée le (obligatoire), expire le (>= délivrance, CHECK), référence de la
pièce. **Infraction** : type et source (listes fermées CHECK, D-066), date et
heure, constat, lieu, voyage du chauffeur, référence de la source.

## 9. Actions individuelles et en masse

| Action | État | Preuve |
|---|---|---|
| Archiver / réactiver un dossier | DÉPLOYÉ | `DriverModal.tsx:93` |
| Suspendre (statut « suspendu ») | PARTIEL (par le formulaire, sans motif ni journal ; effet au dispatch à vérifier : le dispatch contrôle le permis et les habilitations) | `DriverModal.tsx:366` |
| Enregistrer, révoquer une habilitation ; exiger un type | DÉPLOYÉ | `HabilitationsView.tsx` |
| Enregistrer, annuler une infraction ; décider, annuler une sanction | DÉPLOYÉ | `InfractionsChauffeur.tsx` |
| Affecter à un site (mutation) | MANQUANT | - |
| Affecter à une équipe ou un poste | DÉPLOYÉ côté module 05 (postes D-048) | - |
| Export de la liste | DÉPLOYÉ (CSV, impression) | `DriversView.tsx:78-108` |
| Actions en masse (archiver, muter, exiger) | MANQUANT | - |

## 10. Statuts et transitions

```
active -> suspended     (formulaire ; droit écriture drivers ; aucun motif) 
active | suspended -> terminated (archivage ; refus si voyage ASSIGNED .. WEIGHED_IN, garde serveur)
terminated -> active    (formulaire ; aucun motif)
Habilitation : valide -> révoquée (motif, définitif) ; valide -> expirée (date)
Infraction : active -> annulee (motif ; approbation drivers si sanction active)
Sanction : active -> annulee (motif, approbation drivers)
```

Cible : motif obligatoire et journal pour toute suspension et réactivation.

## 11. Workflows

- Recrutement : dossier, permis, habilitations exigées, site ; le chauffeur
  n'est proposable au dispatch que si les exigences sont satisfaites
  (déclencheurs `garde_habilitations`, `garde_trips_habilitations`).
- Infraction : déclaration (W drivers ou trips), décision de sanction
  (approbation drivers ou administrateur). Dérogation D-066 à confirmer par
  le propriétaire : aucune séparation entre déclarant et décideur.
- Expiration : liste « à renouveler » ; aucune relance ni escalade
  (MANQUANT).

## 12. Rôles et permissions

| Action | Module et niveau | Périmètre |
|---|---|---|
| Lire les dossiers | `drivers` lecture | `site_permis(site_id)` |
| Créer, modifier, archiver | `drivers` écriture (RLS `ecriture_module`) | site du chauffeur (NULL = global : seul un profil global écrit) |
| Habilitations | `drivers` écriture, site du chauffeur | exigences : administrateur |
| Infractions | W `drivers` ou `trips` ; sanctions : approbation `drivers` | chauffeur, voyage ou site de saisie |
| Données personnelles et salaire | non cloisonnées : tout lecteur du module voit `base_salary`, date de naissance, adresse | MANQUANT (CDC 22) |

## 13. Tables et relations

`drivers` (base de référence ; `site_id` ajouté par
`20261114100000_perimetre_site.sql:85` ; RLS bornée au site ; garde
d'archivage ; DELETE retiré) ; `habilitations_chauffeur` et
`habilitations_requises` (`20261116180000`, insert par colonnes accordées,
révocation seule modifiable) ; `infractions_chauffeur`,
`sanctions_infraction` (`20261121100000`, append-only) ; `incidents.driver_id`
(D-054) ; `trips.driver_id`, `decisions_dispatch` ; `employees` et
`employee_attendance` (RH). Colonnes héritées non maintenues :
`total_tonnage`, `total_km` (défaut 0), `profile_id`.

## 14. Fonctions serveur et API

`enregistrer_infraction`, `annuler_infraction`, `decider_sanction`,
`annuler_sanction` (D-066) ; `performance_chauffeurs` ; `rapport_voyages`
(par chauffeur) ; gardes `garde_archivage_chauffeur`,
`garde_habilitations`, `garde_dispatch_habilitations`,
`garde_trips_habilitations`, `horodater_habilitation`. Manquantes :
`enregistrer_chauffeur` / `modifier_chauffeur` (journal, motif, site),
`muter_chauffeur`, `declarer_indisponibilite`.

## 15. Notifications

| Événement | Destinataire | Canal | État |
|---|---|---|---|
| Permis expirant | responsable chauffeurs, dispatch | écran (compteur) | PARTIEL |
| Habilitation expirant | idem | écran (liste) | DÉPLOYÉ (écran seulement) |
| Sanction de conduite en vigueur | dispatcher | avertissement dans la recommandation | DÉPLOYÉ (D-066) |
| Absence non justifiée au poste | chef de poste | - | MANQUANT |

## 16. Documents et modèles d'impression

Fiche individuelle, attestation d'habilitation, notification de sanction :
MANQUANT. Liste imprimable : DÉPLOYÉ.

## 17. Exports et rapports

CSV et impression de la liste : DÉPLOYÉ. Rapport par chauffeur (voyages,
tonnes, cycle, incidents, litiges) : DÉPLOYÉ dans `Trips/RapportsVoyages`
(D-066). Rapport individuel consolidé : MANQUANT.

## 18. Historique et audit

Habilitations (saisie, révocation horodatées, auteur) : DÉPLOYÉ.
Infractions et sanctions append-only : DÉPLOYÉ. Modifications du dossier et
changements de statut : non journalisés : MANQUANT.

## 19. Tests

| Type | Existant | Manquant |
|---|---|---|
| pgTAP | `34_habilitations_chauffeurs` (10), `49_dispatch_voyages` (87, dont infractions), `44_corrections_ecrans` (archivage), `22_perimetre_site`, `58_perimetre_site_lectures` | création d'un dossier avec dates facultatives vides ; profil borné qui crée un chauffeur |
| Unitaires | `habilitations.test.ts` (2), `infractions.test.ts` (3) | formulaire du dossier |
| E2E (API simulée) | `habilitations.spec.ts` (1), `corrections-ecrans.spec.ts` (archivage), `dispatch-voyages.spec.ts` | création d'un chauffeur contre une vraie base (aurait révélé le défaut) |

## 20. Critères de recette métier

1. Le responsable saisit les chauffeurs réels de Nimba, avec ou sans date
   de naissance, rattachés au site ; ils apparaissent dans le poste et le
   dispatch du site.
2. Un chauffeur au permis expiré ou sans habilitation exigée est refusé à
   l'affectation, avec la raison.
3. Une infraction saisie puis sanctionnée apparaît comme avertissement au
   dispatch ; son annulation motivée la retire.
4. L'archivage d'un chauffeur en voyage est refusé.
5. PV signé par le responsable d'exploitation.

## Écarts et lots proposés

### Défauts bloquants constatés

1. `src/components/Drivers/DriverModal.tsx:76-81` (création) et `:64-72`
   (modification) : `...formData` envoie `birth_date` et
   `health_certificate_expiry` à `''` quand ils ne sont pas saisis
   (initialisés à `''`, `:41` et `:45`). Ces colonnes sont de type `date` :
   PostgreSQL refuse `''` (« invalid input syntax for type date »). Tout
   dossier sans date de naissance ou sans certificat médical ne peut être ni
   créé ni modifié (la modification d'un dossier existant sans ces dates
   échoue aussi). Bloque la saisie réelle des chauffeurs.
2. `src/components/Drivers/DriverModal.tsx` (formulaire entier, `:35-53`) :
   aucun champ `site_id`. Le chauffeur est toujours créé global (site
   NULL). Un profil borné à un site ne peut pas créer de chauffeur (RLS
   `ecriture_module` : `site_permis(NULL)` faux) et ne voit pas les
   chauffeurs globaux, donc ne peut pas les affecter (D-075). Bloque
   l'exploitation par site.

Défauts non bloquants :
- `src/components/Drivers/DriversView.tsx:54` : erreur de lecture écrite
  dans la console, liste vide sans message (état d'erreur exigé).
- `src/components/Drivers/DriversView.tsx:146` : `employee_id.toLowerCase()`
  plante sur un matricule NULL (colonne nullable).
- `DriverModal.tsx:50` : salaire pré-rempli à 0 et enregistré comme valeur
  réelle (règle 1) ; `:43` et `:49` catégorie « C » et contrat « permanent »
  pré-choisis.

### Lots proposés (ordre)

1. (S) Corriger les deux défauts bloquants (dates vides en NULL, champ site
   obligatoire pour un profil borné) et les défauts non bloquants ; ajouter
   un E2E contre une vraie base. Prioritaire : saisie réelle en cours.
2. (M) Écriture du dossier par fonctions serveur journalisées (motif pour
   suspension, réactivation, mutation de site) ; cloisonnement des données
   personnelles et du salaire (vue restreinte au module RH).
3. (S) Catégories de permis multiples et alerte permis dans « Mes
   validations ».
4. (M) Disponibilités et absences planifiées, lues par les postes et le
   dispatch ; dépend des modules 05 et 06.
5. (M) Fiche chauffeur consolidée et rapport individuel imprimable.
6. (M) Pièces jointes (permis, certificats) ; dépend du stockage privé.
7. (S) Import des dossiers (CSV) ; dépend du composant ImportWizard.
8. (L) Temps de conduite et de repos paramétrables par site (CDC 22) ;
   règles à fournir par le propriétaire.
Point à trancher par le propriétaire : séparation déclarant / décideur des
sanctions (D-066) ; chauffeur fourni par le loueur ou par Kogon selon le
contrat. Extensions à déclencheur non commencées : alertes de fatigue et
comportement par capteurs ou GPS.
