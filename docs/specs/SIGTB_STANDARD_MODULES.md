# Standard fonctionnel et catalogue des modules SIGTB

Demande du propriétaire du 2026-11-16, archivée telle que reçue (texte du
propriétaire, mise en forme seulement). Décision : D-077. Le catalogue
maître qui la met en œuvre est dans `docs/catalogue/`.

## 1. Le standard fonctionnel obligatoire pour chaque module

| N° | Bloc | Contenu |
|---|---|---|
| 01 | Dashboard | Indicateurs, statistiques, graphiques, alertes |
| 02 | Liste principale | Tableaux, filtres, recherche, tri, pagination |
| 03 | CRUD complet | Créer, consulter, modifier, archiver, supprimer selon droits |
| 04 | Fiches détaillées | Informations, relations, historique, pièces jointes |
| 05 | Modals et formulaires | Création, édition, confirmation, saisie rapide |
| 06 | Actions métier | Affecter, valider, rejeter, clôturer, réouvrir |
| 07 | Workflows | Étapes, approbations, délégations, délais |
| 08 | Documents | Importer, prévisualiser, télécharger, imprimer |
| 09 | Rapports | Exports PDF, Excel, CSV et impressions |
| 10 | Historique | Journal des actions, versions, corrections |
| 11 | Notifications | Alertes, rappels, échéances, escalades |
| 12 | Paramétrage | Référentiels, règles, statuts, modèles |

Il faut aussi prévoir :
- des actions individuelles et des actions en masse ;
- des modals de confirmation pour les opérations sensibles ;
- des formulaires avec validation en temps réel ;
- des champs conditionnels selon le type d'opération ;
- des listes configurables par utilisateur ;
- des vues enregistrées et des filtres favoris ;
- des opérations en brouillon ;
- la duplication d'un dossier ou d'une opération ;
- l'import et l'export en masse ;
- les pièces jointes multiples ;
- les commentaires et échanges internes ;
- les affectations à un utilisateur ou à une équipe ;
- les droits au niveau de chaque action ;
- les raccourcis et actions rapides ;
- les historiques et pistes d'audit ;
- les API et intégrations avec les autres modules.

Attention : complet ne veut pas dire autoriser la suppression de toutes les
données. Une facture émise, un ticket CBG validé ou un mouvement de stock
doit être corrigé ou annulé par une opération tracée, jamais effacé
silencieusement.

## 2. Catalogue fonctionnel des modules

- **01 Command Center** : dashboards Direction générale, Exploitation,
  Finance, Flotte, Contrats, Carburant, Maintenance, Performance ; vue
  synthétique des opérations ; alertes prioritaires ; centre des décisions ;
  comparaison des périodes ; analyse par site, shift, véhicule et partenaire ;
  prévisions de production ; prévisions financières ; rapports périodiques ;
  configuration des widgets ; personnalisation par profil ; export et
  impression des tableaux de bord.
- **02 Organisation et administration** : sociétés et filiales ; directions
  et départements ; sites et sous-sites ; unités opérationnelles ; centres de
  coûts ; équipes et services ; utilisateurs ; rôles et permissions ; profils
  personnalisés ; affectations multi-sites ; délégations temporaires ; gestion
  des sessions ; MFA et politiques d'accès ; journal de connexion ; historique
  des droits ; paramètres généraux ; référentiels ; séquences de numérotation ;
  devises et unités ; modèles de documents et de notifications.
- **03 Sites et infrastructures** : sites miniers ; zones d'exploitation ;
  points de chargement ; dépôts de réception ; ponts-bascules ; stations
  carburant ; ateliers et zones techniques ; routes et pistes ; zones de
  sécurité ; géofences ; capacités ; horaires et périodes d'activité ;
  fermetures temporaires ; incidents de site ; cartographie ; historique des
  modifications ; import des référentiels géographiques.
- **04 Production Planning** : objectifs journaliers, par shift, par site,
  par destination, par contrat ; planification des ressources ; prévision des
  rotations ; besoins en camions, chargeuses et pelles ; plan initial et
  révisions ; scénarios de rattrapage ; simulation de capacité ; comparaison
  planifié/réalisé ; suivi des écarts ; alertes de sous-production ; clôture
  de planification ; rapports de production.
- **05 Shift Management** : création des shifts ; modèles d'horaires ;
  équipes ; responsables ; affectations des véhicules, chauffeurs et engins ;
  objectifs par shift ; ouverture et clôture ; passation de consignes ;
  événements et incidents ; rapport de shift ; retards et absences ;
  historique des équipes ; comparaison entre shifts ; validation de la
  clôture.
- **06 Dispatch et affectation intelligente** : files des camions
  disponibles et à affecter ; affectation manuelle ; recommandation
  automatique ; affectation groupée ; réaffectation ; priorités ;
  disponibilité des chauffeurs et des engins ; contraintes contractuelles ;
  interruptions ; fermeture des points de chargement ; capacité des dépôts ;
  files d'attente ; historique des décisions ; motifs de refus ; simulation
  d'affectation ; comparaison des scénarios ; optimisation des rotations.
- **07 Voyages et rotations** : création ; préparation des missions ;
  affectation des ressources ; départ ; arrivée au chargement ; mise en
  attente ; début et fin du chargement ; départ chargé ; arrivée au dépôt ;
  pesée CBG ; déchargement ; réception ; retour à vide ; réaffectation ;
  clôture ; annulation motivée ; litiges ; incidents ; relevés
  kilométriques ; historique des événements ; dossier numérique du voyage ;
  impression des fiches ; rapports par camion, chauffeur, site et shift.
- **08 Fleet Management** : registre ; création et modification ; fiches
  techniques ; immatriculations ; numéros de châssis ; propriétaires ;
  exploitants ; transporteurs ; contrats associés ; capacité utile ;
  compteurs kilométriques ; documents et assurances ; visites techniques ;
  affectations ; disponibilité ; historique des changements ; coût par
  véhicule ; performances ; alertes documentaires ; suspension et remise en
  service.
- **09 Chauffeurs** : dossiers ; informations administratives ; permis ;
  qualifications ; affectations ; disponibilités ; présences ; historique des
  missions ; performance ; incidents ; infractions ; formations ;
  habilitations ; documents ; alertes d'expiration ; rapports individuels.
- **10 Neemba Guinée** : fiche partenaire ; contrats de location ;
  avenants ; registre des engins loués ; tarifs par engin ; tarification
  kilométrique et horaire ; relevés de compteur ; pointages horaires ;
  immobilisations ; déclarations de panne ; demandes d'intervention ; suivi
  des techniciens ; rapports d'intervention ; pièces remplacées ; validation
  de remise en service ; calcul des indisponibilités ; contrôle des factures ;
  détection des écarts ; réclamations ; avoirs ; régularisations ;
  historique contractuel ; évaluation périodique.
- **11 Maintenance et fiabilité** : déclaration de panne ; catégorisation ;
  diagnostic ; priorité ; immobilisation ; notification au partenaire ;
  ordre ou demande d'intervention ; suivi de réparation ; historique des
  pannes ; contrôle technique ; remise en service ; analyse des causes ;
  MTBF ; MTTR ; disponibilité ; coût des immobilisations ; récurrence ;
  maintenance préventive si contractuellement applicable ; alertes et
  rapports.
- **12 Pneumatiques** : référentiel ; numéro de série ; marque et
  dimension ; achat ; réception ; stock ; affectation à un camion ;
  position ; permutation ; inspection ; mesure d'usure ; réparation ;
  rechapage ; retrait ; mise au rebut ; coût par kilomètre ; durée de vie ;
  performance par marque ; alertes de remplacement ; historique complet.
- **13 Fuel Intelligence** : référentiel carburant ; fournisseur CBG ;
  documents de livraison ; réception ; contrôle physique ; acceptation ;
  stockage ; cuves ; citernes mobiles ; transferts ; distribution ; saisie
  des pleins ; validation des distributions ; inventaires ; écarts ;
  anomalies ; prix du litre ; valorisation ; coût par engin ; consommation
  par tonne ; historique ; rapports ; import des documents CBG.
- **14 Pesée et rapprochement CBG** : import Excel/CSV ; import PDF ; import
  de photos ; OCR assistée ; registre des tickets ; association au voyage ;
  contrôles des immatriculations, des dates et des poids ; doublons ;
  tickets manquants ; tickets orphelins ; anomalies ; validation humaine ;
  rectification auditée ; tonnage accepté ; réconciliation journalière et
  mensuelle ; litiges ; export des états.
- **15 Fournisseurs** : répertoire ; fiches ; contacts ; documents
  administratifs ; catégories ; contrats ; produits et services ; demandes
  de cotation ; comparaison des offres ; évaluation ; historique des
  commandes et des paiements ; réclamations ; suspension ; réactivation.
- **16 Achats et approvisionnements** : demande d'achat ; vérification du
  stock ; validation hiérarchique ; consultation ; analyse des offres ;
  sélection fournisseur ; contrôle budgétaire ; bon de commande ; réception
  partielle ou totale ; contrôle qualité ; facture fournisseur ; avoir ;
  annulation motivée ; suivi des délais ; relances ; rapports d'achats.
- **17 Stocks et magasins** : articles ; catégories ; unités ; entrepôts ;
  emplacements ; stocks disponibles ; réservations ; entrées ; sorties ;
  transferts ; retours ; inventaires ; ajustements autorisés ; seuils
  minimum et maximum ; alertes ; lots ; séries ; traçabilité ;
  valorisation ; historique des mouvements ; coût des consommations.
- **18 Moyens généraux et patrimoine** : matériel informatique ; mobilier ;
  équipements ; outillage ; véhicules administratifs ; affectations ;
  remises ; restitutions ; transferts ; inventaires ; état ; réparations ;
  réformes ; amortissements si nécessaires ; documents ; historique
  patrimonial.
- **19 Contrats et engagements** : contrats clients, fournisseurs, de
  location, de transport ; parties ; tarifs ; unités de facturation ;
  durées ; avenants ; clauses ; obligations ; échéances ; pénalités ;
  bonus ; retenues ; renouvellements ; alertes ; contrôle de conformité ;
  archivage ; historique des versions.
- **20 Finance et facturation** : facturation client CBG ; factures
  fournisseurs ; factures Neemba ; décomptes ; avoirs ; paiements ;
  encaissements ; créances ; dettes ; retenues ; pénalités ;
  régularisations ; rapprochements ; budgets ; engagements ; coûts directs ;
  rentabilité ; export comptable ; états financiers de gestion.
- **21 Reporting et BI** : rapports standard et personnalisés ; générateur
  de rapports ; tableaux croisés ; graphiques ; comparaisons ; historique ;
  filtres multi-critères ; exports PDF, Excel, CSV ; planification d'envoi ;
  rapports journaliers, de shift, mensuels, partenaires, financiers, de
  performance.
- **22 Santé, sécurité et environnement** : inspections ; contrôles avant
  départ ; équipements de protection ; incidents ; accidents ;
  presque-accidents ; déclarations ; enquêtes ; causes ; actions
  correctives ; plans de prévention ; formations ; habilitations ; gestion
  des risques ; suivi environnemental ; rapports HSE.
- **23 Documents et GED** : référentiel documentaire ; classement ;
  dossiers ; métadonnées ; versions ; pièces jointes ; prévisualisation ;
  recherche ; OCR ; signature électronique selon le cadre applicable ;
  circuits de validation ; archivage ; rétention ; téléchargement ;
  impression ; partage contrôlé.
- **24 Bureau numérique et workflow** : boîte de réception ; mes tâches ;
  mes validations ; mes dossiers ; mes échéances ; mes notifications ; mes
  délégations ; circuits paramétrables ; modèles de workflow ; étapes
  conditionnelles ; relances ; escalades ; approbations multiples ;
  historique ; commentaires ; réaffectations ; suivi des délais.
- **25 Portails partenaires** : portails Neemba, CBG, fournisseurs,
  transporteurs si nécessaire ; comptes partenaires ; dépôt documentaire ;
  consultation des dossiers autorisés ; soumission des factures ; réponses
  aux demandes ; réclamations ; notifications ; suivi des validations ;
  historique des échanges.
- **26 Intelligence opérationnelle et IA** : assistant de recherche métier ;
  recherche en langage naturel ; détection des anomalies ; prévisions de
  production et des besoins ; analyse des coûts ; recommandations de
  dispatch ; analyse de performance ; risques contractuels ; prévision de
  maintenance si données suffisantes ; génération de rapports ; explication
  des indicateurs ; journal des recommandations ; validation humaine.

## 3. Bibliothèque commune de composants

| Composant | Fonctionnalités obligatoires |
|---|---|
| DataTable | Tri, filtres, recherche, colonnes, sélection multiple, pagination |
| CreateModal | Formulaire de création, validation, brouillon |
| EditModal | Modification contrôlée et journalisée |
| DetailDrawer | Vue détaillée, relations et historique |
| DeleteDialog | Confirmation, vérification des dépendances et motif |
| ArchiveDialog | Archivage et restauration autorisée |
| ActionDialog | Validation, rejet, clôture, réouverture |
| AttachmentModal | Import, prévisualisation et gestion des fichiers |
| ImportWizard | Mapping, prévalidation, erreurs, import |
| ExportModal | PDF, Excel, CSV et choix des colonnes |
| HistoryDrawer | Historique chronologique et comparaison des versions |
| CommentThread | Commentaires et échanges internes |
| AssignmentModal | Affectation à un utilisateur ou une équipe |
| BulkActionBar | Actions en masse selon permissions |

Les formulaires prennent en charge sections, onglets, étapes, champs
conditionnels, pièces obligatoires et règles métier.

## 4. Actions standardisées

Selon l'état et les droits : créer, consulter, modifier, dupliquer,
soumettre, affecter, réaffecter, transmettre, valider, rejeter, retourner
pour correction, suspendre, reprendre, annuler, clôturer, réouvrir avec
autorisation, archiver, restaurer, imprimer, télécharger, exporter, ajouter
une pièce, ajouter un commentaire, consulter l'historique, comparer les
versions, générer un rapport. Le moteur de permissions et les règles de
statut déterminent celles qui sont affichées.

## 5. Catalogue maître et matrice

Une fiche de spécification par module (20 sections : objectifs et
périmètre, sous-modules, menus, écrans, widgets, CRUD, modals et drawers,
champs, actions, statuts et transitions, workflows, rôles et permissions,
tables, fonctions serveur et API, notifications, documents, exports,
historique et audit, tests, critères de recette), et une matrice de
couverture qui garantit qu'aucune fonctionnalité annoncée ne reste une
maquette.

## 6. Règle de livraison

Un module n'est complet que si : tous les écrans prévus existent et sont
accessibles selon les droits ; les CRUD fonctionnent réellement avec la
base ; les modals et formulaires enregistrent et contrôlent les données ;
les actions métier fonctionnent côté serveur ; les workflows et validations
sont opérationnels ; les documents et exports sont générés correctement ;
les notifications sont envoyées ou présentées ; l'historique et les audits
sont consultables ; les tests couvrent les parcours normaux et les cas
d'erreur ; le module fonctionne avec les autres domaines SIGTB.

Priorité : produire le catalogue maître et sa matrice, puis réaliser les
modules progressivement, sans perdre les fonctionnalités déjà développées.

## 7. Rôle attendu de l'agent (extrait)

Agir à la fois comme CTO, architecte logiciel, de données et fonctionnel,
Product Manager, expert métier (transport de bauxite, flotte et maintenance
externalisée, stocks, carburant, pneumatiques, finance), expert UX/UI,
cybersécurité, DevOps, qualité, documentation, et coordinateur d'agents
spécialisés ; identifier soi-même écrans, champs, actions, règles et
améliorations ; aller jusqu'au bout du mandat. La chaîne globale à maîtriser
va de l'organisation et des référentiels jusqu'à la gouvernance, l'audit et
la traçabilité ; chaque processus est relié aux autres (une rotation
alimente kilomètres, heures, production, rapprochements, indicateurs,
factures et rentabilité ; un mouvement de carburant alimente stock,
consommations, coûts et indicateurs ; une immobilisation impacte
disponibilité, planning, dispatch et performance).
