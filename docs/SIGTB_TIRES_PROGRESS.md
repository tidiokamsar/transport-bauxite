# SIGTB - Pneus : avancement (D-091)

| Phase | Etat | Preuve |
|---|---|---|
| 1 Audit | Fait | `SIGTB_TIRES_ARCHITECTURE.md` |
| 2 Modele | Fait | migration `20261121230000_pneus_cycle_de_vie` |
| 3 Migration | Developpe, teste | rejeu des migrations, idempotence verifiee (double application) |
| 4 a 11 Coeur serveur (cycle, positions, inspections, usure, interventions, stock, couts, alertes, droits, pieces) | Developpe, teste | pgTAP 72 |
| Ecran (socle D-090) | Developpe (2026-11-17) | branche `lot-12/pneus-ecrans` : dix espaces, fiche pneu en 12 onglets, actions et saisies en pleine page ; E2E non rejouees (D-093) |
| Deploiement | Non fait | branche `lot-12/pneus-cycle-de-vie` |

Etat au sens du bloc 1 section 5 : **Developpe** et **Teste** ; ni fusionne, ni deploye, ni utilisable.

## Donnees a fournir par le proprietaire

1. Configurations de positions par modele d'engin (positions, essieux, jumelage, secours, dimensions admises).
2. Seuils par dimension, modele ou fabricant : profondeur minimale, ecart d'usure, degradation, plage de pression, delais d'inspection et d'intervention, duree de vie, preavis de garantie, cout au km anormal, nombre de mesures pour une projection.
3. Nombre de rechapages admis et criteres d'acceptation des carcasses.
4. Decision d'activer les blocages (montage, remise en service, configuration exigee).
5. Comptes et droits des gestionnaires pneumatiques, magasiniers et inspecteurs.
