# SIGTB — moteur de fiches terrain et documents officiels

**Origine :** prompt du proprietaire du 2026-11-23 (evolution documentaire des
fiches). Reference : principes SharePoint LeaderNet / AGEROUTE adaptes au
contexte minier KOGON. Ce document fixe l'architecture, la classification et
le plan par tranches. Audit prealable effectue sur `main` au 2026-11-23.

## 1. Classification des fiches (A/B/C)

| Famille | Exemples | Cycle | Impression | Signature | Archivage |
|---|---|---|---|---|---|
| **A — Collecte terrain** | FR, FP, FC, FKM, FCBG, FAV | cycle D-089 (saisie → controle → validation) | vierge ou preremplie | agent + chauffeur (manuscrite) | contenu persiste, pas de document officiel |
| **B — Controle et validation** | FIMM, FM, FRET, FSEC, FINV, FPN | cycle D-089 + circuit de validation multi-etapes | preremplie | visa du controleur, signature du valideur | document interne avec visas |
| **C — Documents officiels** | factures, notifications d'ecart, rapports de performance, avoirs, etats CBG | circuit documentaire (generation → signature → cachet → retour → archivage) | modele normalise | circuit parametrable multi-signataires + cachet | PDF numerote, SHA-256, immuable |

Une meme operation peut combiner : une FR (A) alimente une facture CBG (C).

## 2. Architecture technique

### 2.1 Modeles documentaires (tranche 1)

Table `documents_modeles` :
- `code` + `version` : identite du modele (ex : FACTURE_CBG v1)
- `famille` : A, B ou C
- `type_source` : type de fiche ou objet metier source
- `orientation` : portrait / paysage
- `contenu` : JSON documentaire — sections, champs dynamiques, tableaux,
  zones de signature et de cachet (positions et libelles)
- `en_tete` / `pied_de_page` : identite KOGON, logo (reference bucket),
  numerotation, pagination
- Statuts : brouillon, actif, archive (versionnement, jamais de suppression)

Le rendu PDF se fait cote client (approche existante `FicheImprimable`,
etendue) : le serveur fournit les donnees + le modele, le navigateur rend
l'HTML et l'imprime en PDF. Le serveur :
- genere les numeros officiels (sequence par type, sans trou) ;
- stocke les metadonnees du document genere (numero, date, modele, source,
  empreinte SHA-256 du contenu rendu) ;
- ne fabrique jamais un PDF avec des donnees fictives (regle 1).

### 2.2 Circuits de signature (tranche 2)

Table `circuits_signature` :
- `modele_code` + `version` : le modele auquel le circuit s'applique
- `etapes` : jsonb array ordonne, chaque etape = { role, fonction,
  obligatoire, type_action (visa, signature, cachet), delai_heures }
- Signatures paralleles (plusieurs au meme rang) ou successives.

Table `signatures_documents` :
- `document_id`, `etape`, `rang`
- `signataire` (uuid vers profiles), `fonction`, `action` (visa, signature,
  cachet, rejet, retour_correction), `motif`, `horodatage`
- Append-only ; une signature validee ne se retire pas.

Fonctions serveur :
- `apposer_visa(document, etape)` : visa electronique interne (identite
  authentifiee, pas de preuve juridique externe)
- `signer_document(document, etape)` : signature electronique (si
  prestataire externe branche plus tard, sinon visa renforce)
- `apposer_cachet(document, cachet_id)` : apres verification d'habilitation
- `rejeter_document(document, etape, motif)` : rejet motive
- `retourner_correction(document, etape, motif)` : retour pour correction

Separation explicite des types (jamais confondus) :
1. **Visa electronique interne** : identite du compte authentifie, horodatage
   serveur, sans preuve juridique externe.
2. **Signature electronique** : identite + intention, horodatage, reservee
   aux circuits l'exigeant (integration prestataire eventuelle).
3. **Cachet electronique** : image du cachet appliquee par un agent habilite,
   journalisee.
4. **Signature manuscrite** : le document est imprime, signe, puis le
   document signe est numerise et rattache (photo ou PDF).
5. **Cachet physique** : idem, avec emplacement reserve sur le modele.

### 2.3 Cachets (tranche 3)

Table `cachets` :
- `organisation_id`, `service`, `responsable_habilite` (uuid)
- `types_documents_autorises` : array de codes de modeles
- `validite_debut`, `validite_fin`
- `image_chemin` : reference au bucket pieces
- `statut` : actif, suspendu, retire

Table `cachets_applications` :
- `document_id`, `cachet_id`, `applique_par`, `applique_le`
- Append-only, toute utilisation est auditee.

Un cachet scanne n'est utilisable que par le responsable habilite, sur les
types autorises, dans la periode de validite.

### 2.4 Documents generes et archivage (tranche 3)

Table `documents_genere` :
- `numero_officiel` : sequence sans trou par type (DOC-AAAA-NNNN)
- `modele_code`, `modele_version`, `fiche_id` (source metier)
- `contenu_rendu` : jsonb des donnees au moment de la generation
- `sha256` : empreinte du contenu rendu
- `statut` : genere, en_signature, signe, cachete, retourne, archive
- `cree_par`, `cree_le`
- `archive_le`, `archive_par`
- Append-only ; un document archive est immuable.

### 2.5 Integration modules (tranche 4)

Chaque module propriétaire propose :
- « Generer » depuis le dossier metier (fiche, facture, etc.)
- « Imprimer » (rendu navigateur)
- « Circuit de signature » (suivi des etapes)
- « Retourner le signe » (depot du document numerise via pieces jointes)
- « Archiver » (avec empreinte et horodatage)

Le catalogue (D-104) reste l'outil d'administration des modeles, pas le
point de saisie principal.

## 3. Plan par tranches

| Tranche | Contenu | Critere |
|---|---|---|
| T1 | Modeles documentaires + generation (metadonnees, numerotation, SHA-256) + impression etendue | un document genere, numerote, rendu, empreinte conservee |
| T2 | Circuits de signature parametrables + fonctions visa/signature/rejet | un circuit a deux etapes, visa puis signature, rejet motive teste |
| T3 | Cachets + archivage + retour du signe | cachet habilite applique, document archive immuable |
| T4 | Ecrans d'integration dans les modules proprietaires | depuis Voyages, Finance, etc. : generer, suivre, archiver |
| T5 | Integration mobile (photo du signe, depot) | depuis SIGTB Mobile : photographier le document signe |

## 4. Regles non negociees (reprises)

1. Un document ne devient jamais une deuxieme source de verite : les donnees
   viennent des modules, le document les restitue.
2. Aucune donnee fictive dans un document presente comme reel.
3. Un visa electronique interne n'est jamais presente comme une signature
   electronique juridiquement qualifiee.
4. Un cachet scanne n'est pas utilisable librement.
5. Un document signe ne s'ecrase pas : correction = nouvelle version ou
   document correctif.
6. Toute action (generation, visa, signature, cachet, archivage) est
   journalisee avec auteur et horodatage.
