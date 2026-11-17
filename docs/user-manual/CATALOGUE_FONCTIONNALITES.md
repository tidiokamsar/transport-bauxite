# Catalogue des fonctionnalités SIGTB

Version SIGTB documentée : `origin/main` 1896cde (2026-11-17). Production constatée : release 31f7267 (journal de déploiement, `docs/SIGTB_MODULE_COVERAGE_MATRIX.md`, erratum du 2026-11-17). Date de rédaction : 2026-11-17 (`date -u`). Mission D-092, phase 1 (textes sans captures).

Source de données : `SIGTB_CATALOGUE_MODULES_ET_FONCTIONNALITES.csv` (séparateur point-virgule, UTF-8), d'où ce document et la matrice de cohérence sont produits. Le classeur .xlsx sera généré à partir du CSV en phase 3.

## Règles de classement

Chaque ligne a été vérifiée dans le code : écran (`src/components`), appel serveur (`supabase.rpc`, `supabase.from`), fonction SQL (`supabase/migrations`) et test (pgTAP `supabase/tests/database`, E2E `e2e/`, vitest).

| Statut | Sens |
|---|---|
| Opérationnelle et testée | L'écran appelle une règle serveur existante et un test pgTAP, E2E ou unitaire la couvre. Déployée en production sauf mention contraire. |
| Opérationnelle avec limites | Utilisable, mais avec une limite connue (écriture directe sous RLS sans fonction serveur ni journal, donnée manquante, seuil fixe). La limite est dans la colonne Remarque. |
| Partielle | Une partie seulement existe ; ne pas s'en servir pour un usage réel sans lire la remarque. |
| Visuelle seulement | Écran présent, sans donnée réelle possible aujourd'hui (aucun matériel, maquette). |
| Non disponible | N'existe pas dans l'application ; listé dans « Fonctionnalités à développer » du manuel général (chapitre 35). |
| Désactivée par configuration | Le code existe, inactif tant qu'un réglage ou un fournisseur n'est pas activé. |
| Réservée à un rôle | Réalisée et testée, accessible à un seul rôle (administrateur, directeur). |

Les rôles sont exprimés par droit de module (`trips`, `invoices`...) ; la correspondance entre droits et rôles est dans `00_INDEX.md`, section 3. Les renvois « MGU » pointent vers le manuel général (chapitre.section.procédure), « MAD » vers le manuel administrateur.

## Synthèse par statut

| Statut | Nombre |
|---|---|
| Opérationnelle et testée | 112 |
| Opérationnelle avec limites | 34 |
| Partielle | 7 |
| Visuelle seulement | 4 |
| Non disponible | 9 |
| Désactivée par configuration | 3 |
| Réservée à un rôle | 8 |
| **Total** | **177** |

## Synthèse par module

| Module | Opér. et testée | Opér. avec limites | Partielle | Visuelle seulement | Non disponible | Désactivée | Rôle | Total |
|---|---|---|---|---|---|---|---|---|
| Accès | 3 | 1 | 1 | 0 | 2 | 2 | 0 | 9 |
| Interface | 7 | 2 | 1 | 0 | 1 | 0 | 0 | 11 |
| Pilotage | 5 | 1 | 0 | 0 | 0 | 0 | 0 | 6 |
| Sites | 3 | 2 | 0 | 0 | 0 | 0 | 0 | 5 |
| Shifts | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 2 |
| Planification | 5 | 1 | 0 | 0 | 0 | 0 | 0 | 6 |
| Postes | 3 | 0 | 1 | 0 | 0 | 0 | 0 | 4 |
| Dispatch | 9 | 1 | 0 | 0 | 1 | 0 | 0 | 11 |
| Voyages | 8 | 1 | 0 | 0 | 1 | 0 | 0 | 10 |
| Kilométrage | 2 | 1 | 0 | 0 | 0 | 0 | 0 | 3 |
| Fiches terrain | 9 | 0 | 1 | 0 | 0 | 0 | 0 | 10 |
| Pesée CBG | 6 | 2 | 0 | 0 | 0 | 0 | 0 | 8 |
| Opérations transport | 5 | 0 | 0 | 0 | 0 | 0 | 0 | 5 |
| Flotte | 3 | 1 | 0 | 0 | 0 | 0 | 0 | 4 |
| Chauffeurs | 3 | 2 | 0 | 0 | 0 | 0 | 0 | 5 |
| Documents | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| Carburant | 6 | 3 | 0 | 1 | 0 | 0 | 0 | 10 |
| Maintenance | 2 | 2 | 0 | 0 | 0 | 0 | 0 | 4 |
| Pneus | 2 | 1 | 0 | 0 | 1 | 0 | 0 | 4 |
| Stocks | 3 | 1 | 0 | 0 | 0 | 0 | 0 | 4 |
| Achats | 2 | 0 | 0 | 0 | 1 | 0 | 0 | 3 |
| Fournisseurs | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 3 |
| Moyens généraux | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 2 |
| Contrats | 6 | 4 | 0 | 0 | 0 | 0 | 0 | 10 |
| Facturation | 6 | 0 | 0 | 0 | 0 | 0 | 1 | 7 |
| Finance | 3 | 1 | 0 | 0 | 0 | 0 | 0 | 4 |
| HSE | 3 | 0 | 0 | 0 | 0 | 1 | 0 | 4 |
| RH | 0 | 1 | 2 | 0 | 0 | 0 | 0 | 3 |
| Reporting | 1 | 4 | 0 | 0 | 0 | 0 | 0 | 5 |
| Suivi GPS | 0 | 0 | 1 | 3 | 0 | 0 | 0 | 4 |
| Paramètres | 1 | 0 | 0 | 0 | 0 | 0 | 7 | 8 |
| Portails | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 1 |
| Intelligence | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 1 |

## Détail par module

### Accès

| Fonctionnalité | Page ou route | Rôles | Statut | Preuve | Capture | Procédure | Remarque |
|---|---|---|---|---|---|---|---|
| Connexion par adresse et mot de passe | Page de connexion | Tous les comptes actifs | Opérationnelle et testée | Auth/LoginPage.tsx, AuthContext signIn + E2E connexion | Figure 2.1 | MGU 2.F.1 | Compte créé par l'administrateur |
| Se souvenir de moi | Page de connexion | Tous | Opérationnelle avec limites | Auth/LoginPage.tsx (souvenir local du navigateur) | Figure 2.1 | MGU 2.F.1 | Mémorisé sur le poste seulement |
| Connexion Microsoft 365 | Page de connexion, bouton Microsoft | Tous | Désactivée par configuration | LoginPage.tsx signInWithOAuth azure + aucun fournisseur azure dans deploy/vps/docker-compose.yml | Figure 2.1 | MGU 2.H | Le bouton existe, le fournisseur n'est pas configuré : message « Connexion Microsoft 365 indisponible » |
| Mot de passe oublié par courriel | Page de connexion, lien Mot de passe oublié | Tous | Non disponible | LoginPage.tsx (message : reinitialisation par e-mail non activee) + aucun SMTP | Figure 2.2 | MGU 2.F.4 | L'administrateur attribue un nouveau mot de passe |
| Changer son propre mot de passe | Sécurité du compte | Tous | Non disponible | Aucun appel updateUser dans src/ | Figure 2.4 | MGU 35 | L'administrateur attribue un nouveau mot de passe |
| Double authentification TOTP (inscription, retrait, code a la connexion) | Sécurité du compte (#/securite-compte), menu profil | Tous | Opérationnelle et testée | Auth/SecuriteCompte.tsx, VerificationMfa.tsx, garde_aal2 + pgTAP 24 + E2E double-authentification | Figure 2.4 | MGU 2.F.3 | - |
| Exigence MFA pour opérations sensibles (mfa_exige) | Sécurité du compte | Administrateur | Désactivée par configuration | settings mfa_exige, garde_aal2 + pgTAP 24 | Figure 2.4 | MAD 13 | Inactive tant que le propriétaire ne l'active pas (CLAUDE.md, toujours demander) |
| Déconnexion | Barre supérieure, menu profil, Se déconnecter | Tous | Opérationnelle et testée | Layout/TopBar.tsx signOut + E2E connexion | Figure 2.5 | MGU 2.F.2 | - |
| Langue de l'interface français ou anglais | Menu profil, Langue | Tous | Partielle | LanguageContext.tsx + libelles majoritairement en francais | Figure 2.5 | MGU 3.D | Traduction anglaise incomplète |

### Interface

| Fonctionnalité | Page ou route | Rôles | Statut | Preuve | Capture | Procédure | Remarque |
|---|---|---|---|---|---|---|---|
| Menu latéral filtre par droits de lecture | Menu latéral | Tous | Opérationnelle et testée | Layout/menu.ts, Sidebar.tsx, AuthContext.tsx + E2E droits-utilisateurs | Figure 3.1 | MGU 3.D | Le masquage est un confort, la barrière est serveur |
| Sélecteur de site du menu (filtre d'affichage) | Menu latéral | Tous | Opérationnelle avec limites | contexts/SiteContext.tsx + E2E perimetre-site | Figure 3.1 | MGU 3.D | Filtre d'affichage, pas une barrière de sécurité |
| Recherche globale (Ctrl+K) | Menu latéral, Rechercher | Tous selon droits | Opérationnelle et testée | Search/GlobalSearchModal.tsx, recherche.ts (engins, chauffeurs, voyages, ordres, factures, sites) + vitest recherche.test | Figure 3.2 | MGU 3.F.1 | Ne cherche pas dans les documents |
| Compteur Mes validations et compteur d'alertes | Barre supérieure | Tous | Opérationnelle et testée | TopBar.tsx, mes_validations, actualiser_alertes + E2E mes-validations, decisions-hse | Figure 3.3 | MGU 3.D | - |
| Indicateur du shift en cours | Barre supérieure | Tous | Opérationnelle et testée | TopBar.tsx (instance ouverte ou en cours, D-087) + E2E dispatch-control-center | Figure 3.3 | MGU 3.D | Affiche non ouvert, hors plage, aucun shift défini sinon |
| Pages standard liste, fiche, formulaire, action (adresse #/vue/id) | Modules convertis | Tous | Opérationnelle et testée | ui/PageListe, PageDetail, PageFormulaire, PageAction, routeur.ts + vitest liste, routeur + E2E pages-standard | Figure 3.4 | MGU 3.F.2 | Convertis : Sites, Véhicules, Chauffeurs, Planification, Postes, Contrats, Réconciliation, Factures, Recouvrement, fiche voyage, fiche terrain |
| Export CSV des listes standard | Pages liste converties | Selon droit de lecture | Opérationnelle et testée | ui/PageListe.tsx, liste.ts + E2E pages-standard | Figure 3.4 | MGU 3.F.3 | Pas d'export Excel natif ni PDF serveur |
| Onglet Historique des fiches | Pages détail converties | Selon droit de lecture | Opérationnelle avec limites | ui/Historique.tsx, evenements.ts | Figure 3.5 | MGU 3.D | Un module sans journal le dit (sites, chauffeurs limités) |
| Pièces jointes PDF, JPEG, PNG, WebP (CSV, XLSX pour relevé CBG), 10 Mio | Voyage, ticket CBG, relevé compteur, relevé CBG, livraison carburant CBG | Droit d'ecriture du module de l'objet | Opérationnelle et testée | ui/PiecesJointes.tsx, enregistrer_piece_jointe, confirmer_piece_jointe, annuler_piece_jointe + pgTAP 64 + E2E pieces-jointes | Figure 3.6 | MGU 3.F.4 | Pas de pièces sur les autres objets (onglet affiché l'ecart) |
| Fonctionnement hors ligne | Indicateur hors ligne | Tous | Non disponible | Offline/OfflineIndicator.tsx affiche l'etat, aucune file de saisie utilisee | - | MGU 3.H | Saisie a refaire sans connexion |
| Actions rapides | Route #/quick-actions sans entrée de menu | Tous | Partielle | QuickActions/QuickActionsPanel.tsx (raccourcis de navigation) | - | - | Route orpheline, sans lien dans le menu |

### Pilotage

| Fonctionnalité | Page ou route | Rôles | Statut | Preuve | Capture | Procédure | Remarque |
|---|---|---|---|---|---|---|---|
| Tableau de bord (indicateurs avec source, période, fiabilité, heure) | Tableau de bord | Lecture dashboard | Opérationnelle et testée | Dashboard/DashboardView.tsx, indicateurs_pilotage + pgTAP 40 + E2E tableau-de-bord | Figure 4.1 | MGU 4.F.1 | - |
| Centre de pilotage (filtres site, shift, véhicule, partenaire, comparaison de périodes, export CSV, impression) | Centre de pilotage | Lecture dashboard | Opérationnelle et testée | Pilotage/CentrePilotageView.tsx, indicateurs_pilotage + pgTAP 40, 51 + E2E centre-pilotage | Figure 4.2 | MGU 4.F.2 | Pas de graphique d'evolution ni widgets finance du DG |
| Mes validations (liste calculée des décisions en attente) | Mes validations | Tous selon droits | Opérationnelle et testée | Notifications/MesValidationsView.tsx, mes_validations + pgTAP 39 + E2E mes-validations | Figure 5.1 | MGU 5.F.1 | La décision se prend dans l'ecran du module |
| Notifications personnelles et marquage lu | Mes validations | Tous | Opérationnelle avec limites | marquer_notifications_lues + pgTAP 39 | Figure 5.2 | MGU 5.F.2 | Pas de courriel ni SMS |
| Centre des décisions (alertes et décisions par priorité) | Exploitation > Centre des décisions | Lecture du module de la règle | Opérationnelle et testée | Decisions/CentreDecisionsView.tsx, centre_decisions, actualiser_alertes, regles_alertes + pgTAP 51 + E2E decisions-hse | Figure 6.1 | MGU 6.F.1 | Alertes a seuil inactives tant que le seuil n'est pas saisi |
| Prendre en compte, résoudre une alerte (motif) | Centre des décisions | Écriture du module de la règle | Opérationnelle et testée | resoudre_alerte + pgTAP 51 | Figure 6.2 | MGU 6.F.2 | - |

### Sites

| Fonctionnalité | Page ou route | Rôles | Statut | Preuve | Capture | Procédure | Remarque |
|---|---|---|---|---|---|---|---|
| Liste et fiche des sites | Exploitation > Sites (#/sites) | Lecture settings ou du module | Opérationnelle et testée | Sites/SitesView.tsx, DetailSite.tsx + E2E saisie-referentiels, organisation | Figure 7.1 | MGU 7.F.1 | - |
| Créer, modifier un site | #/sites/nouveau, #/sites/id/modifier | Écriture settings | Opérationnelle avec limites | FormulaireSite.tsx (ecriture sous RLS) + pgTAP 60 + E2E saisie-referentiels | Figure 7.2 | MGU 7.F.2 | Pas de fonction serveur ni de journal du site |
| Désactiver, réactiver un site | Fiche du site | Écriture settings | Opérationnelle avec limites | ActionSite.tsx (mise a jour sous RLS, sans motif) | Figure 7.3 | MGU 7.F.3 | Aucun motif conservé |
| Infrastructures du site (points de chargement, dépôts, pont-bascule, etc.) | Exploitation > Infrastructures et fermetures | Écriture settings ou administrateur | Opérationnelle et testée | Sites/InfrastructuresView.tsx + pgTAP 30 + E2E infrastructures | Figure 7.4 | MGU 7.F.4 | - |
| Fermeture de site ou d'infrastructure, levée anticipée motivée | Infrastructures et fermetures | Écriture settings ou administrateur | Opérationnelle et testée | fermetures_site + pgTAP 30 + E2E infrastructures | Figure 7.5 | MGU 7.F.5 | Fermeture du site entier bloque le dispatch |

### Shifts

| Fonctionnalité | Page ou route | Rôles | Statut | Preuve | Capture | Procédure | Remarque |
|---|---|---|---|---|---|---|---|
| Définir un shift (création, modification motivée, nuit) | Exploitation > Shifts | Administrateur ou écriture settings, profil sans site | Opérationnelle et testée | Shifts/ShiftsView.tsx, definir_shift + pgTAP 61 + E2E defauts-bloquants | Figure 8.1 | MGU 8.F.1 | - |
| Désactiver un shift (motif) et journal | Exploitation > Shifts | Idem | Opérationnelle et testée | desactiver_shift, journal_shifts + pgTAP 61 | Figure 8.2 | MGU 8.F.2 | Jamais de suppression |

### Planification

| Fonctionnalité | Page ou route | Rôles | Statut | Preuve | Capture | Procédure | Remarque |
|---|---|---|---|---|---|---|---|
| Définir, réviser (version motivée), annuler un objectif | Planification (#/planification), Objectifs du jour | Écriture planning | Opérationnelle et testée | Planning/PlanificationView.tsx, PagesObjectif.tsx, definir_objectif, annuler_objectif + pgTAP 10, 61 + E2E planification | Figure 9.1 | MGU 9.F.1 | - |
| Registre des objectifs | Planification, Registre des objectifs | Lecture planning | Opérationnelle et testée | PlanificationView.tsx + E2E planification-avancee | Figure 9.2 | MGU 9.D | - |
| Ventiler un objectif par destination ou contrat | Planification | Écriture planning | Opérationnelle et testée | VentilationObjectif.tsx, ventiler_objectif + pgTAP 46 | Figure 9.3 | MGU 9.F.2 | - |
| Simulation et rattrapage (lecture seule) | Planification, Simulation et rattrapage | Lecture planning | Opérationnelle avec limites | simuler_objectif + pgTAP 46 | Figure 9.4 | MGU 9.F.3 | Seuils d'echantillon fixes (3 jours, 10 voyages) |
| Clôture de la journée, annulation de clôture, rapport de production | Planification, Clôture et rapport | Écriture planning | Opérationnelle et testée | ClotureProduction.tsx, cloturer_planification, annuler_cloture_planification, rapport_production + pgTAP 46 | Figure 9.5 | MGU 9.F.4 | - |
| Comparaison des shifts | Planification, Comparaison des shifts | Lecture planning | Opérationnelle et testée | comparer_shifts + pgTAP 46 | Figure 9.6 | MGU 9.D | - |

### Postes

| Fonctionnalité | Page ou route | Rôles | Statut | Preuve | Capture | Procédure | Remarque |
|---|---|---|---|---|---|---|---|
| Ouvrir un poste, composer l'equipe, pointer la présence | Postes de travail (#/postes) | Écriture trips | Opérationnelle et testée | Postes/PostesView.tsx, FormulairePoste.tsx, ouvrir_poste, affecter_au_poste, pointer_presence + pgTAP 31 + E2E postes | Figure 10.1 | MGU 10.F.1 | - |
| Consigner un événement de poste | Fiche du poste | Écriture trips | Opérationnelle et testée | consigner_evenement_poste + pgTAP 31 | Figure 10.2 | MGU 10.F.2 | - |
| Clôturer un poste et valider la clôture (autre personne) | Fiche du poste | Écriture trips, validation écriture planning | Opérationnelle et testée | cloturer_poste, valider_cloture_poste + pgTAP 31, 65 | Figure 10.3 | MGU 10.F.3 | - |
| Annuler un poste ou retirer un membre | Fiche du poste | Écriture trips | Partielle | changer_etat_poste (annulation motivee d'une instance, D-087) + retrait d'un membre absent | Figure 10.3 | MGU 10.H | Retrait d'un membre non disponible |

### Dispatch

| Fonctionnalité | Page ou route | Rôles | Statut | Preuve | Capture | Procédure | Remarque |
|---|---|---|---|---|---|---|---|
| Shift et préparation : planifier l'instance, besoin calculé, confirmer le plan | Dispatch, onglet Shift et préparation | Écriture trips | Opérationnelle et testée | Dispatch/PanneauShift.tsx, planifier_poste, besoin_shift, confirmer_plan_shift + pgTAP 65 + E2E dispatch-control-center | Figure 11.1 | MGU 11.F.1 | Besoin vide sans objectif, capacité ou hypothèse |
| Recommandation d'affectation expliquée | Dispatch, onglet Affectations | Lecture trips | Opérationnelle et testée | recommandation.ts, controle.ts + vitest recommandation, controle + pgTAP 11 | Figure 11.2 | MGU 11.F.2 | Calculée dans l'interface, règles fixes |
| Affecter un voyage (accepter, modifier, refuser, motif) | Dispatch, Affectations | Écriture trips | Opérationnelle et testée | FenetreDecision.tsx, affecter_voyage, decider_affectation + pgTAP 11, 49, 65 + E2E dispatch | Figure 11.3 | MGU 11.F.2 | - |
| Affectation groupée et rapport | Dispatch, Affectations | Écriture trips | Opérationnelle et testée | affecter_en_groupe + pgTAP 49 + E2E dispatch-voyages | Figure 11.4 | MGU 11.F.3 | 300 voyages maximum |
| Suspendre et reprendre un voyage | Dispatch, fiche du voyage | Écriture trips | Opérationnelle et testée | FenetreSuspension.tsx, suspendre_voyage, reprendre_voyage + pgTAP 65 | Figure 11.5 | MGU 11.F.4 | - |
| Voyages par état | Dispatch, Voyages par état | Lecture trips | Opérationnelle et testée | VoyagesParEtat.tsx + E2E dispatch-control-center | Figure 11.6 | MGU 11.D | - |
| Supervision et indicateurs du dispatch | Dispatch, Supervision | Lecture trips | Opérationnelle et testée | SupervisionDispatch.tsx, TableauDeBordDispatch.tsx, supervision_dispatch, indicateurs_dispatch + pgTAP 65 | Figure 11.7 | MGU 11.D | - |
| Journal des décisions | Dispatch, Journal | Lecture trips | Opérationnelle et testée | decisions_dispatch + pgTAP 11 | Figure 11.8 | MGU 11.D | - |
| Simulation de scénarios | Dispatch | Lecture trips | Opérationnelle avec limites | SimulationScenarios.tsx, statistiques_trajets + vitest simulation + pgTAP 49 | Figure 11.9 | MGU 11.F.5 | Données insuffisantes sous le minimum de rotations |
| Clôturer le shift avec voyages non terminés (motif) | Dispatch, Shift | Écriture trips | Opérationnelle et testée | cloturer_shift + pgTAP 65 | Figure 11.1 | MGU 11.F.6 | - |
| Carte des positions, files d'attente, optimisation par distance | Dispatch | - | Non disponible | D-087 limites : aucune donnee GPS, distance ou file d'attente | - | MGU 35 | Aucun matériel GPS |

### Voyages

| Fonctionnalité | Page ou route | Rôles | Statut | Preuve | Capture | Procédure | Remarque |
|---|---|---|---|---|---|---|---|
| Registre des voyages (filtres, contexte d'adresse) | Voyages et Rotations (#/trips) | Lecture trips | Opérationnelle avec limites | Trips/TripsView.tsx + E2E voyages, operations-transport | Figure 12.1 | MGU 12.D | Historique multi-jours limite |
| Créer un voyage (référence VYG-AAMMJJ-NNN) | Voyages et Rotations, Créer le voyage | Écriture trips | Opérationnelle et testée | creer_voyage + pgTAP 09 + E2E voyages | Figure 12.2 | MGU 12.F.1 | - |
| Avancer le cycle du voyage (étapes, heures, pesée) | Fiche voyage, fenêtre de saisie | Écriture trips | Opérationnelle et testée | Trips/FicheVoyage.tsx, avancer_voyage, trips_garde_cycle + pgTAP 09 + E2E voyages | Figure 12.3 | MGU 12.F.2 | - |
| Fiche opérationnelle du voyage (synthèse, affectations, étapes, chronologie, fiches, tickets, documents, incidents, anomalies, contrôles, historique) | #/trips/id | Lecture trips | Opérationnelle et testée | Operations/DetailVoyage.tsx, v_journal_voyage, controles_voyage + pgTAP 66 + E2E operations-transport | Figure 12.4 | MGU 12.F.3 | - |
| Vérifier, valider ou contester un événement déclaré | Fiche voyage, action Vérifier | Écriture trips, autre personne que l'auteur | Opérationnelle et testée | ActionVoyage.tsx, verifier_evenement_voyage + pgTAP 66 | Figure 12.5 | MGU 12.F.4 | - |
| Rattacher un ticket CBG remis après livraison (motif) | Fiche voyage | Écriture trips | Opérationnelle et testée | rattacher_ticket_cbg, garde_reception_cbg + pgTAP 61 | Figure 12.6 | MGU 12.F.5 | - |
| Enchaîner le voyage suivant | Fiche d'un voyage livré | Écriture trips | Opérationnelle et testée | enchainer_voyage + pgTAP 49 + E2E dispatch-voyages | Figure 12.7 | MGU 12.F.6 | - |
| Déclarer un incident depuis le voyage | Fiche voyage | Écriture trips | Opérationnelle et testée | declarer_incident + pgTAP 37, 49 | Figure 12.8 | MGU 30.F.3 | - |
| Rapports par axe (camion, chauffeur, site, shift) et export CSV | Voyages et Rotations, Rapports par axe | Lecture trips | Opérationnelle et testée | rapport_voyages + pgTAP 49 | Figure 12.9 | MGU 12.F.7 | 367 jours maximum |
| Événement correctif d'un voyage (corriger une étape saisie) | Fiche voyage | - | Non disponible | Aucune fonction de correction d'etape (catalogue module 07) | - | MGU 35 | Annulation du voyage seulement |

### Kilométrage

| Fonctionnalité | Page ou route | Rôles | Statut | Preuve | Capture | Procédure | Remarque |
|---|---|---|---|---|---|---|---|
| Distances de référence site a site | Kilométrage | Écriture contracts ou administrateur | Opérationnelle avec limites | Trips/KilometrageView.tsx (distances_reference sous RLS) + pgTAP 27 + E2E kilometrage | Figure 13.1 | MGU 13.F.1 | Désactivation, pas de suppression |
| Saisir et corriger un relevé de compteur (motif) | Kilométrage | Écriture trips | Opérationnelle et testée | saisir_releve_compteur, corriger_releve_compteur + pgTAP 27 | Figure 13.2 | MGU 13.F.2 | Pièce jointe possible |
| Valider la distance d'un voyage (autre personne) | Kilométrage | Écriture contracts | Opérationnelle et testée | valider_distance_voyage + pgTAP 27 | Figure 13.3 | MGU 13.F.3 | - |

### Fiches terrain

| Fonctionnalité | Page ou route | Rôles | Statut | Preuve | Capture | Procédure | Remarque |
|---|---|---|---|---|---|---|---|
| Préparer les fiches FR, FP, FC d'un shift | Fiches terrain (#/fiches) | Écriture trips (FR), maintenance (FP), fuel (FC) | Opérationnelle et testée | Fiches/FichesView.tsx, preparer_fiche + pgTAP 14, 71 + E2E fiches | Figure 14.1 | MGU 14.F.1 | - |
| Imprimer les fiches A4 (réimpression motivée) | Fiches terrain, fiche | Idem | Opérationnelle et testée | FicheImprimable.tsx, enregistrer_impression_fiches + pgTAP 71 | Figure 14.2 | MGU 14.F.2 | - |
| Remettre a l'agent et enregistrer le retour | Fiche terrain #/fiches/id | Idem | Opérationnelle et testée | remettre_fiches, enregistrer_retour_fiches, PagesFiche.tsx + pgTAP 71 + E2E operations-transport | Figure 14.3 | MGU 14.F.3 | - |
| Saisir une fiche FR (rotations, ticket CBG en tonnes) | Fiches terrain, Saisir | Écriture trips | Opérationnelle et testée | SaisieFiche.tsx, saisir_rotation, saisir_ligne_rotation + pgTAP 14, 61, 71 + E2E fiches | Figure 14.4 | MGU 14.F.4 | - |
| Saisir une fiche FP (horamètres, arrêts) | Fiches terrain, Saisir | Écriture maintenance | Opérationnelle et testée | saisir_pointage + pgTAP 14 | Figure 14.5 | MGU 14.F.5 | Chaque arrêt créé une immobilisation |
| Saisir une fiche FC (pleins) | Fiches terrain, Saisir | Écriture fuel | Opérationnelle et testée | saisir_carburant + pgTAP 14, 25 | Figure 14.6 | MGU 14.F.6 | - |
| Terminer la saisie, soumettre au contrôle | Fiche terrain | Droit du type de fiche | Opérationnelle et testée | terminer_saisie_fiche, soumettre_fiche_controle + pgTAP 71 | Figure 14.7 | MGU 14.F.7 | - |
| Contrôler, renvoyer en correction, valider (autre personne), archiver | Fiche terrain | Droit du type de fiche, valideur distinct | Opérationnelle et testée | controler_fiche, renvoyer_fiche_correction, valider_fiche, archiver_fiche, v_fiches_ecarts_courants + pgTAP 71 + vitest cycleFiche | Figure 14.8 | MGU 14.F.8 | - |
| Annuler une fiche (motif) | Fiche terrain | Droit du type de fiche | Opérationnelle et testée | annuler_fiche + pgTAP 14, 71 | Figure 14.9 | MGU 14.F.9 | Refus si fiche portée par un ticket ou une sortie de stock |
| Lots de fiches, attribution, brouillon serveur | Fiches terrain | - | Partielle | creer_lot_fiches, attribuer_fiches, enregistrer_brouillon_fiche existent au serveur (D-089), pas d'ecran dedie | - | MGU 35 | Écran au lot suivant |

### Pesée CBG

| Fonctionnalité | Page ou route | Rôles | Statut | Preuve | Capture | Procédure | Remarque |
|---|---|---|---|---|---|---|---|
| A. Importer un relevé officiel CBG (CSV, empreinte, aperçu) | Pesée CBG, espace A (#/tickets-cbg) | Écriture trips | Opérationnelle et testée | Fiches/PeseeRelevesCbg.tsx, importer_releve_cbg_v2, releveCbg.ts + pgTAP 33, 62 + E2E tickets-cbg | Figure 15.1 | MGU 15.F.1 | Pas d'import PDF ni OCR |
| Annuler un relevé CBG (motif, autre personne, droit facturation) | Espace A | Écriture invoices, autre que l'importateur | Opérationnelle et testée | annuler_releve_cbg + pgTAP 62 | Figure 15.2 | MGU 15.F.2 | - |
| B. Fiche terrain KOGON (relevé observé, brouillon local, correction motivée) | Espace B | Écriture trips | Opérationnelle avec limites | PeseeFichesKogon.tsx, saisir_releve_terrain_kogon + pgTAP 62 + E2E tickets-cbg | Figure 15.3 | MGU 15.F.3 | Brouillon dans le navigateur du poste seulement |
| C. Rapprochement CBG et KOGON, tolérance versionnée | Espace C | Écriture trips, tolérance écriture settings | Opérationnelle et testée | PeseeRapprochement.tsx, rapprocher_pesees, definir_tolerance_pesee, tolerance_pesee_applicable + pgTAP 62 | Figure 15.4 | MGU 15.F.4 | - |
| D. Anomalies : examiner, conclure, soumettre, clôturer ou renvoyer | Espace D | Écriture trips, clôture écriture invoices distincte | Opérationnelle et testée | PeseeAnomalies.tsx, agir_anomalie_pesee + pgTAP 62, 63 | Figure 15.5 | MGU 15.F.5 | - |
| Rectifier un ticket CBG (motif, autre personne) | Réconciliation, ligne | Écriture trips et invoices | Opérationnelle avec limites | rectifier_ticket_pesee_cbg + pgTAP 15 | Figure 15.6 | MGU 15.F.6 | Ticket rectifié non facturable (question D-078 point 7) |
| Liste des voyages livrés sans ticket | Pesée CBG | Lecture trips | Opérationnelle et testée | v_voyages_livres_sans_ticket + pgTAP 61 | Figure 15.7 | MGU 15.D | - |
| Pièces jointes du relevé CBG (CSV, XLSX, PDF, images) | Espace A | Écriture trips | Opérationnelle et testée | PiecesJointes objet releve_cbg + pgTAP 64 | Figure 15.1 | MGU 3.F.4 | - |

### Opérations transport

| Fonctionnalité | Page ou route | Rôles | Statut | Preuve | Capture | Procédure | Remarque |
|---|---|---|---|---|---|---|---|
| Vue générale | Opérations transport > Vue générale | Lecture trips | Opérationnelle et testée | Operations/OperationsView.tsx + E2E operations-transport | Figure 16.1 | MGU 16.D | - |
| Journal des événements (v_journal_voyage) | Opérations transport > Journal des événements | Lecture trips | Opérationnelle et testée | v_journal_voyage + pgTAP 66 + vitest journal | Figure 16.2 | MGU 16.F.1 | - |
| Anomalies et écarts | Opérations transport > Anomalies et écarts | Lecture trips | Opérationnelle et testée | anomalies_pesee, OperationsView.tsx + pgTAP 66 | Figure 16.3 | MGU 16.F.2 | - |
| Contrôles et clôtures | Opérations transport > Contrôles et clôtures | Lecture trips | Opérationnelle et testée | controles_voyage + pgTAP 66 | Figure 16.4 | MGU 16.F.3 | Constats sans écriture |
| Alias vers Planification, Postes, Dispatch, Registre, Fiches, Pesée, Supervision | Opérations transport | Selon droits | Opérationnelle et testée | menu.ts ALIAS_MENU + E2E operations-transport | Figure 16.1 | MGU 16.D | Contexte date, site, shift dans l'adresse |

### Flotte

| Fonctionnalité | Page ou route | Rôles | Statut | Preuve | Capture | Procédure | Remarque |
|---|---|---|---|---|---|---|---|
| Liste et fiche des engins | Flotte > Véhicules et engins (#/vehicles) | Lecture vehicles | Opérationnelle et testée | Vehicles/VehiclesView.tsx, DetailVehicule.tsx, v_vehicules, v_fiche_vehicule + pgTAP 45 + E2E flotte | Figure 17.1 | MGU 17.F.1 | - |
| Créer, modifier un engin | #/vehicles/nouveau | Écriture vehicles | Opérationnelle avec limites | FormulaireVehicule.tsx (ecriture sous RLS) + pgTAP 45 | Figure 17.2 | MGU 17.F.2 | Pas d'import en masse |
| Propriété et rattachement au contrat de location | Fiche engin | Écriture vehicles | Opérationnelle et testée | definir_propriete_vehicule, contrats_rattachables_flotte + pgTAP 45 | Figure 17.3 | MGU 17.F.3 | - |
| Suspendre, remettre en service, réformer un engin (motif) | Fiche engin | Écriture vehicles | Opérationnelle et testée | suspendre_vehicule, remettre_en_service_vehicule, reformer_vehicule, journal_flotte + pgTAP 45 | Figure 17.4 | MGU 17.F.4 | - |

### Chauffeurs

| Fonctionnalité | Page ou route | Rôles | Statut | Preuve | Capture | Procédure | Remarque |
|---|---|---|---|---|---|---|---|
| Liste et fiche des chauffeurs | Flotte > Chauffeurs (#/drivers) | Lecture drivers | Opérationnelle et testée | Drivers/DriversView.tsx, DetailChauffeur.tsx + E2E defauts-bloquants, pages-standard | Figure 18.1 | MGU 18.F.1 | - |
| Créer, modifier un chauffeur | #/drivers/nouveau | Écriture drivers | Opérationnelle avec limites | FormulaireChauffeur.tsx (ecriture sous RLS) + E2E defauts-bloquants | Figure 18.2 | MGU 18.F.2 | Pas de journal ni de motif de statut |
| Suspendre, réactiver, archiver un chauffeur | Fiche chauffeur | Écriture drivers | Opérationnelle avec limites | ActionChauffeur.tsx (mise a jour sous RLS, sans motif) | Figure 18.3 | MGU 18.F.3 | - |
| Habilitations (saisie, révocation motivée, types exigés) | Flotte > Habilitations chauffeurs | Écriture drivers, types exigés administrateur | Opérationnelle et testée | Drivers/HabilitationsView.tsx, v_habilitations_a_renouveler, garde_habilitations_voyage + pgTAP 34 + E2E habilitations | Figure 18.4 | MGU 18.F.4 | - |
| Infractions et sanctions | Fiche chauffeur, Infractions | Écriture drivers ou trips, sanction approbation drivers | Opérationnelle et testée | enregistrer_infraction, decider_sanction, annuler_sanction, annuler_infraction + pgTAP 49 | Figure 18.5 | MGU 18.F.5 | Sanction en avertissement au dispatch, non bloquante |

### Documents

| Fonctionnalité | Page ou route | Rôles | Statut | Preuve | Capture | Procédure | Remarque |
|---|---|---|---|---|---|---|---|
| Documents des engins (assurance, carte grise, visite), alertes d'expiration, archivage | Flotte > Documents | Écriture vehicles | Opérationnelle avec limites | Documents/VehicleDocumentsView.tsx, v_documents_vehicule_a_renouveler + pgTAP 45 | Figure 19.1 | MGU 19.F.1 | Métadonnées seulement, pas de fichier joint ni d'export |

### Carburant

| Fonctionnalité | Page ou route | Rôles | Statut | Preuve | Capture | Procédure | Remarque |
|---|---|---|---|---|---|---|---|
| Distribution aux engins (plein isolé) | Carburant > Distribution aux engins | Écriture fuel | Opérationnelle et testée | Fuel/PleinsView.tsx, saisir_plein + pgTAP 25 + E2E stocks-carburant | Figure 20.1 | MGU 20.F.1 | Sans cuve suivie : pas de sortie de stock |
| Livraisons CBG, factures CBG et contrôle | Carburant > Livraisons et factures CBG | Écriture fuel | Opérationnelle et testée | LivraisonsCbgView.tsx, enregistrer_livraison_cbg, enregistrer_facture_carburant_cbg, controler_facture_carburant_cbg + pgTAP 16, 25 | Figure 20.2 | MGU 20.F.2 | Pas de correction tracée d'une livraison |
| Cuves et citernes | Carburant > Réceptions, cuves et inventaires | Écriture fuel | Opérationnelle avec limites | StocksCarburantView.tsx (stockages_carburant sous RLS) + pgTAP 25 | Figure 20.3 | MGU 20.F.3 | - |
| Réception d'une livraison en cuve (écart motivé) | Réceptions, cuves et inventaires | Écriture fuel | Opérationnelle et testée | receptionner_livraison_cbg + pgTAP 25, 52 | Figure 20.4 | MGU 20.F.4 | - |
| Transfert entre stockages | Réceptions, cuves et inventaires | Écriture fuel | Opérationnelle et testée | transferer_carburant + pgTAP 25, 52 | Figure 20.5 | MGU 20.F.5 | - |
| Inventaire de cuve et décision (autre personne) | Réceptions, cuves et inventaires | Écriture fuel | Opérationnelle et testée | saisir_inventaire_carburant, decider_inventaire_carburant + pgTAP 25, 51 | Figure 20.6 | MGU 20.F.6 | - |
| Valider ou rejeter un mouvement, annuler un mouvement valide | Réceptions, cuves et inventaires | Écriture fuel, autre personne | Opérationnelle et testée | decider_mouvement_carburant, annuler_mouvement_carburant + pgTAP 25, 52 | Figure 20.7 | MGU 20.F.7 | - |
| Analyse carburant (litres par tonne et par heure) | Carburant > Analyse carburant | Lecture fuel | Opérationnelle avec limites | AnalyseCarburantView.tsx, consommation_carburant + pgTAP 17 | Figure 20.8 | MGU 20.D | - |
| Anomalies carburant (seuil saisi a l'ecran) | Carburant > Anomalies | Lecture fuel | Opérationnelle avec limites | AnomaliesCarburantView.tsx, anomalies_carburant + pgTAP 16 | Figure 20.9 | MGU 20.D | - |
| Jauges connectées | Carburant > Jauges connectées | Lecture fuel | Visuelle seulement | CapteursCarburantView.tsx, iot_devices, iot_fuel_readings + pgTAP 16 | Figure 20.10 | MGU 33 | Aucun matériel installé : sans données |

### Maintenance

| Fonctionnalité | Page ou route | Rôles | Statut | Preuve | Capture | Procédure | Remarque |
|---|---|---|---|---|---|---|---|
| Déclarer, clôturer, corriger, annuler une immobilisation | Maintenance > Immobilisations | Écriture maintenance | Opérationnelle et testée | Maintenance/ImmobilisationsView.tsx, declarer_immobilisation, cloturer_immobilisation, corriger_immobilisation, annuler_immobilisation + pgTAP 12 + E2E immobilisations | Figure 21.1 | MGU 21.F.1 | - |
| Interventions Neemba (demande, prise en charge, fin, remise validée par autre personne) | Maintenance > Interventions Neemba | Écriture maintenance | Opérationnelle et testée | InterventionsLoueurView.tsx, demander_intervention_loueur, prendre_en_charge_intervention, terminer_intervention, valider_remise_en_service + pgTAP 32 + E2E interventions-loueur | Figure 21.2 | MGU 21.F.2 | Délai contractuel saisi a la main |
| Ordres de travail (numéro serveur, pièces par mouvement de stock, annulation motivée) | Maintenance > Ordres de travail | Écriture maintenance | Opérationnelle avec limites | MaintenanceView.tsx (maintenance_orders sous RLS), annuler_ordre_travail, pieces_ordre_travail + pgTAP 44, 55 | Figure 21.3 | MGU 21.F.3 | Hors modèle de location : maintenance des engins loués chez Neemba |
| Préventif interne | Maintenance > Préventif | Écriture maintenance | Opérationnelle avec limites | PreventiveMaintenanceView.tsx (maintenance_schedules sous RLS) + pgTAP 44 | Figure 21.4 | MGU 21.F.4 | Signale un engin loué |

### Pneus

| Fonctionnalité | Page ou route | Rôles | Statut | Preuve | Capture | Procédure | Remarque |
|---|---|---|---|---|---|---|---|
| Entrée en stock, montage, démontage, permutation, inspection, réparation, rechapage, réforme, annulation | Pneus | Écriture vehicles ou maintenance | Opérationnelle et testée | Pneus/PneusView.tsx, enregistrer_pneu, monter_pneu, demonter_pneu, permuter_pneu, inspecter_pneu, reparer_pneu, rechaper_pneu, reformer_pneu, annuler_operation_pneu + pgTAP 35, 50 + E2E pneus | Figure 22.1 | MGU 22.F.1 | - |
| Pneus a surveiller et seuils | Pneus | Lecture vehicles, seuils administrateur | Opérationnelle et testée | v_pneus_a_surveiller, settings pneu_* + pgTAP 35 | Figure 22.2 | MGU 22.F.2 | Sans seuil aucune alerte |
| Performance par marque et modèle | Pneus, Performance | Lecture vehicles | Opérationnelle avec limites | v_pneus_performance + pgTAP 50 | Figure 22.3 | MGU 22.D | Seulement pneus réformés aux mesures complètes |
| Cycle de vie complet (carcasse PN, episodes, contrôle des positions) D-091 | Pneus | - | Non disponible | Migration 20261121230000, pgTAP 72 : serveur fusionne, non deploye, sans ecran | - | MGU 35 | Écran au lot suivant |

### Stocks

| Fonctionnalité | Page ou route | Rôles | Statut | Preuve | Capture | Procédure | Remarque |
|---|---|---|---|---|---|---|---|
| Mouvements (entrée, sortie, transfert, retour), annulation motivée | Stocks & Achats > Stocks | Écriture stock | Opérationnelle et testée | Stock/StockView.tsx, mouvement_stock, annuler_mouvement_stock + pgTAP 28 + E2E stocks-magasin | Figure 23.1 | MGU 23.F.1 | - |
| Articles et dépôts | Stocks | Écriture stock | Opérationnelle avec limites | StockView.tsx (stock_items, warehouses sous RLS) | Figure 23.2 | MGU 23.F.2 | Pas d'import d'articles |
| Inventaire d'article et de lot | Stocks | Écriture stock | Opérationnelle et testée | inventorier_stock, inventorier_lot_stock + pgTAP 28, 50 | Figure 23.3 | MGU 23.F.3 | - |
| Réservations, lots et séries, valorisation CMP | Stocks, panneaux | Écriture stock | Opérationnelle et testée | reserver_stock, lever_reservation_stock, v_valorisation_stock + pgTAP 50 + E2E stocks-avances | Figure 23.4 | MGU 23.F.4 | Valeur partielle si entrée sans prix |

### Achats

| Fonctionnalité | Page ou route | Rôles | Statut | Preuve | Capture | Procédure | Remarque |
|---|---|---|---|---|---|---|---|
| Bon de commande : rédiger, soumettre, approuver (autre personne), réceptionner, annuler, solder | Stocks & Achats > Achats | Écriture purchases, approbation purchases, réception écriture stock | Opérationnelle et testée | Purchases/PurchasesView.tsx, enregistrer_bon_commande, soumettre_bon_commande, decider_bon_commande, receptionner_bon_commande, annuler_reception, annuler_bon_commande, solder_bon_commande + pgTAP 36, 55 + E2E achats | Figure 24.1 | MGU 24.F.1 | - |
| Réception de pneus depuis un bon | Achats, réception | Écriture stock et vehicles ou maintenance | Opérationnelle et testée | receptionner_bon_commande + pgTAP 50 | Figure 24.2 | MGU 24.F.2 | - |
| Facture d'achat, rapprochement a trois voies, contrôle budgétaire | Achats | - | Non disponible | Catalogue module 16 ecart 1 | - | MGU 35 | - |

### Fournisseurs

| Fonctionnalité | Page ou route | Rôles | Statut | Preuve | Capture | Procédure | Remarque |
|---|---|---|---|---|---|---|---|
| Répertoire, fiche, contacts, documents, catégories, suspension, réactivation | Stocks & Achats > Fournisseurs | Écriture purchases | Opérationnelle et testée | Suppliers/SuppliersView.tsx, FicheFournisseur.tsx, enregistrer_fournisseur, suspendre_fournisseur, reactiver_fournisseur + pgTAP 42 + E2E fournisseurs | Figure 25.1 | MGU 25.F.1 | - |
| Évaluation des fournisseurs (critères pondérés) | Fiche fournisseur | Écriture purchases | Opérationnelle et testée | evaluer_fournisseur, definir_critere_evaluation + pgTAP 42 | Figure 25.2 | MGU 25.F.2 | - |
| Consultations, offres, sélection, bon issu de consultation | Fournisseurs, Consultations | Écriture purchases | Opérationnelle et testée | ConsultationsFournisseurs.tsx, creer_consultation, enregistrer_offre, selectionner_offre, preparer_bon_commande_consultation + pgTAP 42, 55 | Figure 25.3 | MGU 25.F.3 | Offre saisie TTC |

### Moyens généraux

| Fonctionnalité | Page ou route | Rôles | Statut | Preuve | Capture | Procédure | Remarque |
|---|---|---|---|---|---|---|---|
| Registre des biens, affectation, transfert, restitution, réparation, réforme, annulation | Stocks & Achats > Moyens généraux et patrimoine | Écriture stock (selon fiche module 18) | Opérationnelle avec limites | MoyensGeneraux/MoyensGenerauxView.tsx, enregistrer_bien, affecter_bien, transferer_bien, restituer_bien, reparer_bien, reformer_bien, annuler_operation_bien + pgTAP 43 + E2E moyens-generaux | Figure 26.1 | MGU 26.F.1 | Saisies par fenêtre du navigateur (window.prompt) |
| Inventaire physique par site | Moyens généraux | Idem | Opérationnelle et testée | ouvrir_inventaire_biens, constater_inventaire_bien, cloturer_inventaire_biens + pgTAP 43 | Figure 26.2 | MGU 26.F.2 | Écarts signalés, jamais régularisés |

### Contrats

| Fonctionnalité | Page ou route | Rôles | Statut | Preuve | Capture | Procédure | Remarque |
|---|---|---|---|---|---|---|---|
| Liste et fiche du contrat, création, modification | Contrats & Finance > Dossier contractuel (#/contrats) | Écriture contracts | Opérationnelle et testée | Contrats/ContratsView.tsx, DetailContrat.tsx, Formulaires.tsx + pgTAP 13, 60 + E2E contrats, saisie-referentiels | Figure 27.1 | MGU 27.F.1 | Écriture des tables sous RLS, journal_contrats |
| Versions et avenants, tarifs par engin, modification par avenant | Fiche du contrat | Écriture contracts | Opérationnelle et testée | creer_avenant, modifier_tarif_par_avenant, garde_tarif_en_vigueur + pgTAP 21, 60 | Figure 27.2 | MGU 27.F.2 | - |
| Suppression d'un élément de contrat brouillon (motif) | Fiche du contrat | Écriture contracts | Opérationnelle et testée | supprimer_element_contrat + pgTAP 60 | Figure 27.2 | MGU 27.H | - |
| Échéances (préavis, renouvellement, dénonciation) | Fiche du contrat | Écriture contracts | Opérationnelle et testée | enregistrer_echeance_contrat, v_echeances_contrats + pgTAP 48 | Figure 27.3 | MGU 27.F.3 | - |
| Clauses chiffrées (calcul, décision, renonciation) | Fiche du contrat, Clauses | Écriture contracts et invoices, renonciation approbation contracts | Opérationnelle et testée | ClausesCalculees.tsx, definir_clause, calculer_clauses, decider_clause + pgTAP 48 + E2E contrats-finance | Figure 27.4 | MGU 27.F.4 | - |
| Engagements contre réalisé et rapport de performance | Contrats & Finance > Engagements et rapport | Écriture contracts | Opérationnelle avec limites | EngagementsView.tsx, comparer_engagements, generer_rapport_performance, marquer_rapport_remis + pgTAP 18 | Figure 27.5 | MGU 27.F.5 | Km lus sur km_start/km_end, pas les distances validées |
| Comités de contrat et actions | Contrats & Finance > Comités de contrat | Écriture contracts | Opérationnelle avec limites | ComitesView.tsx (ecriture sous RLS) + pgTAP 18 | Figure 27.6 | MGU 27.F.6 | - |
| Mon tableau de bord (charge du charge de contrats) | Contrats & Finance > Mon tableau de bord | Lecture contracts | Opérationnelle et testée | MonPosteView.tsx, indicateurs_charge_contrats + pgTAP 18 | Figure 27.7 | MGU 27.D | - |
| Évaluation de Neemba | Contrats & Finance > Évaluation Neemba | Écriture contracts, profil sans site | Opérationnelle avec limites | EvaluationLoueurView.tsx, evaluer_loueur, mesures_loueur, definir_critere_loueur + pgTAP 48 | Figure 27.8 | MGU 27.F.7 | Mesures sans données tant que les engins ne sont pas rattachés au contrat |
| Contrôle des factures Neemba (saisie, contrôle, notification, régularisation) | Contrats & Finance > Contrôle factures Neemba | Écriture contracts | Opérationnelle avec limites | FacturesNeembaView.tsx, saisir_facture_fournisseur, controler_facture_fournisseur, notifier_ecart_fournisseur, enregistrer_regularisation + pgTAP 19, 21, 61 + E2E factures-neemba | Figure 27.9 | MGU 27.F.8 | Décompte de location (franchise, minimum, plafond) non branché |

### Facturation

| Fonctionnalité | Page ou route | Rôles | Statut | Preuve | Capture | Procédure | Remarque |
|---|---|---|---|---|---|---|---|
| Réconciliation mensuelle (ouvrir, actualiser, décider, clôturer) | Contrats & Finance > Réconciliation mensuelle (#/reconciliation) | Écriture invoices | Opérationnelle et testée | Facturation/ReconciliationView.tsx, DetailReconciliation.tsx, ouvrir_reconciliation, actualiser_reconciliation, decider_ligne_reconciliation, garde_voyage_une_reconciliation + pgTAP 15, 61, 62, 70 + E2E facturation | Figure 28.1 | MGU 28.F.1 | - |
| Générer une facture CBG depuis une réconciliation clôturée | Contrats & Finance > Facturation (#/invoices) | Écriture invoices | Opérationnelle et testée | FacturesView.tsx, generer_facture + pgTAP 15 + E2E facturation | Figure 28.2 | MGU 28.F.2 | Tarif a la tonne requis |
| Soumettre, émettre, annuler une facture | Fiche facture | Écriture invoices | Opérationnelle et testée | avancer_facture, factures_journal + pgTAP 15 | Figure 28.3 | MGU 28.F.3 | - |
| Signer ou renvoyer une facture | Fiche facture | Rôle directeur seulement | Réservée à un rôle | avancer_facture (signature director, signataire different du preparateur) + pgTAP 15, 24 | Figure 28.4 | MGU 28.F.4 | Session aal2 si mfa_exige |
| Avoir (montant, motif, même circuit) | Fiche facture | Écriture invoices | Opérationnelle et testée | creer_avoir + pgTAP 15, 48 | Figure 28.5 | MGU 28.F.5 | - |
| Facture imprimable A4 | Fiche facture | Lecture invoices | Opérationnelle et testée | FactureImprimable.tsx, fiche societe | Figure 28.6 | MGU 28.F.3 | Identité légale a saisir dans Paramètres > Général |
| Recouvrement : créances, encaissement, relances niveaux 1 a 3 | Contrats & Finance > Recouvrement (#/recouvrement) | Écriture invoices | Opérationnelle et testée | RecouvrementView.tsx, DetailCreance.tsx, v_creances, enregistrer_encaissement, relancer + pgTAP 18 + E2E suivi-recouvrement | Figure 28.7 | MGU 28.F.6 | Pas d'annulation motivée d'un encaissement |

### Finance

| Fonctionnalité | Page ou route | Rôles | Statut | Preuve | Capture | Procédure | Remarque |
|---|---|---|---|---|---|---|---|
| Paiements fournisseurs (proposer, approuver, exécuter, annuler, contrôler) | Contrats & Finance > Paiements fournisseurs | Écriture invoices, approbation invoices | Opérationnelle et testée | Paiements/PaiementsView.tsx, proposer_paiement, decider_paiement, enregistrer_execution_paiement, annuler_paiement, controler_paiement + pgTAP 38 + E2E paiements | Figure 29.1 | MGU 29.F.1 | SIGTB n'execute aucun virement |
| Budgets, suivi engagé et réalisé, dépenses a imputer | Contrats & Finance > Budgets et comptabilité | Écriture costs | Opérationnelle et testée | Finance/FinanceView.tsx, v_suivi_budgets, v_depenses_budgetaires + pgTAP 48, 63 + E2E contrats-finance | Figure 29.2 | MGU 29.F.2 | - |
| Référentiels comptables (natures, plan comptable, comptes de tiers) et export comptable CSV | Budgets et comptabilité | Administrateur ou écriture contracts | Opérationnelle avec limites | FinanceView.tsx, ecritures_gestion + pgTAP 48 | Figure 29.3 | MGU 29.F.3 | Pas de partie double |
| Coûts directs (enregistrer, annuler motivé, répartition) | Contrats & Finance > Coûts | Écriture costs | Opérationnelle et testée | Costs/CostsView.tsx, enregistrer_cout, annuler_cout + pgTAP 41 + E2E rapports | Figure 29.4 | MGU 29.F.4 | Catégories de coût sans écran |

### HSE

| Fonctionnalité | Page ou route | Rôles | Statut | Preuve | Capture | Procédure | Remarque |
|---|---|---|---|---|---|---|---|
| Contrôle avant départ et points de contrôle | RH & Sécurité > Contrôles avant départ | Écriture trips, points administrateur | Opérationnelle et testée | Hse/ControlesDepartView.tsx, enregistrer_controle_depart + pgTAP 37 + E2E hse | Figure 30.1 | MGU 30.F.1 | - |
| Exigence du contrôle avant départ (controle_depart_exige) | Contrôles avant départ, bouton Exiger | Administrateur | Désactivée par configuration | settings controle_depart_exige + pgTAP 37 | Figure 30.2 | MGU 30.F.2 | Inactive tant que l'administrateur ne l'active pas |
| Incidents et actions correctives | RH & Sécurité > Incidents | Écriture trips | Opérationnelle et testée | Incidents/IncidentsView.tsx, declarer_incident, analyser_incident, ajouter_action_corrective, solder_action_corrective, cloturer_incident + pgTAP 37, 55 | Figure 30.3 | MGU 30.F.3 | - |
| Prévention : EPI, registre des risques, plans de prévention, inspections | RH & Sécurité > Prévention HSE | Écriture trips, signature approbation trips | Opérationnelle et testée | Hse/HsePreventionView.tsx, remettre_epi, enregistrer_risque, enregistrer_plan_prevention, signer_plan_prevention, realiser_inspection + pgTAP 51 + E2E decisions-hse | Figure 30.4 | MGU 30.F.4 | Saisies par window.prompt pour certaines décisions |

### RH

| Fonctionnalité | Page ou route | Rôles | Statut | Preuve | Capture | Procédure | Remarque |
|---|---|---|---|---|---|---|---|
| Employés | RH & Sécurité > Employés | Écriture hr | Partielle | HR/EmployeesView.tsx, EmployeeModal.tsx (ecriture sous RLS) | Figure 31.1 | MGU 31.F.1 | Écran hérité, sans site ni journal |
| Présences (saisie, remplacement motivé, annulation) | RH & Sécurité > Présences | Écriture hr | Opérationnelle avec limites | AttendanceView.tsx, enregistrer_presence, annuler_presence, v_presences + pgTAP 44 | Figure 31.2 | MGU 31.F.2 | Pas de taux de présence |
| Paie (calcul, approbation, paiement) | RH & Sécurité > Paie | Écriture hr | Partielle | PayrollView.tsx (mise a jour directe des statuts), calculate_employee_payroll | Figure 31.3 | MGU 31.H | Héritée de Bolt, non reprise, ne pas utiliser pour une paie réelle |

### Reporting

| Fonctionnalité | Page ou route | Rôles | Statut | Preuve | Capture | Procédure | Remarque |
|---|---|---|---|---|---|---|---|
| Rapports (client, loueur, shift, mensuel par jour, figer, export CSV, impression) | Reporting & Analyse > Rapports | Lecture reports, figer écriture reports | Opérationnelle et testée | Reports/ReportsView.tsx, lib/rapports.ts, figer_rapport, rapport_mensuel_par_jour + pgTAP 41, 54 + E2E rapports | Figure 32.1 | MGU 32.F.1 | Pas de graphique ni d'export Excel natif |
| Coût direct par tonne | Reporting & Analyse > Coût direct par tonne | Lecture reports | Opérationnelle avec limites | Analyses/AnalysesFlotte.tsx CoutTonneView + pgTAP 17 + E2E analyses | Figure 32.2 | MGU 32.D | Coût complet par engin non disponible |
| Santé de la flotte | Reporting & Analyse > Santé de la flotte | Lecture reports | Opérationnelle avec limites | AnalysesFlotte.tsx SanteFlotteView + E2E analyses | Figure 32.3 | MGU 32.D | - |
| Fiabilité des engins | Reporting & Analyse > Fiabilité des engins | Lecture reports | Opérationnelle avec limites | fiabilite_engins + pgTAP 17 + E2E analyses | Figure 32.4 | MGU 32.D | - |
| Performance chauffeurs | Reporting & Analyse > Performance chauffeurs | Lecture reports | Opérationnelle avec limites | performance_chauffeurs + pgTAP 17 + E2E analyses | Figure 32.5 | MGU 32.D | - |

### Suivi GPS

| Fonctionnalité | Page ou route | Rôles | Statut | Preuve | Capture | Procédure | Remarque |
|---|---|---|---|---|---|---|---|
| Suivi GPS, intelligence flotte, historique des trajets | Exploitation > Suivi GPS, Intelligence flotte, Historique des trajets | Lecture gps_tracking | Visuelle seulement | Tracking/GPSTrackingView.tsx, FleetIntelligenceView.tsx, RouteHistoryView.tsx (iot_gps_readings, vehicle_tracking vides) | Figure 33.1 | MGU 33 | Aucun matériel GPS : écrans sans données (extension a déclencheur) |
| Géorepérage (zones cercle ou polygone, désactivation) | Exploitation > Géorepérage | Écriture gps_tracking | Partielle | Geofencing/GeofencingView.tsx (geofence_zones sous RLS) | Figure 33.2 | MGU 33 | Aucune détection : PostGIS absent, moniteur non déployé |
| Capteurs IoT | Reporting & Analyse > Capteurs IoT | Lecture iot | Visuelle seulement | IoT/IoTDashboardView.tsx | Figure 33.3 | MGU 33 | Aucun boîtier |
| Environnement (ESG) | Reporting & Analyse > Environnement | Lecture esg | Visuelle seulement | ESG/ESGTrackingView.tsx (4 boutons sans action, catalogue module 22) | Figure 33.4 | MGU 33 | Maquette encore au menu |

### Paramètres

| Fonctionnalité | Page ou route | Rôles | Statut | Preuve | Capture | Procédure | Remarque |
|---|---|---|---|---|---|---|---|
| Comptes : créer, modifier, rôle, site, désactiver, réactiver (motif) | Paramètres > Utilisateurs | Administrateur | Réservée à un rôle | Settings/AdminSettingsView.tsx, UserModal.tsx, fonction Edge admin-utilisateurs, definir_site_compte, desactiver_compte, reactiver_compte + pgTAP 60 + E2E organisation, droits-utilisateurs | Figure 34.1 | MAD 3 | - |
| Droits par utilisateur et par module (motif) | Paramètres > Utilisateurs, modification | Administrateur | Réservée à un rôle | definir_droit_module, journal_droits_modules + pgTAP 20 + E2E droits-utilisateurs | Figure 34.2 | MAD 5 | - |
| Affectations multisites datées, retour au périmètre global | Paramètres > Affectations multisites | Administrateur | Réservée à un rôle | AffectationsSites.tsx, affecter_site, cloturer_affectation_site, annuler_affectation_site, retablir_perimetre_global + pgTAP 47 | Figure 34.3 | MAD 6 | - |
| Délégations de droits (écriture ou approbation), révocation | Paramètres > Délégations, Sécurité du compte > Mes délégations | Détenteur du droit en propre, administrateur | Opérationnelle et testée | Delegations.tsx, deleguer_droit, revoquer_delegation, mes_delegations + pgTAP 47, 59, 63 | Figure 34.4 | MAD 7 | - |
| Journal de connexion et sessions ouvertes | Paramètres > Journal de connexion | Administrateur | Réservée à un rôle | JournalConnexions.tsx, sessions_ouvertes, v_journal_connexions + pgTAP 47 | Figure 34.5 | MAD 14 | Tentatives échouées non journalisées |
| Organisations | Paramètres > Organisations | Administrateur | Réservée à un rôle | AdminSettingsView.tsx (organisations) + pgTAP 47 | Figure 34.6 | MAD 8 | - |
| Référentiels devises, unités, numérotations (lecture) | Paramètres > Référentiels et numérotation | Administrateur | Réservée à un rôle | Referentiels.tsx, enregistrer_devise, enregistrer_unite, sequences_numerotation, codes_utilises + pgTAP 47 | Figure 34.7 | MAD 8 | Formats de numéro non paramétrables |
| Fiche société et réglages lus par le serveur | Paramètres > Général | Administrateur ou écriture settings | Réservée à un rôle | FicheSociete.tsx, ReglagesServeur.tsx, reglages.ts (24 cles) | Figure 34.8 | MAD 10 | - |

### Portails

| Fonctionnalité | Page ou route | Rôles | Statut | Preuve | Capture | Procédure | Remarque |
|---|---|---|---|---|---|---|---|
| Portails Neemba, CBG, fournisseurs | - | - | Non disponible | Catalogue module 25 : 12 blocs manquants | - | MGU 35 | Extension a déclencheur |

### Intelligence

| Fonctionnalité | Page ou route | Rôles | Statut | Preuve | Capture | Procédure | Remarque |
|---|---|---|---|---|---|---|---|
| Prévisions, détection d'anomalies, OCR, mobile hors ligne, voix, signature électronique | - | - | Non disponible | CLAUDE.md section 9 (extensions a declencheur) | - | MGU 35 | - |
