# Guide : convertir un module aux pages standard (D-090)

Public : développeurs des lots suivants. Le pilote (Sites, Véhicules et
engins, Chauffeurs) sert de modèle : `src/components/Sites/`,
`src/components/Vehicles/`, `src/components/Drivers/`.

## 1. Principe

Une fenêtre modale par écran devient une page à part entière, avec son
adresse :

| Adresse | Page | Composant |
|---|---|---|
| `#/<vue>` | Liste (filtres dans `?q=`, `f.<filtre>=`, `tri=`, `sens=`, `page=`, `taille=`) | `PageListe` |
| `#/<vue>/nouveau` | Création | `PageFormulaire` |
| `#/<vue>/<id>` | Fiche (`?onglet=relations`, `historique`, `pieces`...) | `PageDetail` |
| `#/<vue>/<id>/modifier` | Modification | `PageFormulaire` |
| `#/<vue>/<id>/<action>` | Action métier (suspendre, désactiver, valider...) | `PageAction` |

`<vue>` est l'identifiant du menu (`src/components/Layout/menu.ts`) ;
App.tsx déduit `currentView` de l'adresse, sans autre changement.

## 2. Étapes pour un module

1. **Aiguillage.** La vue du module lit la route et choisit la page :

   ```tsx
   const route = useRoute();
   if (route.vue !== VUE || route.mode === 'liste') return <Liste />;
   if (route.mode === 'nouveau') return <Formulaire />;
   if (route.mode === 'modifier') return <Formulaire id={route.id} />;
   if (route.mode === 'action' && route.action) return <Action id={route.id ?? ''} action={route.action} />;
   return <Detail id={route.id ?? ''} />;
   ```

2. **Liste.** Déclarer `colonnes` (`valeur` brute pour tri, recherche et
   export ; `rendu` pour l'affichage ; `masquee` pour les colonnes
   secondaires) et `filtres`, puis `<PageListe>`. Chargement : `null` tant
   que rien n'est lu ; erreur du serveur dans `erreur`, jamais une liste vide.
   Le bouton de création est un lien vers `routeNouveau(VUE)`, affiché
   seulement si `hasPermission(module, 'create')`.

3. **Fiche.** Lire l'objet par `lire(...)` puis `trouver(lignes, id)`
   (`src/components/ui/lecture.ts`). `PageDetail` reçoit :
   - `actions` : chacune avec `visible` calculé par le module (droit ET
     état de l'objet) et `vers` (route de la page d'action) ;
   - onglets `informations` (`<Informations groupes=...>`), `relations`
     (`<Relation>` par table liée, lien vers la fiche liée si elle existe),
     `historique` (`<Historique>`), `pieces` (`<OngletPieces>`, avec
     `objetType` quand D-083 couvre l'objet, sinon `null` : l'écart est
     affiché).

4. **Formulaire.** `useSaisie(saisieDepuisObjet(objet))` puis
   `initialiser(...)` quand l'objet est lu ; `erreurs` calculées à chaque
   rendu par une fonction pure testée ; `onSoumettre` renvoie
   `{ erreur }` (message du serveur) ou `{ vers }` (fiche créée ou
   modifiée). Le statut ne se modifie pas dans le formulaire : il passe par
   une action.

5. **Actions.** Une page `PageAction` par action. `motif="obligatoire"`
   quand la fonction serveur l'exige (et `motifMinimum` identique au
   serveur), `"aucun"` quand aucune table ne conserverait le motif.
   `interdit` refuse l'action si le droit ou l'état ne la permettent pas,
   même ouverte par son adresse. `onExecuter` appelle la fonction serveur
   existante et renvoie son message d'erreur ou `null`.

6. **Historique.** Construire les événements depuis les tables de journal
   (`journal_*`) ou les horodatages enregistrés (création, décision,
   révocation...), fusionnés par `fusionnerHistoriques`. Ne jamais
   compléter une date absente. Si le module n'a pas de journal, le dire
   par `absent`.

7. **Retirer la modale** et ses imports ; adapter les E2E (`getByRole('link')`
   pour les actions, `getByRole('form', { name })` pour les pages,
   `getByRole('article', { name: 'Fiche ...' })` pour la fiche).

## 3. Règles inchangées

- Écriture par la fonction serveur existante ; à défaut, la table sous RLS
  comme l'écran d'origine, avec l'écart noté dans la décision du lot.
- Aucune suppression physique d'une pièce métier ; « désactiver »,
  « archiver », « annuler » sont des actions tracées.
- Aucune donnée inventée : valeur absente = « Non renseigné » ou « Sans
  données ».
- Pas de nouvelle dépendance ; pas de migration sans nécessité.

## 4. Fichiers à fenêtre modale (état au 2026-11-17)

Recensement : les 25 fichiers qui importent `ui/Fenetre`, les 6 qui
dessinent leur propre superposition (`fixed inset-0`), les 3 qui ouvrent
`AttachmentModal`, et `ui/PiecesJointes` qui la définit : 35 fichiers, plus
le composant `ui/Fenetre` lui-même.

| # | Fichier (`src/components/`) | Module | État |
|---|---|---|---|
| 1 | `Sites/SiteModal.tsx` | Sites | Converti (D-090), retiré |
| 2 | `Vehicles/VehicleModal.tsx` | Véhicules et engins | Converti (D-090), retiré |
| 3 | `Vehicles/FicheVehicule.tsx` | Véhicules et engins | Converti (D-090), retiré |
| 4 | `Drivers/DriverModal.tsx` | Chauffeurs | Converti (D-090), retiré |
| 5 | `Dispatch/FenetreDecision.tsx` | Dispatch | Hors lot (refonte en cours) |
| 6 | `Trips/FicheVoyage.tsx` | Voyages & Rotations | Hors lot (refonte en cours) |
| 7 | `Trips/NouveauVoyage.tsx` | Voyages & Rotations | Hors lot (refonte en cours) |
| 8 | `Fiches/SaisieFiche.tsx` | Fiches terrain | Hors lot (refonte en cours) |
| 9 | `Fiches/FicheImprimable.tsx` | Fiches terrain (aperçu imprimable) | Hors lot (refonte en cours) |
| 10 | `Fiches/PeseeRelevesCbg.tsx` | Tickets CBG, relevés CBG (pièces) | À convertir |
| 11 | `Trips/KilometrageView.tsx` | Relevés kilométriques (pièces) | À convertir |
| 12 | `Fuel/LivraisonsCbgView.tsx` | Carburant : livraisons CBG (pièces) | À convertir |
| 13 | `Fuel/PleinsView.tsx` | Carburant : distribution | À convertir |
| 14 | `Facturation/ReconciliationView.tsx` | Réconciliation | Converti (D-090, complément J1), fenêtre retirée |
| 15 | `Facturation/RecouvrementView.tsx` | Recouvrement | Converti (D-090, complément J1), fenêtre et lettre en superposition retirées |
| 16 | `Facturation/FactureImprimable.tsx` | Factures (aperçu imprimable) | Converti (D-090, complément J1) : aperçu en pleine page |
| 17 | `Contrats/ContratsView.tsx` | Contrats | Converti (D-090, complément J1), fenêtre retirée |
| 18 | `Contrats/Formulaires.tsx` | Contrats | Converti (D-090, complément J1) : saisies en pleine page |
| 19 | `Contrats/FacturesNeembaView.tsx` | Factures Neemba | À convertir |
| 20 | `Contrats/ComitesView.tsx` | Comités | À convertir |
| 21 | `Contrats/EngagementsView.tsx` | Engagements | À convertir |
| 22 | `Planning/FenetresObjectif.tsx` | Planification | Converti (D-090, complément J1), fichier retiré |
| 23 | `Maintenance/FenetresImmobilisation.tsx` | Immobilisations | À convertir |
| 24 | `Documents/VehicleDocumentModal.tsx` | Documents de la flotte | À convertir |
| 25 | `Tracking/LiveMapView.tsx` | Suivi GPS | À convertir |
| 26 | `Tracking/VehicleDetailModal.tsx` | Suivi GPS | À convertir |
| 27 | `HR/EmployeeModal.tsx` | RH : employés | À convertir |
| 28 | `HR/EmployeeDetailsModal.tsx` | RH : employés | À convertir |
| 29 | `HR/PayrollModal.tsx` | RH : paie | À convertir |
| 30 | `HR/PayrollDetailsModal.tsx` | RH : paie | À convertir |
| 31 | `Settings/UserModal.tsx` | Paramètres : utilisateurs | À convertir |
| 32 | `Settings/AdminSettingsView.tsx` | Paramètres (fichier > 60 Ko : découper) | À convertir |
| 33 | `Layout/DeconnexionDialog.tsx` | Transverse : confirmation de déconnexion | Reste une fenêtre (confirmation brève) |
| 34 | `Search/GlobalSearchModal.tsx` | Transverse : recherche globale | Reste une fenêtre (palette de recherche) |
| 35 | `ui/PiecesJointes.tsx` | Transverse : `AttachmentModal` | Remplacée par l'onglet Pièces jointes au fil des conversions |

Complément J1 (2026-11-17) : sont aussi convertis, hors recensement
(fenêtres de la planification passant par `FenetresObjectif`, ou
`window.prompt`), `Planning/VentilationObjectif.tsx`,
`Planning/ClotureProduction.tsx` (annulation), `Postes/PostesView.tsx` et
`Facturation/FacturesView.tsx`. Restent avec un `window.prompt` :
`Contrats/EngagementsView.tsx` (remise du rapport) et
`Paiements/PaiementsView.tsx`.

Ordre conseillé : chaîne J1 d'abord (10 à 16, puis 17 à 19), puis J2
(13, 23, 24), puis les autres.
