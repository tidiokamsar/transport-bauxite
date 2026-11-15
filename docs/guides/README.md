# Guides SIGTB

Guides d'utilisation et d'exploitation de SIGTB, plateforme de gestion du
transport de bauxite de Kogon Mining SARL (client facturé : CBG ; loueur
des engins : Neemba).

État décrit : branche `main` au commit `3d98254` (2026-11-15), décisions
D-001 à D-056. Ces guides ne décrivent que ce qui existe dans le dépôt
(écrans, fonctions serveur, règles SQL, scripts). Ce qui manque est signalé
dans la section « Limites connues » de chaque guide.

## Public et guides

| Guide | Public visé | Contenu |
|---|---|---|
| [guide-administrateur.md](guide-administrateur.md) | Administrateur fonctionnel | Comptes, rôles, droits par utilisateur, périmètre site, double authentification, référentiels, réglages lus par le serveur |
| [guide-exploitation.md](guide-exploitation.md) | Responsable des opérations, dispatcheur, chef de poste | Planification, postes, dispatch, cycle du voyage, fiches terrain, kilométrage, tickets CBG |
| [guide-flotte-maintenance.md](guide-flotte-maintenance.md) | Responsable de flotte, chef de maintenance, HSE | Véhicules, immobilisations, interventions Neemba, pneus, contrôles avant départ, incidents, habilitations |
| [guide-carburant-stocks-achats.md](guide-carburant-stocks-achats.md) | Logisticien, magasinier, acheteur | Registre carburant, livraisons CBG, stocks magasin, circuit achat |
| [guide-financier.md](guide-financier.md) | Chargé de contrats, comptable, Directeur Général | Contrats, modèle de location, réconciliation, factures, recouvrement, factures Neemba, paiements fournisseurs, Mes validations |
| [guide-terrain.md](guide-terrain.md) | Agents de saisie terrain | Saisie courte : fiche terrain, contrôle avant départ, pleins ; que faire si une saisie est refusée |
| [guide-securite.md](guide-securite.md) | Tous, en particulier administrateur et direction | Principes de sécurité et ce que l'on voit quand un droit manque |
| [guide-deploiement-sauvegarde-restauration.md](guide-deploiement-sauvegarde-restauration.md) | Administrateur système | Déploiement sur le serveur, sauvegarde, restauration, retour arrière |
| [guide-diagnostic.md](guide-diagnostic.md) | Administrateur système, équipe de développement | CI locale, codes d'erreur, lecture des journaux |
| [reference-fonctions-serveur.md](reference-fonctions-serveur.md) | Équipe de développement, administrateur | Fonctions serveur appelables, par module, avec droit requis et règle principale |

## Règles communes à tous les écrans

1. **Le serveur est seul juge.** Les écrans proposent les actions
   possibles, mais chaque écriture passe par une règle serveur (politique
   RLS ou fonction serveur) qui peut la refuser. Le message affiché vient
   alors du serveur.
2. **Aucune donnée inventée.** Une valeur absente s'affiche « sans
   données » ou « non mesurable » ; elle n'est jamais estimée.
3. **On corrige, on ne réécrit pas.** Les journaux (voyages, carburant,
   stocks, pneus, achats, HSE) ne se modifient pas : une erreur se corrige
   par une annulation motivée ou une rectification, l'original reste.
4. **Le système recommande, l'humain décide.** Les décisions (affectation,
   validation, signature, approbation) sont prises par une personne, avec
   motif quand la règle l'exige, et historisées.
5. **Séparation des tâches.** Plusieurs décisions doivent être prises par
   une autre personne que l'auteur de la saisie (voir chaque guide).

## Documents de référence

- `docs/SIGTB_2.0_CAHIER_DES_CHARGES.md` : référence fonctionnelle.
- `docs/SIGTB_2.0_DECISIONS.md` : décisions D-001 à D-056.
- `docs/SIGTB_2.0_HEBERGEMENT_VPS.md` : hébergement et journal des
  déploiements.
- `docs/SIGTB_2.0_LOCATION_MODEL.md` : modèle de location paramétrable.

## Anciens documents du dossier

`ADMINISTRATION.md`, `FONCTIONNALITES_IA.md` et `PAIE_AUTOMATIQUE.md`,
présents dans ce dossier, sont hérités de l'application Bolt. Ils décrivent
des écrans et des automatismes qui n'existent plus ou n'ont jamais été
vérifiés (D-004, D-030). Ne pas s'y fier : les guides ci-dessus les
remplacent.
