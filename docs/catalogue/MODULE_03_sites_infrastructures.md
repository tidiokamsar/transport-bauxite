# Module 03 : Sites et infrastructures

Fiche du catalogue maître (D-077), modèle `MODELE_FICHE_MODULE.md`. État
constaté le 2026-11-16 (`date -u`) sur `origin/docs/catalogue-maitre`
(= `main` 8df078d + fiche modèle). Production purgée (D-076) : le
référentiel des sites est le premier saisi par le propriétaire (les fiches
terrain, le dispatch, les voyages et le carburant en dépendent). Le
propriétaire a précisé que les sites doivent pouvoir porter des
coordonnées GPS **facultatives**.

## Synthèse des états

| # | Élément (liste du propriétaire) | État | Preuve principale |
|---|---|---|---|
| 1 | Sites miniers (référentiel des sites) | PARTIEL | `SitesView.tsx`, `SiteModal.tsx`, table `sites` ; création réparée par f17b60f (fusion 8df078d, déploiement non consigné au journal) ; modification qui efface l'organisation (défaut 1) ; aucun test de création |
| 2 | Zones d'exploitation | MANQUANT | aucune table ; les zones de géorepérage (`zone_type` mine, loading) ne sont pas des zones opérationnelles |
| 3 | Points de chargement | DÉPLOYÉ | `infrastructures_site` type `point_chargement` (D-047, migration `20261115230000`, déployée d11cf3c) ; pgTAP 30, E2E `infrastructures` |
| 4 | Dépôts de réception | DÉPLOYÉ | type `depot_reception` (D-047) |
| 5 | Ponts-bascules | DÉPLOYÉ | type `pont_bascule` (D-047) ; la pesée elle-même est CBG (D-037, module 14) |
| 6 | Stations carburant | DÉPLOYÉ | type `station_carburant` (D-047) ; non reliée aux cuves `stockages_carburant` (D-041) |
| 7 | Ateliers et zones techniques | DÉPLOYÉ | type `atelier` (D-047) |
| 8 | Routes et pistes | PARTIEL | `distances_reference` site à site avec source (D-043, écran `KilometrageView`) ; aucun tronçon |
| 9 | Zones de sécurité | DÉPLOYÉ | type `zone_securite` (D-047) |
| 10 | Géofences | PARTIEL | `GeofencingView.tsx`, `geofence_zones` (D-061) ; aucune détection (PostGIS absent, `geofence-monitor` non déployée) |
| 11 | Capacités | PARTIEL | capacité d'infrastructure avec unité obligatoire (D-047) ; `sites.capacity` sans unité et `sites.current_stock` modifiable à la main |
| 12 | Horaires et périodes d'activité | MANQUANT | - |
| 13 | Fermetures temporaires | DÉPLOYÉ | `fermetures_site`, `site_ferme_le`, garde du dispatch (D-047, D-072) ; pgTAP 30, 52, E2E `infrastructures` |
| 14 | Incidents de site | PARTIEL | `incidents.site_id`, `declarer_incident(p_site)` (D-054, module 22) ; aucune vue par site |
| 15 | Cartographie | MANQUANT | Leaflet n'est utilisé que par le suivi GPS ; aucun site n'a de coordonnées |
| 16 | Historique des modifications | MANQUANT | `sites` modifié par update direct sans journal ; `cree_par` et `declare_par` des infrastructures et fermetures jamais renseignés |
| 17 | Import des référentiels géographiques | MANQUANT | - |
| 18 | Coordonnées GPS facultatives des sites | MANQUANT | colonnes absentes de `sites` (retirées de l'écran par D-047 puis f17b60f) |

Décompte : DÉPLOYÉ 7, PARTIEL 5, MANQUANT 6, MAQUETTE 0 (18 éléments).
Aucun élément UTILISABLE ni VALIDÉ.

## 1. Objectifs et périmètre

Le module tient le référentiel géographique et opérationnel de
l'exploitation : le site minier de Nimba (D-011), les dépôts de
destination où CBG pèse et réceptionne (D-037), les points de chargement
où travaillent les 2 chargeuses et la pelle, les stations carburant, les
ateliers, les zones de sécurité, les pistes entre sites, leurs capacités,
leurs horaires et leurs fermetures.

Décisions de référence : D-006 (PostGIS prévu ; constaté absent,
D-047, D-061), D-011, D-037, D-038 (`sites.organisation_id`,
`site_permis`), D-042 (désactivation au lieu de suppression), D-043
(distances de référence), D-047 (infrastructures et fermetures), D-061
(géorepérage sans position par défaut), D-072 (fermeture liée à une
infrastructure du même site, levée), D-077.

Sorties : `sites.id` est la clé du périmètre de tous les comptes
(`site_permis`) ; le site de départ et d'arrivée des voyages (module 07),
la préparation des fiches terrain, les objectifs (module 04), le refus
d'affectation vers un site fermé (module 06, garde `garde_site_ferme`),
la simulation de capacité (D-063, points de chargement actifs et
ouverts), les distances facturables au km (D-043, module 20), le site
des cuves et des dépôts de stock (modules 13, 17), des biens (module 18).

## 2. Sous-modules

1. Référentiel des sites (site minier, dépôt de destination, port,
   atelier, base), avec organisation, code, coordonnées facultatives.
2. Infrastructures de site : points de chargement, dépôts de réception,
   ponts-bascules, stations carburant, ateliers, zones de sécurité ;
   capacités avec unité.
3. Zones d'exploitation et fronts de chargement (cible).
4. Routes et pistes : distances de référence site à site (existant),
   tronçons et état de praticabilité (cible).
5. Disponibilité : horaires d'activité, fermetures temporaires, incidents
   de site.
6. Géorepérage et cartographie.

## 3. Menus et sous-menus

| Entrée (`menu.ts`) | Vue | Droit qui l'affiche | Écriture |
|---|---|---|---|
| Exploitation > Sites (`sites`) | `SitesView` | lecture `settings` (admin, director) | `settings` (politique `ecriture_module` de `sites`) |
| Exploitation > Infrastructures et fermetures (`infrastructures`) | `InfrastructuresView` | lecture `trips` | `settings` ou admin, dans le périmètre |
| Exploitation > Géorepérage (`geofencing`) | `GeofencingView` | lecture `gps_tracking` | droit `gps_tracking` (D-061) |
| Kilométrage (`kilometrage`) | `KilometrageView` (distances de référence) | lecture `trips` | module 07 |

Écart : le responsable des opérations et le responsable de flotte
(droits hérités de `dispatcher`) ne voient pas le menu Sites (pas de
lecture `settings`) alors que tout connecté lit la table `sites`
(politique `lecture_authentifies`). Cible : menu Sites visible en lecture
par tout compte du périmètre, écriture réservée à `settings`.

## 4. Écrans

| Écran | Objet | État | Preuve |
|---|---|---|---|
| Liste des sites (cartes) | `sites` | PARTIEL | `SitesView.tsx` : recherche, filtre par type, désactivation (D-042) ; ni tri, ni pagination, ni export, ni filtre actif/inactif, ni réactivation explicite ; la recherche lève une erreur si ville ou adresse est vide (l. 135-136) |
| Création / modification de site | `sites` | PARTIEL | `SiteModal.tsx` : création réparée (f17b60f) ; modification qui remet `organisation_id` à vide (défaut 1) ; « Stock actuel » saisi à la main ; pas de code ni de coordonnées |
| Fiche détaillée d'un site | site, infrastructures, fermetures, distances, comptes affectés, engins, historique | MANQUANT | - |
| Infrastructures et fermetures | `infrastructures_site`, `fermetures_site` | DÉPLOYÉ | `InfrastructuresView.tsx` : création, archivage, déclaration et levée motivée d'une fermeture, état en cours / planifiée / levée |
| Géorepérage | `geofence_zones`, violations, alertes | PARTIEL | `GeofencingView.tsx` : saisie de zones cercle ou polygone sans position par défaut, désactivation ; violations jamais produites (aucune détection) |
| Distances de référence | `distances_reference` | DÉPLOYÉ | `KilometrageView.tsx` (D-043), décrit au module 07 |
| Carte des sites et infrastructures | - | MANQUANT | - |
| Horaires d'activité | - | MANQUANT | - |
| Zones d'exploitation, tronçons de piste | - | MANQUANT | - |
| Import du référentiel (CSV) | - | MANQUANT | - |

## 5. Widgets et tableaux de bord

`SitesView` affiche des cartes « total, actifs, entrepôts, capacité
totale, stock total » calculées sur la liste chargée (PARTIEL : la somme
des capacités additionne des unités différentes et le « stock » est une
saisie manuelle : indicateur sans source au sens de la règle 5).

Cible, avec source, période et heure de calcul :

| Indicateur | Source | Période |
|---|---|---|
| Sites et infrastructures fermés aujourd'hui et sous 7 jours | `fermetures_site`, `site_ferme_le` | jour, 7 jours |
| Points de chargement actifs et ouverts par site | `infrastructures_site`, `fermetures_site` | instantané |
| Heures de fermeture cumulées par site et motif | `fermetures_site` | mois |
| Voyages refusés pour site fermé | `decisions_dispatch` (refus de la garde) | mois |
| Incidents par site | `incidents.site_id` (module 22) | mois |
| Sites sans coordonnées, sans organisation, sans code | `sites` | instantané |

## 6. Opérations CRUD

| Objet | Créer | Consulter | Modifier | Dupliquer | Archiver / restaurer | Supprimer (brouillon) | Annuler / corriger |
|---|---|---|---|---|---|---|---|
| Site | PARTIEL (insert direct, droit `settings`) | DÉPLOYÉ | PARTIEL (défaut 1) | MANQUANT | PARTIEL : désactivation `is_active = false` (D-042) ; réactivation seulement par le champ Statut du formulaire | Interdit (DELETE retiré, D-042) ; cible : suppression d'un site jamais utilisé, avec contrôle des dépendances | journal MANQUANT |
| Infrastructure | DÉPLOYÉ (insert, colonnes accordées) | DÉPLOYÉ | PARTIEL (colonnes `libelle`, `capacite`, `unite_capacite`, `actif`, `note` accordées ; aucun formulaire de modification) | MANQUANT | archivage DÉPLOYÉ ; restauration MANQUANT à l'écran | DELETE non accordé | auteur non tracé (`cree_par` vide) |
| Fermeture | DÉPLOYÉ | DÉPLOYÉ | dates figées (D-047) | - | - | DELETE refusé (pgTAP 30) | levée motivée DÉPLOYÉ (garde `garde_fermeture_site`, D-072) |
| Zone de géorepérage | DÉPLOYÉ | DÉPLOYÉ | DÉPLOYÉ | MANQUANT | désactivation / réactivation DÉPLOYÉ | DELETE retiré | - |
| Distance de référence | DÉPLOYÉ (module 07) | DÉPLOYÉ | désactivation puis nouvelle valeur | - | DÉPLOYÉ | - | - |
| Horaires, zones d'exploitation, tronçons | MANQUANT | MANQUANT | MANQUANT | MANQUANT | MANQUANT | MANQUANT | - |

## 7. Modals et drawers

| Composant | État | Cible |
|---|---|---|
| Création / édition de site (`SiteModal`) | PARTIEL | sections Identité (code, nom, type, organisation), Localisation (adresse, ville, pays, **latitude et longitude facultatives**, source et précision), Contact, Responsable (compte utilisateur plutôt qu'employé RH), Capacité (valeur et unité), Notes ; validation en temps réel |
| Confirmation de désactivation | PARTIEL | `window.confirm` ; cible : ActionDialog avec motif et liste des dépendances actives (comptes affectés, engins, cuves, dépôts, voyages en cours) |
| Formulaire d'infrastructure, de fermeture | DÉPLOYÉ | panneau en ligne ; cible : ajout des coordonnées facultatives, modification d'une infrastructure |
| Levée de fermeture | PARTIEL | `window.prompt` ; cible : ActionDialog |
| Détail site (DetailDrawer) et historique (HistoryDrawer) | MANQUANT | - |
| Import (ImportWizard) | MANQUANT | sites et infrastructures en CSV, coordonnées en degrés décimaux |
| Export (ExportModal) | MANQUANT | - |

## 8. Champs des formulaires

**Site (cible ; état entre crochets).**

| Champ | Type | Obligatoire | Validation | Remarque |
|---|---|---|---|---|
| Code | texte court | oui | unique sans tenir compte de la casse | [MANQUANT ; CDC 5 « Code »] |
| Nom | texte | oui | non vide [DÉPLOYÉ] ; unicité à ajouter | - |
| Type | `site_type` (mine, port, depot, workshop, base) | oui | enum [DÉPLOYÉ] | point à trancher : type du dépôt de destination CBG |
| Organisation | liste `organisations` | oui (cible) | FK [présent, perdu à la modification] | - |
| Adresse, ville, pays | texte | adresse et ville exigées par l'écran, nullables en base | [DÉPLOYÉ] ; cible : facultatifs pour un site minier sans adresse postale | - |
| **Latitude** | décimal, degrés WGS 84 | **non** | -90 à 90 ; saisie avec la longitude ou pas du tout | [MANQUANT] |
| **Longitude** | décimal, degrés WGS 84 | **non** | -180 à 180 ; idem | [MANQUANT] |
| Source des coordonnées | liste (relevé GPS terrain, carte, document du client) | si coordonnées | obligatoire dès qu'une coordonnée est saisie | aucune position par défaut (règle 1) |
| Précision (m) | décimal | non | > 0 | - |
| Contact (nom, téléphone, e-mail) | texte | non | format e-mail [DÉPLOYÉ] | - |
| Responsable | compte utilisateur | non | FK `profiles` (cible) [FK `employees`, lecture exigeant le droit RH] | - |
| Capacité | décimal et unité | non | valeur > 0 et unité exigées ensemble (règle de D-047) | [sans unité] |
| Stock actuel | - | - | à retirer : un stock se calcule depuis les mouvements (modules 13, 17) | [saisi à la main : non conforme] |
| Statut | actif / inactif | oui | [DÉPLOYÉ] ; cible : motif à la désactivation | - |
| Notes | texte | non | - | - |

**Infrastructure.** Site (obligatoire), type (6 valeurs, CHECK), code
(unique), libellé, capacité et unité (ensemble ou absentes, CHECK),
note (DÉPLOYÉ) ; cible : latitude et longitude facultatives (mêmes
règles que le site), horaires propres.

**Fermeture.** Site, infrastructure du même site (facultative, FK
composite D-072), début, fin facultative postérieure au début, motif non
vide (DÉPLOYÉ) ; levée : date et motif (DÉPLOYÉ).

**Zone de géorepérage.** Nom, type (8 valeurs), géométrie cercle (centre
et rayon) ou polygone (3 sommets au moins), site, vitesse et durée
maximales, alertes d'entrée, sortie, séjour (DÉPLOYÉ, aucune valeur par
défaut).

**Horaires d'activité (cible).** Site ou infrastructure, jour de la
semaine ou date, heure d'ouverture et de fermeture, poste associé
(`work_shifts`, module 05), validité (début, fin).

## 9. Actions individuelles et en masse

| Action | État |
|---|---|
| Créer, modifier, désactiver un site | PARTIEL (défaut 1, pas de motif) |
| Réactiver un site | PARTIEL (par le formulaire) |
| Créer et archiver une infrastructure | DÉPLOYÉ |
| Déclarer, lever une fermeture | DÉPLOYÉ |
| Saisir les coordonnées d'un site depuis le terrain (bouton « position de l'appareil » avec précision affichée, confirmation humaine) | MANQUANT (aucune position fabriquée : la valeur vient de l'appareil et est confirmée) |
| Importer sites et infrastructures | MANQUANT |
| Actions en masse (désactiver, rattacher à une organisation) | MANQUANT |

## 10. Statuts et transitions

```
Site :          actif -> inactif (désactiver ; settings ; cible : motif, refus si voyages en cours)
                inactif -> actif (réactiver ; settings ; cible : motif)
Infrastructure: active -> archivée (settings ou admin, périmètre) ; archivée -> active (cible)
Fermeture :     planifiée (début futur) -> en cours (début atteint) -> terminée (fin atteinte)
                planifiée|en cours -> levée (date et motif ; levée jamais future, D-072)
                terminée et levée : figées
```

Effet métier : une fermeture du site entier couvrant la date d'un voyage
fait refuser son affectation (garde `garde_site_ferme`) ; une fermeture
d'infrastructure seule est informative (D-047) et retire le point de
chargement de la capacité simulée (D-063).

## 11. Workflows

1. Mise en place du référentiel (première saisie du propriétaire) :
   organisation (module 02), puis sites, puis infrastructures, puis
   distances de référence (module 07), puis affectation des comptes à
   leur site (module 02).
2. Fermeture : déclaration motivée par le responsable (droit `settings`)
   ; le dispatch refuse les affectations ; levée motivée. Cible :
   notification des dispatchers et du chef de poste du site.
3. Cible : changement de coordonnées ou de capacité d'une infrastructure
   journalisé (avant, après, auteur, motif).

## 12. Rôles et permissions

| Action | Droit (état) | Contrôle serveur |
|---|---|---|
| Lire les sites | tout connecté | politique `lecture_authentifies` (référentiel non borné, choix de D-038) |
| Créer, modifier, désactiver un site | `settings` en écriture | politique `ecriture_module` ; DELETE retiré (D-042) |
| Lire infrastructures et fermetures | compte du périmètre (`site_permis`) | politique `lecture` |
| Écrire infrastructures et fermetures | `settings` ou admin, dans le périmètre | politiques `creation`, `modification`, colonnes accordées |
| Zones de géorepérage | lecture `gps_tracking` et périmètre ; écriture par droit | D-061 |

Avec la matrice actuelle, seuls `admin` et `director` écrivent dans ce
module. Point à trancher : le responsable des opérations doit-il
déclarer les fermetures (option par défaut : non, attribution par
utilisateur D-036 si besoin).

## 13. Tables et relations

| Table | Colonnes clés | Contraintes / RLS | État |
|---|---|---|---|
| `sites` | id, name, type `site_type`, organisation_id, address, city, country, contact_*, capacity, current_stock, is_active, manager_id (FK `employees`), notes, location | RLS lecture tous, écriture `settings` ; DELETE retiré ; aucune unicité de nom ; aucun journal | PARTIEL |
| `infrastructures_site` | site_id, type (6), code UNIQUE, libellé, capacité, unité, actif, cree_par | CHECK capacité et unité ensemble ; UNIQUE (id, site_id) ; RLS périmètre | DÉPLOYÉ |
| `fermetures_site` | site_id, infrastructure_id (même site), début, fin, motif, levée, motif de levée, declare_par | CHECK fin > début, levée motivée ; garde ; pas de DELETE | DÉPLOYÉ |
| `distances_reference` | site_depart_id, site_arrivee_id, distance_km, source, actif | une seule active par couple | DÉPLOYÉ (module 07) |
| `geofence_zones` | géométrie en colonnes numériques, site_id | contrainte de géométrie (D-061) | PARTIEL |
| Colonnes cible sur `sites` | `code text`, `latitude numeric(9,6)`, `longitude numeric(9,6)`, `coordonnees_source text`, `coordonnees_precision_m numeric`, `capacite_unite text`, `responsable_id uuid` (FK `profiles`) | additives, nullables (`ADD COLUMN IF NOT EXISTS`) ; CHECK latitude -90..90, longitude -180..180, `(latitude IS NULL) = (longitude IS NULL)`, source exigée si coordonnées ; index unique `upper(code)` partiel sur code non nul | MANQUANT |
| Mêmes colonnes de coordonnées sur `infrastructures_site` | latitude, longitude, source, précision ; à ajouter aux colonnes accordées en INSERT et UPDATE | mêmes CHECK | MANQUANT |
| Cible : `journal_sites` | site, opération, avant, après, motif, auteur, date | append-only | MANQUANT |
| Cible : `horaires_site` | site ou infrastructure, jour, ouverture, fermeture, validité | RLS périmètre | MANQUANT |
| Cible : `zones_exploitation`, `troncons_piste` | site, libellé, type, distance, état de praticabilité, restrictions, validité | géométrie en coordonnées tant que PostGIS est absent | MANQUANT |

Les coordonnées en `numeric` ne dépendent pas de PostGIS ; une colonne
`geometry` reste conditionnée à l'installation de PostGIS (D-006, non
réalisée).

## 14. Fonctions serveur et API

DÉPLOYÉ : `site_permis`, `site_ferme_le` (exécution retirée aux comptes,
D-072), `garde_fermeture_site`, `garde_dispatch_site_ferme`,
`is_point_in_geofence` (sans PostGIS, retirée aux comptes D-061).

MANQUANT : `enregistrer_site` et `modifier_site` (SECURITY DEFINER,
journal, motif, validation des coordonnées), `desactiver_site(p_site,
p_motif)` avec contrôle des dépendances, `enregistrer_infrastructure`,
`definir_horaires_site`, import contrôlé (`importer_sites` en deux temps
: prévalidation puis validation).

## 15. Notifications

MANQUANT. Cible : fermeture déclarée ou levée (dispatchers, chef de poste,
chargé de contrats du site) ; fermeture qui commence demain ; site désactivé
alors que des objectifs futurs existent (module 04). Canal : centre de
notifications (D-056).

## 16. Documents et modèles d'impression

MANQUANT : fiche de site imprimable (identité, coordonnées, infrastructures,
contacts) ; avis de fermeture imprimable pour affichage sur site.

## 17. Exports et rapports

MANQUANT : export CSV / PDF des sites, infrastructures, fermetures de la
période (motif, durée), distances de référence.

## 18. Historique et audit

Sites : aucun journal (update direct). Infrastructures : aucun journal,
auteur non renseigné. Fermetures : déclaration et levée conservées
(aucune suppression, dates figées) mais `declare_par` jamais renseigné
par l'écran. Zones : `created_by` et horodatage serveur (D-072). Cible :
journal append-only des sites et infrastructures, auteur fixé par le
serveur (`auth.uid()`), jamais par le navigateur.

## 19. Tests

Existants : pgTAP 30 (infrastructures et fermetures, 10 assertions), 52
(correctifs fermetures, D-072), 22 et 58 (périmètre), 44 (géorepérage) ;
unitaires `Sites/infrastructures.test.ts` ; E2E `infrastructures`,
`corrections-ecrans` (géorepérage).

Manquants : **aucun test de création ni de modification de site**
(l'absence de test a laissé passer l'échec de création corrigé par
f17b60f et laisse passer le défaut 1) : E2E création, modification avec
organisation conservée, désactivation ; pgTAP refus d'écriture sans
`settings` ; tests des colonnes GPS (bornes, couple, source) ; test de la
recherche avec ville vide.

## 20. Critères de recette métier

1. Le propriétaire crée l'organisation, puis le site minier de Nimba, les
   dépôts de destination et l'atelier, avec ou sans coordonnées ; il
   modifie un site : l'organisation est conservée.
2. Il déclare les points de chargement (2 chargeuses, 1 pelle selon
   D-011) et une station carburant ; il ferme un dépôt pour la journée :
   une affectation vers ce dépôt est refusée avec le motif ; il lève la
   fermeture : l'affectation passe.
3. La fiche de site montre ses infrastructures, ses fermetures, ses
   distances de référence, son historique.
4. PV signé par le responsable des opérations.

## Écarts et lots proposés

### Défauts bloquants constatés

Aucune colonne inexistante n'est plus envoyée : colonnes de `SiteModal`
(name, type, organisation_id, address, city, country, contact_name,
contact_phone, contact_email, capacity, current_stock, is_active,
manager_id, notes, location), d'`InfrastructuresView` et de
`GeofencingView` vérifiées contre la base de référence, les migrations et
les droits par colonne. Le cas latitude / longitude
(`SiteModal`, création impossible) est corrigé par f17b60f. Défauts
restants :

1. **Bloquant pour la saisie du référentiel.**
   `src/components/Sites/SitesView.tsx:52-70` : la liste construit des
   objets site **sans `organisation_id`** et les passe au formulaire
   (l. 288) ; `src/components/Sites/SiteModal.tsx:18,65` initialise alors
   l'organisation à vide et envoie `organisation_id: null` : toute
   modification d'un site efface silencieusement son rattachement à
   l'organisation (D-038).
2. `src/components/Sites/SiteModal.tsx:26,62-63,318-328` : « Stock
   actuel » (`current_stock`) saisi et modifiable à la main : solde
   modifiable directement, interdit (D-077) ; « Capacité maximale » sans
   unité.
3. `src/components/Sites/SitesView.tsx:135-136` : `site.city.toLowerCase()`
   et `site.address.toLowerCase()` lèvent une erreur dès qu'un site a une
   ville ou une adresse vide (colonnes nullables) : la recherche fait
   tomber l'écran.
4. `src/components/Sites/InfrastructuresView.tsx:58-65` : `cree_par` et
   `declare_par` jamais renseignés (ni par l'écran ni par le serveur) :
   l'auteur d'une infrastructure ou d'une fermeture n'est pas tracé.
5. `src/components/Sites/SiteModal.tsx:37-44` : le responsable se choisit
   parmi `employees` (lecture soumise au droit RH) : liste vide pour un
   directeur sans droit RH.

### Lots proposés (ordre)

| # | Écart | Taille | Dépendances |
|---|---|---|---|
| 1 | Correctifs 1, 3 et 5 (organisation conservée, recherche robuste, responsable = compte utilisateur) et E2E création / modification / désactivation de site | S | aucune ; prioritaire (saisie en cours) |
| 2 | Migration additive : `sites.code`, coordonnées GPS facultatives (`latitude`, `longitude`, source, précision) sur `sites` et `infrastructures_site`, unité de capacité ; retrait de `current_stock` de l'écran (colonne conservée, jamais affichée comme stock) ; champs ajoutés au formulaire avec validation en temps réel ; pgTAP des contraintes | S | revue indépendante (migration) |
| 3 | Écriture des sites par fonctions serveur journalisées (création, modification, désactivation motivée avec contrôle des dépendances, réactivation) ; auteur fixé par le serveur pour infrastructures et fermetures | M | lot 2 |
| 4 | Fiche détaillée de site (infrastructures, fermetures, distances, comptes, engins, incidents, historique) ; liste au standard (tri, pagination, filtres actif/type/organisation, export CSV) | M | lot 3 ; composants DataTable, DetailDrawer |
| 5 | Import CSV des sites et infrastructures (prévalidation, erreurs ligne par ligne, coordonnées en degrés décimaux) | S | lot 2 ; ImportWizard |
| 6 | Carte des sites et infrastructures (Leaflet, déjà dépendance du projet), uniquement pour les sites dont les coordonnées sont saisies, avec mention « coordonnées non renseignées » sinon | S | lot 2 |
| 7 | Horaires et périodes d'activité par site et infrastructure, lus par le dispatch et la simulation | M | module 05 (postes), module 06 |
| 8 | Notifications de fermeture | S | module 24 |
| 9 | Zones d'exploitation et tronçons de piste (état, praticabilité) | L | décision du propriétaire ; PostGIS (D-006) si géométries |
| 10 | Détection de géorepérage | L | extension à déclencheur GPS (bloc 1, section 9) : non commencée |

Points à trancher par le propriétaire : liste et codes des sites réels ;
type à donner au dépôt de destination CBG (`depot` ou `port`) ; source
des coordonnées admise (relevé terrain, document CBG) ; installation de
PostGIS (D-006 non réalisée) ou maintien de coordonnées numériques ;
droit de déclarer une fermeture pour le responsable des opérations.
