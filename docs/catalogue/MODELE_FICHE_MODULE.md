# Modèle de fiche de module (catalogue maître SIGTB, D-077)

Chaque module du catalogue a une fiche `docs/catalogue/MODULE_NN_<nom>.md`
construite sur ce modèle. La fiche décrit la **cible** (ce que le module
doit offrir) et, pour chaque élément, l'**état constaté** dans le dépôt,
avec sa preuve. Aucune fonctionnalité n'est déclarée existante sans preuve
(fichier, fonction serveur, test). Une maquette n'est jamais « existante ».

## États (les mêmes que la matrice et le bloc 1, section 5)

| Code | Sens | Preuve exigée |
|---|---|---|
| MANQUANT | Rien n'existe | - |
| MAQUETTE | Écran ou code sans effet réel (données fictives, bouton sans action, colonne inexistante) | Fichier |
| PARTIEL | Existe mais incomplet (ex. liste sans export, action sans journal) | Fichier et ce qui manque |
| DÉVELOPPÉ | Code complet sur une branche | Fichier, fonction serveur |
| TESTÉ | pgTAP de la règle serveur, unitaires, E2E du parcours | Nom des tests |
| DÉPLOYÉ | En production | SHA, migration |
| UTILISABLE | Données réelles saisies, guide du rôle écrit | Guide |
| VALIDÉ | PV de recette signé | PV |

## Règles qui s'imposent à toutes les fiches

- Aucune suppression physique d'une pièce métier (facture émise, ticket CBG,
  mouvement de stock ou de carburant, voyage, relevé, pointage, journal) :
  correction par opération tracée (annulation motivée, avoir, contre-mouvement,
  rectification), jamais d'effacement. « Supprimer » n'existe que pour un
  brouillon jamais soumis ou un paramètre jamais utilisé, avec vérification
  des dépendances et motif.
- Écriture par fonction serveur (SECURITY DEFINER, `search_path` vide,
  droit de module, périmètre de site), RLS sur toute table, aucune donnée
  inventée, indicateurs avec période, source, fiabilité et heure.
- Les actions affichées dépendent des droits (rôle, droits par utilisateur,
  site) et de l'état du dossier.

## Sections de la fiche

1. **Objectifs et périmètre** : rôle du module dans la chaîne SIGTB ;
   décisions de référence (D-xxx) ; liens avec les autres modules (entrées,
   sorties).
2. **Sous-modules.**
3. **Menus et sous-menus** : entrée de menu (`src/components/Layout/menu.ts`),
   rôles qui la voient.
4. **Écrans** : un tableau `écran | objet | état | preuve`.
5. **Widgets et tableaux de bord** : indicateurs, source, période, état.
6. **Opérations CRUD** : par objet métier, `créer | consulter | modifier |
   dupliquer | archiver/restaurer | supprimer (brouillon seulement) |
   annuler/corriger` avec état et preuve.
7. **Modals et drawers** : création, édition, détail, confirmation,
   action, pièces jointes, historique, import, export.
8. **Champs des formulaires** : par formulaire, champs, type, obligatoire,
   règle de validation (client et serveur), champs conditionnels.
9. **Actions individuelles et en masse.**
10. **Statuts et transitions** : diagramme textuel `état -> état (action,
    droit, contrôle)`.
11. **Workflows** : étapes, approbations, séparation des tâches, délais,
    relances, escalades, délégations.
12. **Rôles et permissions** : par action, module et niveau (lecture,
    écriture, approbation), périmètre de site.
13. **Tables et relations** : tables, colonnes clés, contraintes, RLS.
14. **Fonctions serveur et API** : fonctions, vues, fonctions Edge.
15. **Notifications** : événements, destinataires, canal.
16. **Documents et modèles d'impression.**
17. **Exports et rapports** : PDF, Excel, CSV, impression.
18. **Historique et audit** : journaux, versions, comparaison.
19. **Tests** : unitaires, intégration (pgTAP), sécurité, E2E existants et
    manquants.
20. **Critères de recette métier** : scénarios rejoués par l'acteur métier,
    données attendues, PV.

En fin de fiche : **Écarts et lots proposés**, liste ordonnée de ce qui
manque pour atteindre la cible, chaque écart avec sa taille estimée (S, M,
L) et ses dépendances (autres modules, composants communs, données du
propriétaire).

## Standard des 12 blocs (résumé à reporter dans la matrice)

| Bloc | Contenu |
|---|---|
| 01 Dashboard | Indicateurs, statistiques, graphiques, alertes |
| 02 Liste | Recherche, filtres, tri, pagination, colonnes, vues enregistrées |
| 03 CRUD | Créer, consulter, modifier, dupliquer, archiver, brouillon |
| 04 Fiche détaillée | Informations, relations, historique, pièces jointes |
| 05 Modals et formulaires | Création, édition, confirmation, saisie rapide, validation en temps réel |
| 06 Actions métier | Affecter, valider, rejeter, clôturer, réouvrir, en masse |
| 07 Workflows | Étapes, approbations, délégations, délais |
| 08 Documents | Importer, prévisualiser, télécharger, imprimer |
| 09 Rapports | PDF, Excel, CSV, impression |
| 10 Historique | Journal, versions, corrections |
| 11 Notifications | Alertes, rappels, échéances, escalades |
| 12 Paramétrage | Référentiels, règles, statuts, modèles |
