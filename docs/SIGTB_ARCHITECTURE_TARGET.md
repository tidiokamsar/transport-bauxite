# SIGTB : architecture cible

**État au 2026-11-15.** L'architecture constatée, la cible du CDC et les principes de transition sont décrits dans [SIGTB_2.0_ARCHITECTURE.md](SIGTB_2.0_ARCHITECTURE.md) ; l'hébergement dans [SIGTB_2.0_HEBERGEMENT_VPS.md](SIGTB_2.0_HEBERGEMENT_VPS.md). Ce document fixe ce que le mandat global ajoute : les mécanismes transverses partagés par les 26 modules et les conventions qui les rendent cohérents.

## 1. Choix maintenus

| Élément | Choix | Raison |
|---|---|---|
| Front | React 18, TypeScript, Vite, Tailwind, lucide-react, Leaflet | En place, suffisant ; pas de nouvelle dépendance UI (CLAUDE.md) |
| Serveur | PostgreSQL (Supabase auto-hébergé, D-016), PostgREST, Auth, Edge Functions Deno | La logique sensible vit en base, au plus près des données, sous transaction |
| Écriture sensible | Fonction `SECURITY DEFINER`, `SET search_path = ''`, contrôle `has_module_write` + `site_permis` + règle métier | Le navigateur n'est jamais une frontière de confiance |
| Lecture | RLS par module et par site ; vues `security_invoker` | Une vue n'élargit jamais l'accès d'une table |
| Historique | Journaux append-only (événements de voyage, contrats, factures, mouvements carburant) ; correction = nouvel événement | CDC 31, règle 4 CLAUDE.md |
| Hébergement | VPS partagé, pile Docker Compose `sigtb`, Caddy | D-016 ; aucun changement sans bénéfice mesurable |

Un changement de technologie n'est retenu que s'il apporte un bénéfice mesurable et passe par une décision consignée.

## 2. Mécanismes transverses

| Mécanisme | Existant | Cible | Lot du plan maître |
|---|---|---|---|
| Permissions | Rôle x module (D-012), dérogations par utilisateur (D-036), site (D-038, D-039), AAL2 (D-040) | + action et état du dossier dans les fonctions serveur ; délégations datées ; périmètre étendu aux tables restantes | 6 |
| Audit | Journaux par domaine | Convention commune : auteur, date, objet, action, ancienne et nouvelle valeur, motif, référence de transaction ; vue d'audit consolidée en lecture | Au fil des lots |
| Registres | Carburant (D-041) | Même patron pour stocks magasin, pneus, relevés kilométriques : mouvement append-only, solde calculé, décision séparée, annulation par contre-mouvement | 3, 4, 12 |
| Workflow | États et transitions codés par domaine (voyage, facture, fiche, mouvement) | Les règles restent dans leur domaine ; une boîte « Mes validations » agrège les files « à décider » de chaque domaine. Pas de moteur générique tant que deux circuits paramétrables réels ne l'exigent pas | 17 |
| Notifications | Quatre tables sans chaîne (voir la matrice) | Une table de notifications par destinataire, alimentée par les fonctions serveur, politique « mes notifications » ; les autres tables retirées après analyse des dépendances | 17 |
| Documents | Aucun stockage de fichiers | Bucket privé Supabase Storage, table documentaire polymorphe (objet, module, site, version, empreinte), politiques alignées sur l'objet parent | 14 |
| Recherche | Modal héritée défectueuse | Fonction serveur de recherche bornée par les droits de lecture | 19 |
| Numérotation | Codée par fonction (factures, fiches, mouvements) | Référentiel des séquences paramétrable | Phase 3 |
| Hors ligne | `lib/offline.ts` inutilisé | File métier idempotente (clé fournie par le client, acquittement serveur, état « en attente ») pour la saisie terrain seulement ; jamais pour paiements ni stocks | P3 |
| IoT | `iot-ingestion` durcie (D-030) | Lien route / type / véhicule, anti-rejeu, quotas avant tout matériel réel (règle 17 du mandat) | Phase 8 |

## 3. Conventions de développement

- Migration : nouveau fichier horodaté, idempotent, jamais de modification d'une migration existante ; toute table avec RLS et sans politique `USING (true)`.
- Fonction d'écriture : vérifie droit de module, périmètre site, état de l'objet, motif quand la règle l'exige ; `REVOKE ... FROM PUBLIC, anon` puis `GRANT ... TO authenticated`.
- Pas de suppression physique d'un enregistrement métier depuis le navigateur : archivage, annulation ou contre-passation.
- Front : écrans par domaine sous `src/components/<Domaine>/`, logique pure dans un module `.ts` testé par Vitest, appels serveur par `supabase.rpc` ; erreurs toujours affichées ; « sans données » quand une valeur manque.
- Tests : pgTAP par migration (période vide en 2001 pour les agrégats), E2E sur API simulée (`e2e/api-simulee.ts`), unitaires pour la logique pure.
