/*
  # Catalogue versionne des fiches (D-104, T2)

  Les fiches sont le point d'entree de la saisie terrain (mobile et web) :
  chaque famille demandee par le proprietaire devient une fiche du cycle
  (D-089) rattachee a ses modules metier. Ce catalogue est la source
  documentaire unique, lisible par le web et le mobile : il decrit les
  fiches (champs, regles, profils, pieces, workflow, rattachements) mais
  ne les remplace pas — les fonctions serveur font autorite.

  - `fiches_catalogue` : une ligne par (code, version) ; `active` designe
    la version courante ; `statut` distingue reellement deployee / en
    construction / cible (jamais « terminee » sans preuve).
  - Lecture pour tout compte connecte (elle pilite menus et formulaires) ;
    ecriture administrative seule (nouvelle version = decision consignee).
  - 21 familles initialisees : FR, FP, FC deployees (cycle D-089, sync
    D-103) ; les autres en cible, construites par les tranches T5.

  Idempotent : IF NOT EXISTS + ON CONFLICT DO NOTHING.
*/

CREATE TABLE IF NOT EXISTS public.fiches_catalogue (
  code text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  nom text NOT NULL,
  objectif text NOT NULL,
  module_proprietaire text NOT NULL,
  modules_consommateurs text[] NOT NULL DEFAULT '{}',
  profils text[] NOT NULL DEFAULT '{}',
  pieces text[] NOT NULL DEFAULT '{}',
  champs jsonb NOT NULL DEFAULT '[]'::jsonb,
  regles_validation jsonb NOT NULL DEFAULT '[]'::jsonb,
  relations_metier jsonb NOT NULL DEFAULT '[]'::jsonb,
  regles_sync text NOT NULL DEFAULT 'lot idempotent par client_id (D-103)',
  regles_audit text NOT NULL DEFAULT 'journal append-only du cycle (D-089)',
  statut text NOT NULL DEFAULT 'cible' CHECK (statut IN ('deployee', 'en_construction', 'cible')),
  active boolean NOT NULL DEFAULT true,
  PRIMARY KEY (code, version)
);

ALTER TABLE public.fiches_catalogue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fiches_catalogue FROM anon;
GRANT SELECT ON public.fiches_catalogue TO authenticated;
GRANT ALL ON public.fiches_catalogue TO service_role;
DROP POLICY IF EXISTS lecture_authentifies ON public.fiches_catalogue;
CREATE POLICY lecture_authentifies ON public.fiches_catalogue
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS administration ON public.fiches_catalogue;
CREATE POLICY administration ON public.fiches_catalogue
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Version active de chaque code : la lecture de reference.
DROP VIEW IF EXISTS public.v_fiches_catalogue_actives;
CREATE VIEW public.v_fiches_catalogue_actives
WITH (security_invoker = true) AS
SELECT DISTINCT ON (code) *
  FROM public.fiches_catalogue
 WHERE active
 ORDER BY code, version DESC;
GRANT SELECT ON public.v_fiches_catalogue_actives TO authenticated;

-- Initialisation des 21 familles (version 1). Statuts reels : seules FR,
-- FP et FC sont deployees ; les autres sont la cible adoptee par D-104.
INSERT INTO public.fiches_catalogue
  (code, nom, objectif, module_proprietaire, modules_consommateurs, profils, pieces, champs, regles_validation, relations_metier, statut)
VALUES
('FR', 'Rotations camion',
 'Consigner chaque rotation d''un camion : heures, kilometrage, tonnage pese, ticket CBG.',
 'trips', ARRAY['trips','dispatch','planning','invoices','contracts'], ARRAY['agent terrain','charge de contrats','exploitation'],
 ARRAY['fiche signee par l''agent et le chauffeur'],
 '[{"champ":"voyage","obligatoire":true,"regle":"voyage livre du camion pour le shift"},{"champ":"km_depart / km_arrivee","obligatoire":true,"regle":"releve compteur, jamais estime"},{"champ":"tonnage / ticket CBG","obligatoire":true,"regle":"ticket unique, pesee CBG au depot (D-081)"}]',
 '["ticket deja utilise refuse","km decroissants refuses","ecart de pesee signale"]',
 '[{"objet":"trip","liaison":"ligne de rotation"},{"objet":"ticket CBG","liaison":"preuve append-only"},{"objet":"kilometres valides","liaison":"D-043"}]',
 'deployee'),
('FP', 'Pointage des engins',
 'Pointer les heures de marche et les arrets des chargeuses et de la pelle.',
 'trips', ARRAY['maintenance','contracts','planning'], ARRAY['agent terrain','exploitation'],
 ARRAY['fiche signee par l''agent'],
 '[{"champ":"engin","obligatoire":true},{"champ":"index debut / fin","obligatoire":true,"regle":"horametre, fin >= debut"},{"champ":"arrets","obligatoire":false,"regle":"chaque arret devient immobilisation (D-025)"}]',
 '["index incoherents refuses","arret impute loueur rappelle"]',
 '[{"objet":"pointages_engins","liaison":"heures productives"},{"objet":"decompte horaire","liaison":"D-033"}]',
 'deployee'),
('FC', 'Distribution de carburant',
 'Consigner chaque distribution de carburant aux engins depuis une cuve.',
 'fuel', ARRAY['fuel','stock','contracts','costs'], ARRAY['agent terrain','exploitation'],
 ARRAY['fiche signee par l''agent et le destinataire'],
 '[{"champ":"engin / cuve","obligatoire":true},{"champ":"litres","obligatoire":true,"regle":"jamais negatif"},{"champ":"index pompe","obligatoire":false},{"champ":"prix litre","obligatoire":true,"regle":"saisi, jamais deduit"}]',
 '["sortie de stock unique a la validation (D-041)","cuve fermee ou stock insuffisant refuses"]',
 '[{"objet":"mouvement carburant","liaison":"registre D-041"},{"objet":"consommation","liaison":"L/t, L/h"}]',
 'deployee'),
('FKM', 'Releve kilometrique',
 'Relever le compteur kilometrique d''un camion en dehors d''une rotation (debut/fin de periode, atelier).',
 'trips', ARRAY['contracts','costs'], ARRAY['agent terrain','exploitation'],
 ARRAY['photo du compteur si disponible'],
 '[{"champ":"camion","obligatoire":true},{"champ":"compteur km","obligatoire":true},{"champ":"contexte","obligatoire":true,"regle":"rotation, atelier, repositionnement"}]',
 '["compteur decroissant refuse","releve hors rotation justifie le decompte (D-043)"]',
 '[{"objet":"releves kilometriques","liaison":"validation D-043"}]',
 'cible'),
('FCBG', 'Collecte des tickets CBG',
 'Collecter au depot les tickets de pesee remis par CBG et les rattacher aux voyages.',
 'trips', ARRAY['invoices','contracts'], ARRAY['agent terrain','charge de contrats'],
 ARRAY['ticket CBG original'],
 '[{"champ":"voyage","obligatoire":true},{"champ":"ticket","obligatoire":true,"regle":"numero unique"},{"champ":"brut / tare","obligatoire":true,"regle":"pesee CBG, jamais refaite par Kogon (D-037)"}]',
 '["ticket en double refuse","net calcule conserve comme controle (D-096)"]',
 '[{"objet":"tickets_pesee_cbg","liaison":"preuve append-only + rectification D-037"}]',
 'cible'),
('FCB-L', 'Livraison de carburant CBG',
 'Consigner la reception d''une livraison de carburant CBG : volume mesure, prix du justificatif.',
 'fuel', ARRAY['fuel','purchases','invoices','stock'], ARRAY['agent terrain','exploitation','comptable'],
 ARRAY['bon de livraison CBG','facture CBG'],
 '[{"champ":"cuve / livraison","obligatoire":true},{"champ":"litres mesures","obligatoire":true},{"champ":"prix litre","obligatoire":true,"regle":"saisi du justificatif, jamais deduit"}]',
 '["reception mesuree puis acceptee (D-041)","ecart avec le bon signale"]',
 '[{"objet":"livraisons_carburant_cbg","liaison":"D-034"},{"objet":"mouvement stockage","liaison":"registre D-041"}]',
 'cible'),
('FINV', 'Inventaire',
 'Compter le stock reel d''une cuve ou d''un magasin et constater l''ecart avec le registre.',
 'stock', ARRAY['fuel','stock','costs'], ARRAY['agent terrain','magasinier','exploitation'],
 ARRAY['feuille de comptage signee'],
 '[{"champ":"stockage","obligatoire":true},{"champ":"quantite comptee","obligatoire":true},{"champ":"mesure","obligatoire":true,"regle":"jauge, compteur ou comptage physique"}]',
 '["ecart constate, jamais ajuste sans decision","contre-mouvement requis pour corriger (D-041)"]',
 '[{"objet":"inventaire du registre","liaison":"D-041"}]',
 'cible'),
('FPN', 'Intervention pneumatique',
 'Consigner une intervention sur un pneumatique : pression, sculpture, permutation, remplacement.',
 'maintenance', ARRAY['vehicles','stock','purchases','costs'], ARRAY['mecanicien','agent terrain'],
 ARRAY['reference du pneu'],
 '[{"champ":"pneu","obligatoire":true,"regle":"identite individuelle (D-052)"},{"champ":"type d''intervention","obligatoire":true},{"champ":"position / profondeur sculpture","obligatoire":false}]',
 '["pneu inconnu refuse","position deja occupee signalee"]',
 '[{"objet":"cycle de vie du pneu","liaison":"D-052"}]',
 'cible'),
('FAV', 'Controle avant depart',
 'Verifier avant le depart : niveaux, pression, feux, freins, documents, chargement.',
 'vehicles', ARRAY['vehicles','drivers','dispatch'], ARRAY['chauffeur','exploitation'],
 ARRAY['aucune'],
 '[{"champ":"camion","obligatoire":true},{"champ":"checklist","obligatoire":true,"regle":"chaque point coche ou anomalie constatee"},{"champ":"habilitation chauffeur","obligatoire":true,"regle":"controlee au dispatch (D-063)"}]',
 '["defaut bloquant interdit le depart (D-054)"]',
 '[{"objet":"controle de depart","liaison":"dispatch et habilitations"}]',
 'cible'),
('FM', 'Intervention du loueur',
 'Consigner une intervention de maintenance de Neemba sur un engin loue.',
 'maintenance', ARRAY['vehicles','contracts','costs'], ARRAY['agent terrain','exploitation'],
 ARRAY['rapport d''intervention Neemba'],
 '[{"champ":"engin","obligatoire":true},{"champ":"nature / duree","obligatoire":true},{"champ":"reference Neemba","obligatoire":true}]',
 '["remise en service validee par Kogon (D-049)","imputation loueur/exploitant exigee"]',
 '[{"objet":"interventions loueur","liaison":"D-049"},{"objet":"immobilisation","liaison":"D-025"}]',
 'cible'),
('FIMM', 'Immobilisation d''engin',
 'Declares une immobilisation : panne, maintenance planifiee, pneu, accident, attente de piece.',
 'maintenance', ARRAY['vehicles','dispatch','planning','contracts'], ARRAY['agent terrain','mecanicien','exploitation'],
 ARRAY['aucune'],
 '[{"champ":"engin","obligatoire":true},{"champ":"debut horodate","obligatoire":true},{"champ":"cause / imputation","obligatoire":true,"regle":"aucune valeur par defaut"}]',
 '["une seule immobilisation ouverte par engin","dispatch exclut l''engin immediatement"]',
 '[{"objet":"immobilisations","liaison":"D-025"}]',
 'cible'),
('FRET', 'Retour d''atelier',
 'Consigner la fin d''une immobilisation et la remise en service effective.',
 'maintenance', ARRAY['vehicles','dispatch'], ARRAY['mecanicien','exploitation'],
 ARRAY['aucune'],
 '[{"champ":"immobilisation","obligatoire":true},{"champ":"fin horodatee","obligatoire":true},{"champ":"etat a la remise","obligatoire":true}]',
 '["immobilisation ouverte requise","heures bloquees comptees pour le decompte"]',
 '[{"objet":"immobilisations","liaison":"cloture D-025"}]',
 'cible'),
('FSEC', 'Constat de securite',
 'Consigner un constat de securite sur les pistes, le site ou les installations.',
 'reports', ARRAY['vehicles','drivers'], ARRAY['agent terrain','superviseur','HSE'],
 ARRAY['photo si disponible'],
 '[{"champ":"lieu / moment","obligatoire":true},{"champ":"description","obligatoire":true},{"champ":"gravite","obligatoire":true}]',
 '["constat jamais modifie, complete par action corrective (D-054)"]',
 '[{"objet":"incidents HSE","liaison":"D-054"}]',
 'cible'),
('FACC', 'Accident',
 'Consigner un accident : degats, parties, constat.',
 'reports', ARRAY['vehicles','drivers','hr'], ARRAY['chauffeur','agent terrain','superviseur','HSE'],
 ARRAY['constat amiable','photos'],
 '[{"champ":"vehicule / chauffeur","obligatoire":true},{"champ":"circonstances","obligatoire":true},{"champ":"tiers","obligatoire":false}]',
 '["vehicule implique signale au dispatch"]',
 '[{"objet":"incidents HSE","liaison":"D-054"}]',
 'cible'),
('FINC', 'Incident',
 'Consigner un incident d''exploitation sans dommage corporel.',
 'reports', ARRAY['vehicles','drivers'], ARRAY['agent terrain','superviseur'],
 ARRAY['photo si disponible'],
 '[{"champ":"moment / lieu","obligatoire":true},{"champ":"description","obligatoire":true}]',
 '["clos par decision motivee"]',
 '[{"objet":"incidents HSE","liaison":"D-054"}]',
 'cible'),
('FENV', 'Constat environnemental',
 'Consigner un evenement environnemental : debordement, poussiere, dechet.',
 'reports', ARRAY['vehicles'], ARRAY['agent terrain','HSE'],
 ARRAY['photo si disponible'],
 '[{"champ":"lieu / moment","obligatoire":true},{"champ":"nature","obligatoire":true}]',
 '["jamais modifie, suivi par action corrective"]',
 '[{"objet":"suivi ESG","liaison":"module ESG"}]',
 'cible'),
('FRE', 'Entree en magasin',
 'Consigner la reception de biens au magasin et la diriger vers le stock.',
 'stock', ARRAY['purchases','stock','costs'], ARRAY['magasinier'],
 ARRAY['bon de reception'],
 '[{"champ":"article / quantite","obligatoire":true},{"champ":"bon d''achat lie","obligatoire":true},{"champ":"ecart quantite","obligatoire":false}]',
 '["entree validee vers le stock (D-053)","ecart avec le bon signale"]',
 '[{"objet":"mouvements de stock","liaison":"registre magasin D-044"}]',
 'cible'),
('FST', 'Sortie de magasin',
 'Consigner une sortie de stock vers un engin, un site ou une intervention.',
 'stock', ARRAY['maintenance','vehicles','costs'], ARRAY['magasinier','mecanicien'],
 ARRAY['aucune'],
 '[{"champ":"article / quantite","obligatoire":true},{"champ":"destinataire","obligatoire":true},{"champ":"motif","obligatoire":true}]',
 '["stock insuffisant refuse","sortie rattachee a l''intervention"]',
 '[{"objet":"mouvements de stock","liaison":"D-044"}]',
 'cible'),
('FTR', 'Transfert inter-magasins',
 'Consigner un transfert de stock entre deux magasins ou deux sites.',
 'stock', ARRAY['stock'], ARRAY['magasinier'],
 ARRAY['bon de transfert'],
 '[{"champ":"source / destination","obligatoire":true},{"champ":"article / quantite","obligatoire":true}]',
 '["transfert jamais compte comme consommation","stock source suffisant requis"]',
 '[{"objet":"mouvements de stock","liaison":"sortie + entree D-044"}]',
 'cible'),
('FDEM', 'Demande d''approvisionnement',
 'Exprimer un besoin d''achat ou de reapprovisionnement depuis le terrain.',
 'purchases', ARRAY['stock','purchases'], ARRAY['mecanicien','magasinier','exploitation'],
 ARRAY['aucune'],
 '[{"champ":"article / quantite","obligatoire":true},{"champ":"besoin / delai","obligatoire":true}]',
 '["devient demande d''achat a approuver (D-053)"]',
 '[{"objet":"circuit achat","liaison":"approbation et reception"}]',
 'cible'),
('FCS', 'Cloture de poste',
 'Cloturer un poste de travail : production realisee, evenements, passation.',
 'planning', ARRAY['planning','trips','reports'], ARRAY['superviseur','exploitation'],
 ARRAY['aucune'],
 '[{"champ":"poste","obligatoire":true},{"champ":"tonnages / rotations","obligatoire":false,"regle":"lus du systeme, jamais ressaisis"},{"champ":"evenements du poste","obligatoire":true}]',
 '["cloture validee par le superviseur (D-048)","fiches non rentrees listees comme manquantes"]',
 '[{"objet":"postes de travail","liaison":"passation et cloture D-048"}]',
 'cible')
ON CONFLICT (code, version) DO NOTHING;
