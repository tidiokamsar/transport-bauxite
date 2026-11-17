# SIGTB - Pneus : integrations (D-091)

| Module | Lien |
|---|---|
| Achats et stock (D-067) | Ligne de bon de commande « pneu » ; la reception cree chaque carcasse (`enregistrer_pneu`, code SIGTB automatique) ; acquisition marquee `deja_compte_achats` |
| Flotte (D-062) | `vehicles.brand_model` vers la configuration ; `v_fiche_vehicule` compte les pneus montes (inchange) |
| Maintenance (D-025) | Proposition acceptee : `declarer_immobilisation` (cause pneumatique) |
| Dispatch (D-087) | La garde existante refuse un engin immobilise ; non redefinie |
| Releves km (D-045), voyages et tickets (D-037), pointages (D-028) | Indicateurs au km, a la tonne, a l'heure |
| Alertes (D-068) | 13 regles au catalogue ; centre des decisions et barre superieure les affichent sans changement |
| Pieces jointes (D-083) | Objets `pneu`, `pneu_inspection`, `pneu_intervention` (module maintenance, perimetre du pneu) ; PDF et images |
| Couts (D-082) | Meme regle de non double compte |
| Donnees d'exemple (D-084) | Inchangees (2 pneus) ; chargement et purge verifies ; aucune configuration d'exemple (une configuration reelle depasse 5 positions) |

Hors perimetre (extensions a declencheur, bloc 1 section 9) : mode hors connexion, synchronisation terrain, capteurs de pression, OCR. Preparation seulement : cle client idempotente (`p_cle_client`, 8 a 100 caracteres) sur creation, montage, demontage, transfert, inspection, envoi et retour d'intervention.

Non fait dans ce lot : ecran (lot suivant, socle D-090) ; decisions de remise en service et propositions d'immobilisation dans `mes_validations`.
