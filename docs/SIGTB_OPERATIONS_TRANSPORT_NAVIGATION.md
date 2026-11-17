# Opérations transport : navigation (D-088)

## Espace du menu

Groupe « Opérations transport » (`src/components/Layout/menu.ts`), après les
accès directs, qui restent tous en place.

| Entrée | Identifiant | Écran ouvert |
|---|---|---|
| Vue générale | `operations` | nouveau (OperationsView) |
| Objectifs planifiés | `op-planification` (alias) | `planification` |
| Instances de shift | `op-postes` (alias) | `postes` |
| Affectation des voyages | `op-dispatch` (alias) | `dispatch` |
| Registre des voyages | `op-voyages` (alias) | `trips` |
| Cycle des fiches | `op-fiches` (alias) | `fiches` |
| Tickets et relevés CBG | `op-pesee` (alias) | `tickets-cbg` |
| Supervision du jour | `op-supervision` (alias) | `centre-pilotage` |
| Anomalies et écarts | `operations-anomalies` | nouveau |
| Journal des événements | `operations-journal` | nouveau |
| Contrôles et clôtures | `operations-controles` | nouveau |

Les alias (`ALIAS_MENU`, `resoudreVue`) ouvrent l'écran du module : un seul
écran par fonction, aucune copie. Les droits d'accès d'un alias sont ceux de
l'écran cible (Sidebar) ; les quatre écrans nouveaux suivent le droit
`trips` (anomalies : `trips` ou `invoices`).

## Adresses

| Adresse | Page |
|---|---|
| `#/operations?date=` | vue générale du jour |
| `#/trips?date=` | registre par état (phases) |
| `#/trips/<id>?onglet=` | fiche opérationnelle du voyage (synthese, affectations, etapes, chronologie, fiches, tickets, pieces, incidents, anomalies, controles, historique) |
| `#/trips/<id>/suspendre`, `/reprendre`, `/verifier?evenement=` | actions en pleine page |
| `#/fiches/<id>?onglet=` | fiche terrain (informations, rotations, ecarts, historique, pieces) |
| `#/fiches/<id>/<action>` | imprimer, remettre, retour, saisir-ligne, terminer-saisie, soumettre, controler, renvoyer, valider, archiver, annuler |
| `#/operations-journal`, `#/operations-anomalies`, `#/operations-controles` | listes transverses |

## Contexte conservé

Clés : `date`, `site`, `shift`, `camion`, `chauffeur`, `voyage`, `rotation`
(`CLES_CONTEXTE`, `avecContexte`). Entre écrans de l'espace
(`VUES_OPERATIONS`), le menu reporte le contexte de l'adresse courante.
Les liens de la fiche du voyage (Dispatch, Fiches terrain) et du registre
portent la date du voyage. Le Dispatch, les Fiches terrain, le registre et
les écrans transverses lisent `date` à l'ouverture. Non fait : lecture de
`site`, `shift`, `camion`, `chauffeur` par les écrans existants (ils gardent
leurs propres sélecteurs).

## Accès à la fiche du voyage

Depuis le registre (clic sur la ligne), le Dispatch (référence du voyage
dans la liste et dans « Voyages par état »), les fiches terrain (rotation
reliée), le journal, les anomalies et les contrôles.
