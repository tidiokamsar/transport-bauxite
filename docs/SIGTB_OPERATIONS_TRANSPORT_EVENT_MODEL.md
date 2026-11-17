# Opérations transport : modèle d'événements (D-088)

Vue `public.v_journal_voyage` (`security_invoker = true`) : chaque table
source garde sa RLS ; le lecteur ne voit que les événements des voyages de
son périmètre (`voyage_permis`, `site_permis`) et des modules qu'il lit. La
jointure finale sur `trips` applique en plus la politique du voyage.

## Colonnes

| Colonne | Contenu |
|---|---|
| id | `<source>:<uuid de la ligne source>` ; unique par voyage (test pgTAP) |
| trip_id, voyage_reference | voyage |
| rotation | `trips.shift_sequence` si connue |
| type | voir tableau ci-dessous |
| libelle | texte lisible construit depuis la ligne |
| date_operation | heure de l'opération déclarée (NULL si non renseignée, jamais complétée) |
| date_saisie | heure d'enregistrement |
| source | dispatch, agent_kogon, import_cbg, systeme, autre (canal connu par la table ; `autre` quand il ne l'est pas) |
| auteur | compte auteur si journalisé |
| donnees | valeurs utiles de la ligne (jsonb) |
| justificatif | numéro de ticket, de fiche, de relevé, nom de pièce |
| statut | declare, verifie, valide, conteste : dernière vérification, sinon statut d'origine |
| verification_id | dernière vérification (à renvoyer pour vérifier de nouveau : contrôle de concurrence) |
| corrige_ref | identifiant de l'événement corrigé, remplacé ou complété |
| annule | ligne annulée ou remplacée, conservée |
| table_source | table d'origine |

## Sources

| Type | Table | Source | Statut d'origine | corrige_ref |
|---|---|---|---|---|
| etat | trip_events | dispatch (DRAFT, PLANNED, ASSIGNED), systeme (détecté), agent_kogon (fiche citée), sinon autre | valide si origine valide, sinon declare | - |
| affectation, reaffectation | decisions_dispatch | dispatch | valide (décision humaine) ; refusée = annule | décision précédente du voyage |
| suspension, reprise | suspensions_voyage | dispatch | valide | la reprise cite la suspension |
| ligne_fiche_rotation | fiches_rotations_lignes | agent_kogon | valide (fiche validée ou archivée), verifie (contrôlée), declare | - |
| fiche_<action> | fiches_journal (fiches reliées) | agent_kogon | valide | - |
| ticket_cbg | tickets_pesee_cbg | agent_kogon | verifie si rapprochement concordant d'un relevé non annulé, sinon declare | - |
| rectification_ticket | rectifications_tickets_pesee_cbg | agent_kogon | declare | le ticket |
| releve_kogon | releves_terrain_kogon | agent_kogon | declare ; remplacé = annule | le relevé remplacé |
| ligne_releve_cbg | releves_cbg_lignes (par rapprochement) | import_cbg | valide (officiel) ; relevé annulé = annule | - |
| rapprochement_pesee | rapprochements_pesee | systeme | verifie | - |
| anomalie_pesee | anomalies_pesee | systeme | valide si clôturée, sinon declare | - |
| traitement_anomalie | journal_anomalies_pesee | agent_kogon | valide | l'anomalie |
| piece_jointe | pieces_jointes (voyage, ticket) | agent_kogon | declare ; annulée = annule (fichier conservé) | - |
| verification | verifications_evenements_voyage | agent_kogon | statut décidé | l'événement vérifié |

## Corrections

Jamais d'écrasement : une correction est une nouvelle ligne de sa table
(rectification, remplacement, reprise, réaffectation, vérification) qui
cite la précédente par `corrige_ref`. La chaîne des vérifications est
linéaire (`precedente_id` unique) ; une vérification concurrente est
refusée (40001).

## Vérification (`verifier_evenement_voyage`)

- droit d'écriture `trips`, voyage dans le périmètre (sinon « Evenement
  introuvable », même message pour un événement inconnu) ;
- l'auteur d'une saisie ne la vérifie ni ne la valide ; le vérificateur ne
  valide pas (`separation_violee`, 42501) ;
- `valide` seulement après `verifie` ; `conteste` et tout retour sur une
  vérification exigent un motif (5 caractères) ;
- même statut deux fois : 23505 ; une vérification ou une ligne annulée ne
  se vérifie pas.
