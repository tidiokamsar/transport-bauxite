# SIGTB : notes de version

Versions déployées sur https://sigtb.infranetgn.com. Le détail des étapes de chaque mise à jour est dans [SIGTB_2.0_HEBERGEMENT_VPS.md](SIGTB_2.0_HEBERGEMENT_VPS.md), section 11.

## À venir : stocks magasin (D-044)

- Quantités par article et par dépôt calculées depuis les mouvements ; plus aucune quantité saisie à la main.
- Entrées, sorties (bornées au stock disponible), transferts, retours, inventaires motivés, annulation par contre-mouvement.

## 6e88e61 (2026-11-15) : kilométrage des voyages (D-043, PR #55)

- Écran Exploitation > Kilométrage : relevés d'odomètre par voyage (départ chargé, arrivée dépôt, fin de rotation), corrections motivées, distance mesurée, distance de référence.
- Distance validée par une autre personne ; motif obligatoire si elle s'écarte de la mesure ou si la mesure manque.
- Contrôle des factures Neemba au km sur les seules distances validées ; règle du retour à vide à renseigner sur chaque tarif au km.

## 94ce255 (2026-11-15) : assainissement (D-042, PR #54)

- Plus de suppression d'enregistrements métier depuis l'application : annulation, désactivation, retrait ou clôture à la place.
- Bons de commande numérotés par le serveur ; écran achats sur les colonnes réelles.
- Portail client fabriqué et onglets pneus aux chiffres codés en dur retirés.

## 8144424 (2026-11-15) : registre carburant (D-041, PR #51)

- Stocks et cuves : le stock est calculé à partir des mouvements validés ; plus aucun solde saisi à la main.
- Réception d'une livraison CBG avec volume mesuré, volume accepté et motif d'écart.
- Transferts entre cuves et citernes, distributions depuis la fiche carburant, inventaires avec ajustement.
- Chaque saisie est validée par une autre personne ; une erreur se corrige par annulation (contre-mouvement).

## feda997 (constaté en production le 2026-11-15)

PR #45 à #50 : carburant livré par CBG et contrôle des factures (D-034), ticket de pesée CBG source et rectification auditée (D-037, remplace D-035), périmètre site en lecture et en écriture (D-038, D-039), socle MFA/AAL inactif par défaut (D-040).

## 921d583 (2026-11-12)

Droits par utilisateur (D-036), facturation par engin au kilomètre ou à l'heure (D-033).

## b833583 (2026-11-11)

Contrôle des factures Neemba sur les heures pointées et le tarif du contrat, notification d'écart, régularisations (D-032).

## 4132dfb (2026-11-11)

Engagements contre réalisé, rapport de performance, recouvrement et relances, comités, tableau de bord du chargé de contrats (D-031).

## af80816 (2026-11-11)

Remise à niveau sur données réelles : ingestion IoT durcie, analyses carburant et flotte, suppression des maquettes (D-030).

## 50745b4, 16d6500, cda275a (2026-11-11)

Réconciliation mensuelle et factures CBG signées par le DG (D-029) ; fiches terrain (D-028) ; immobilisations (D-025) et dossier contractuel (D-026).

## 51db029, 32c1d89 (2026-11-10)

Planification (D-023), dispatch (D-024), cycle de voyage à 18 états (LOT 06).

## 0ded569 (2026-11-09)

Première mise en production : pile Supabase auto-hébergée, base de référence (D-017), sécurité Tranche 0 et matrice des rôles (D-012).
